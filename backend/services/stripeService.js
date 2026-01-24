// services/stripeService.js
/**
 * Servicio centralizado para interactuar con Stripe
 * IMPORTANTE: Todas las claves de Stripe deben venir de variables de entorno
 * 
 * Funcionalidades:
 * - Suscripciones (planes de tenant)
 * - Pagos de reservas del marketplace (checkout one-time)
 * - Gestión de Customers y Payment Methods
 */

const Stripe = require('stripe');

// Inicializar Stripe con la clave secreta desde el entorno
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================================
// CONFIGURACIÓN DE URLs
// ============================================================

const { APP_URL } = require('../config/urls');
const STRIPE_SUCCESS_PATH = process.env.STRIPE_SUCCESS_PATH || '/stripe-success.html';
const STRIPE_CANCEL_PATH = process.env.STRIPE_CANCEL_PATH || '/stripe-cancel.html';

// ============================================================
// FUNCIONES PARA CUSTOMERS Y PAYMENT METHODS
// ============================================================

/**
 * Asegura que existe un Stripe Customer para el cliente
 * Si no existe en nuestra BD, crea uno nuevo en Stripe y lo guarda
 * 
 * @param {Object} params - Datos del cliente
 * @param {number} params.id_cliente - ID del cliente en nuestra BD
 * @param {string} params.email - Email del cliente
 * @param {string} params.phone - Teléfono del cliente (opcional)
 * @param {string} params.name - Nombre del cliente (opcional)
 * @returns {Promise<string>} stripe_customer_id
 */
async function ensureStripeCustomer({ id_cliente, email, phone, name }) {
    const db = getSystemDb();

    try {
        // 1. Buscar si ya tiene stripe_customer_id en clientefinal_auth
        const existingResult = await db.query(
            `SELECT stripe_customer_id FROM clientefinal_auth WHERE id_cliente = $1`,
            [id_cliente]
        );

        if (existingResult.rows.length > 0 && existingResult.rows[0].stripe_customer_id) {
            const existingCustomerId = existingResult.rows[0].stripe_customer_id;
            console.log(`[Stripe] Customer existente encontrado: ${existingCustomerId.substring(0, 10)}...`);
            return existingCustomerId;
        }

        // 2. Crear nuevo Customer en Stripe
        // Validar formato básico de email (Stripe es estricto)
        const emailValido = email && email.includes('@') && email.includes('.');

        const customerParams = {
            metadata: {
                id_cliente: id_cliente.toString(),
                source: 'versa_client_portal'
            }
        };

        if (emailValido) {
            customerParams.email = email.trim();
        } else {
            console.warn(`[Stripe] Email inválido o ausente para cliente ${id_cliente}: "${email}". Creando customer sin email.`);
        }

        if (name) customerParams.name = name;
        if (phone) customerParams.phone = phone;

        const customer = await stripe.customers.create(customerParams);
        console.log(`[Stripe] Nuevo customer creado: ${customer.id.substring(0, 10)}...`);

        // 3. Guardar en nuestra BD
        await db.query(
            `UPDATE clientefinal_auth SET stripe_customer_id = $1 WHERE id_cliente = $2`,
            [customer.id, id_cliente]
        );

        return customer.id;
    } catch (error) {
        console.error('[Stripe] Error en ensureStripeCustomer:', error.message);
        throw error;
    }
}

/**
 * Crea una sesión de Checkout en modo "setup" para guardar tarjeta SIN cobrar
 * 
 * @param {Object} params - Parámetros
 * @param {string} params.stripe_customer_id - ID del customer en Stripe
 * @param {number} params.id_cliente - ID del cliente en nuestra BD
 * @param {number} params.id_tenant - ID del tenant (opcional)
 * @returns {Promise<{checkout_url: string, session_id: string}>}
 */
async function createSetupCheckoutSession({ stripe_customer_id, id_cliente, id_tenant = null }) {
    try {
        const successUrl = `${APP_URL}/cliente-dashboard.html?tab=pagos&setup=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${APP_URL}/cliente-dashboard.html?tab=pagos&setup=cancel`;

        const session = await stripe.checkout.sessions.create({
            mode: 'setup',
            customer: stripe_customer_id,
            payment_method_types: ['card'],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                type: 'save_card',
                id_cliente: id_cliente.toString(),
                id_tenant: id_tenant ? id_tenant.toString() : '',
                purpose: 'SAVE_CARD'
            }
        });

        console.log(`[Stripe] Setup session creada: ${session.id.substring(0, 15)}...`);

        return {
            checkout_url: session.url,
            session_id: session.id
        };
    } catch (error) {
        console.error('[Stripe] Error creando setup session:', error.message);
        throw error;
    }
}

/**
 * Obtiene los Payment Methods de un Customer
 * Devuelve información segura (brand, last4, exp) sin datos sensibles
 * 
 * @param {string} stripe_customer_id - ID del customer en Stripe
 * @returns {Promise<Array>} Lista de payment methods
 */
async function getCustomerPaymentMethods(stripe_customer_id) {
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer: stripe_customer_id,
            type: 'card'
        });

        // Mapear a datos seguros para el frontend
        return paymentMethods.data.map(pm => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
            is_default: false // Se marcará después consultando el customer
        }));
    } catch (error) {
        console.error('[Stripe] Error obteniendo payment methods:', error.message);
        throw error;
    }
}

/**
 * Establece un Payment Method como predeterminado para el Customer
 * 
 * @param {string} stripe_customer_id - ID del customer
 * @param {string} payment_method_id - ID del payment method a establecer como default
 * @param {number} id_cliente - ID del cliente en nuestra BD
 */
async function setDefaultPaymentMethod(stripe_customer_id, payment_method_id, id_cliente = null) {
    const db = getSystemDb();

    try {
        // Actualizar en Stripe
        await stripe.customers.update(stripe_customer_id, {
            invoice_settings: {
                default_payment_method: payment_method_id
            }
        });

        // Opcionalmente guardar en nuestra BD
        if (id_cliente) {
            await db.query(
                `UPDATE clientefinal_auth SET stripe_default_payment_method_id = $1 WHERE id_cliente = $2`,
                [payment_method_id, id_cliente]
            );
        }

        console.log(`[Stripe] Payment method ${payment_method_id.substring(0, 10)}... establecido como default`);
        return true;
    } catch (error) {
        console.error('[Stripe] Error estableciendo default payment method:', error.message);
        throw error;
    }
}

/**
 * Elimina (detach) un Payment Method del Customer
 * 
 * @param {string} payment_method_id - ID del payment method a eliminar
 * @returns {Promise<boolean>} true si se eliminó
 */
async function detachPaymentMethod(payment_method_id) {
    try {
        await stripe.paymentMethods.detach(payment_method_id);
        console.log(`[Stripe] Payment method ${payment_method_id.substring(0, 10)}... eliminado`);
        return true;
    } catch (error) {
        console.error('[Stripe] Error eliminando payment method:', error.message);
        throw error;
    }
}

/**
 * Obtiene la información del Customer incluyendo default payment method
 * 
 * @param {string} stripe_customer_id - ID del customer
 * @returns {Promise<Object>} Customer con info de invoice_settings
 */
async function getCustomerWithDefaults(stripe_customer_id) {
    try {
        const customer = await stripe.customers.retrieve(stripe_customer_id, {
            expand: ['invoice_settings.default_payment_method']
        });
        return customer;
    } catch (error) {
        console.error('[Stripe] Error obteniendo customer con defaults:', error.message);
        throw error;
    }
}

// ============================================================
// FUNCIONES PARA PAGOS DE RESERVAS (MARKETPLACE)
// ============================================================

/**
 * Crea una sesión de Stripe Checkout para pago de reserva (DEPÓSITO o TOTAL)
 * 
 * @param {Object} params - Parámetros del checkout
 * @param {number} params.id_tenant - ID del tenant
 * @param {number} params.id_sucursal - ID de la sucursal
 * @param {number} params.id_cita - ID de la cita
 * @param {number|null} params.id_cliente - ID del cliente (opcional)
 * @param {string} params.payment_mode - 'DEPOSITO' o 'TOTAL'
 * @param {number} params.amount - Monto en la moneda (ej: 20.00 para 20€)
 * @param {string} params.currency - Moneda (default: 'eur')
 * @param {string} params.customer_email - Email del cliente
 * @param {string} params.customer_phone - Teléfono del cliente (opcional)
 * @param {string} params.service_name - Nombre del servicio (opcional)
 * @param {string} params.sucursal_name - Nombre de la sucursal (opcional)
 * @param {string} params.stripe_customer_id - ID del customer en Stripe (opcional, para guardar tarjeta)
 * @returns {Promise<{session_id: string, checkout_url: string}>}
 */
async function createCheckoutSessionForBooking({
    id_tenant,
    id_sucursal,
    id_cita,
    id_cliente,
    payment_mode,
    amount,
    currency = 'eur',
    customer_email,
    customer_phone,
    service_name,
    sucursal_name,
    stripe_customer_id = null
}) {
    try {
        // Validaciones
        if (!id_tenant || !id_sucursal || !id_cita) {
            throw new Error('Faltan IDs requeridos (tenant, sucursal, cita)');
        }
        if (!['DEPOSITO', 'TOTAL'].includes(payment_mode)) {
            throw new Error('payment_mode debe ser DEPOSITO o TOTAL');
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount debe ser mayor a 0');
        }

        // Convertir amount a centavos (Stripe usa la unidad más pequeña de la moneda)
        const amountInCents = Math.round(amount * 100);

        // Construir nombre del line item
        const paymentTypeLabel = payment_mode === 'DEPOSITO' ? 'Señal' : 'Pago completo';
        const itemName = service_name
            ? `${paymentTypeLabel} - ${service_name}`
            : `Reserva VERSA (${paymentTypeLabel})`;

        const itemDescription = sucursal_name
            ? `Reserva en ${sucursal_name}`
            : 'Reserva de servicio';

        // URLs de éxito y cancelación
        const successUrl = `${APP_URL}${STRIPE_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${APP_URL}${STRIPE_CANCEL_PATH}?cita_id=${id_cita}`;

        // Configurar parámetros de la sesión
        const sessionParams = {
            mode: 'payment', // Pago único, no suscripción
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: itemName,
                            description: itemDescription,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Metadata para identificar en webhooks
            metadata: {
                type: 'marketplace_booking',
                id_tenant: id_tenant.toString(),
                id_sucursal: id_sucursal.toString(),
                id_cita: id_cita.toString(),
                id_cliente: id_cliente ? id_cliente.toString() : '',
                payment_mode: payment_mode,
            },
            // Expiración del checkout (30 minutos por defecto de Stripe, max 24h)
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutos
        };

        // Si hay stripe_customer_id, asociar al customer y guardar tarjeta para uso futuro
        if (stripe_customer_id) {
            sessionParams.customer = stripe_customer_id;
            // Configurar para guardar la tarjeta para pagos futuros
            sessionParams.payment_intent_data = {
                setup_future_usage: 'off_session' // Guarda el PM para cobros futuros
            };
        } else if (customer_email) {
            // Si no hay customer, al menos usar el email
            sessionParams.customer_email = customer_email;
        }

        // Añadir teléfono en metadata si está disponible
        if (customer_phone) {
            sessionParams.metadata.customer_phone = customer_phone;
        }

        // Crear la sesión de checkout
        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[Stripe] Booking checkout session created: ${session.id.substring(0, 15)}... for cita ${id_cita}`);

        return {
            session_id: session.id,
            checkout_url: session.url,
        };
    } catch (error) {
        console.error('[Stripe] Error creating booking checkout session:', error.message);
        throw error;
    }
}

/**
 * Obtiene el estado de una sesión de checkout
 * @param {string} sessionId - ID de la sesión de Stripe
 * @returns {Promise<Object>} Sesión de checkout
 */
async function getCheckoutSession(sessionId) {
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent', 'customer'],
        });
        return session;
    } catch (error) {
        console.error('[Stripe] Error obteniendo checkout session:', error.message);
        throw error;
    }
}

/**
 * Obtiene el Payment Intent de una sesión
 * @param {string} paymentIntentId - ID del Payment Intent
 * @returns {Promise<Object>} Payment Intent
 */
async function getPaymentIntent(paymentIntentId) {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return paymentIntent;
    } catch (error) {
        console.error('[Stripe] Error obteniendo payment intent:', error.message);
        throw error;
    }
}

// ============================================================
// FUNCIONES PARA SUSCRIPCIONES (PLANES DE TENANT)
// ============================================================

/**
 * Get or create a Stripe customer for a tenant
 * @param {Object} params - Parameters
 * @param {number} params.id_tenant - Tenant ID
 * @param {string} params.email - Email for the customer
 * @param {string} params.name - Name (optional)
 * @returns {Promise<string>} Stripe customer ID
 */
async function getOrCreateTenantCustomer({ id_tenant, email, name }) {
    const db = getSystemDb();

    try {
        // Check if tenant already has a Stripe customer
        const existingResult = await db.query(
            `SELECT stripe_customer_id FROM tenant_suscripcion WHERE tenant_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1`,
            [id_tenant]
        );

        if (existingResult.rows.length > 0 && existingResult.rows[0].stripe_customer_id) {
            const existingCustomerId = existingResult.rows[0].stripe_customer_id;
            console.log(`[Stripe] Tenant customer found: ${existingCustomerId.substring(0, 10)}...`);
            return existingCustomerId;
        }

        // Create new customer in Stripe
        const customerParams = {
            metadata: {
                id_tenant: id_tenant.toString(),
                source: 'versa_tenant_subscription'
            }
        };

        if (email && email.includes('@')) {
            customerParams.email = email.trim();
        }
        if (name) {
            customerParams.name = name;
        }

        const customer = await stripe.customers.create(customerParams);
        console.log(`[Stripe] New tenant customer created: ${customer.id.substring(0, 10)}...`);

        // Update tenant_suscripcion with the customer ID if record exists
        await db.query(
            `UPDATE tenant_suscripcion SET stripe_customer_id = $1 WHERE tenant_id = $2`,
            [customer.id, id_tenant]
        );

        return customer.id;
    } catch (error) {
        console.error('[Stripe] Error in getOrCreateTenantCustomer:', error.message);
        throw error;
    }
}

/**
 * Create a Stripe Customer Portal session for subscription management
 * @param {Object} params - Parameters
 * @param {string} params.stripe_customer_id - Stripe customer ID
 * @param {string} params.return_url - URL to return after portal session
 * @returns {Promise<{portal_url: string}>}
 */
async function createPortalSession({ stripe_customer_id, return_url }) {
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: stripe_customer_id,
            return_url: return_url,
        });

        console.log(`[Stripe] Portal session created for customer ${stripe_customer_id.substring(0, 10)}...`);

        return {
            portal_url: session.url
        };
    } catch (error) {
        console.error('[Stripe] Error creating portal session:', error.message);
        throw error;
    }
}

/**
 * Infer plan_key from a Stripe price ID by looking up in database
 * @param {string} priceId - Stripe price ID
 * @returns {Promise<string|null>} plan_key or null if not found
 */
async function inferPlanKeyFromPriceId(priceId) {
    const db = getSystemDb();

    try {
        const result = await db.query(`
            SELECT plan_key FROM plan_suscripcion 
            WHERE precio_mensual_stripe_price_id = $1 
               OR precio_anual_stripe_price_id = $1
            LIMIT 1
        `, [priceId]);

        if (result.rows.length > 0) {
            return result.rows[0].plan_key;
        }

        console.warn(`[Stripe] Could not infer plan_key for price ID: ${priceId}`);
        return null;
    } catch (error) {
        console.error('[Stripe] Error inferring plan_key:', error.message);
        return null;
    }
}

/**
 * Crea una sesión de checkout de Stripe para suscripciones (enhanced)
 * @param {Object} params - Parámetros de la sesión
 * @param {string} params.priceId - ID del precio de Stripe
 * @param {number} params.tenantId - ID del tenant
 * @param {string} params.planKey - Plan key (basic, pro, business)
 * @param {string} params.billingCycle - Billing cycle (monthly, yearly)
 * @param {string} params.email - Email del cliente (opcional)
 * @param {string} params.successUrl - URL de éxito
 * @param {string} params.cancelUrl - URL de cancelación
 * @param {string} params.stripeCustomerId - Existing Stripe customer ID (opcional)
 * @returns {Promise<Object>} Sesión de checkout de Stripe
 */
async function createSubscriptionCheckoutSession({
    priceId,
    tenantId,
    planKey,
    billingCycle,
    email,
    successUrl,
    cancelUrl,
    stripeCustomerId
}) {
    try {
        const sessionParams = {
            mode: 'subscription',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Enhanced metadata for webhooks
            metadata: {
                type: 'subscription',
                tenant_id: tenantId.toString(),
                plan_key: planKey || '',
                billing_cycle: billingCycle || 'monthly',
            },
            // Subscription metadata
            subscription_data: {
                metadata: {
                    tenant_id: tenantId.toString(),
                    plan_key: planKey || '',
                },
            },
            client_reference_id: tenantId.toString(),
        };

        // If existing customer, attach to session
        if (stripeCustomerId) {
            sessionParams.customer = stripeCustomerId;
        } else if (email) {
            sessionParams.customer_email = email;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[Stripe] Subscription checkout created: ${session.id.substring(0, 10)}... for plan ${planKey}`);

        return session;
    } catch (error) {
        console.error('[Stripe] Error creating subscription checkout:', error.message);
        throw error;
    }
}

/**
 * Crea una sesión de checkout de Stripe para suscripciones (legacy support)
 * @deprecated Use createSubscriptionCheckoutSession instead
 */
async function createCheckoutSession({ priceId, tenantId, email, successUrl, cancelUrl }) {
    return createSubscriptionCheckoutSession({
        priceId,
        tenantId,
        email,
        successUrl,
        cancelUrl
    });
}

/**
 * Verifica la firma del webhook de Stripe
 * @param {string|Buffer} payload - Body de la petición (raw)
 * @param {string} signature - Firma del webhook (header stripe-signature)
 * @returns {Object} Evento verificado
 */
function verifyWebhookSignature(payload, signature) {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.warn('[Stripe] STRIPE_WEBHOOK_SECRET no configurado, procesando sin verificación');
            // En desarrollo sin webhook secret, parsear el JSON directamente
            if (typeof payload === 'string') {
                return JSON.parse(payload);
            }
            return JSON.parse(payload.toString());
        }

        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            webhookSecret
        );

        console.log(`[Stripe] Webhook verificado: ${event.type}`);
        return event;
    } catch (error) {
        console.error('[Stripe] Error verificando webhook:', error.message);
        throw error;
    }
}

/**
 * Obtiene una suscripción de Stripe por su ID
 * @param {string} subscriptionId - ID de la suscripción
 * @returns {Promise<Object>} Suscripción de Stripe
 */
async function getSubscription(subscriptionId) {
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return subscription;
    } catch (error) {
        console.error('[Stripe] Error obteniendo suscripción:', error.message);
        throw error;
    }
}

/**
 * Obtiene un cliente de Stripe por su ID
 * @param {string} customerId - ID del cliente
 * @returns {Promise<Object>} Cliente de Stripe
 */
async function getCustomer(customerId) {
    try {
        const customer = await stripe.customers.retrieve(customerId);
        return customer;
    } catch (error) {
        console.error('[Stripe] Error obteniendo customer:', error.message);
        throw error;
    }
}

/**
 * Cancela una suscripción
 * @param {string} subscriptionId - ID de la suscripción
 * @param {boolean} atPeriodEnd - Si debe cancelarse al final del período actual
 * @returns {Promise<Object>} Suscripción cancelada
 */
async function cancelSubscription(subscriptionId, atPeriodEnd = true) {
    try {
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: atPeriodEnd,
        });

        console.log(`[Stripe] Suscripción ${subscriptionId} marcada para cancelación`);
        return subscription;
    } catch (error) {
        console.error('[Stripe] Error cancelando suscripción:', error.message);
        throw error;
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // Stripe SDK instance
    stripe,

    // Customer y Payment Methods
    ensureStripeCustomer,
    createSetupCheckoutSession,
    getCustomerPaymentMethods,
    setDefaultPaymentMethod,
    detachPaymentMethod,
    getCustomerWithDefaults,

    // Tenant Customer & Portal
    getOrCreateTenantCustomer,
    createPortalSession,
    inferPlanKeyFromPriceId,

    // Pagos de reservas (marketplace)
    createCheckoutSessionForBooking,
    getCheckoutSession,
    getPaymentIntent,

    // Suscripciones
    createCheckoutSession,
    createSubscriptionCheckoutSession,
    getSubscription,
    getCustomer,
    cancelSubscription,

    // Webhooks
    verifyWebhookSignature,
};
