// services/stripeService.js
/**
 * Servicio centralizado para interactuar con Stripe
 * IMPORTANTE: Todas las claves de Stripe deben venir de variables de entorno
 */

const Stripe = require('stripe');

// Inicializar Stripe con la clave secreta desde el entorno
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Crea una sesión de checkout de Stripe para suscripciones
 * @param {Object} params - Parámetros de la sesión
 * @param {string} params.priceId - ID del precio de Stripe
 * @param {number} params.tenantId - ID del tenant
 * @param {string} params.email - Email del cliente (opcional)
 * @param {string} params.successUrl - URL de éxito
 * @param {string} params.cancelUrl - URL de cancelación
 * @returns {Promise<Object>} Sesión de checkout de Stripe
 */
async function createCheckoutSession({ priceId, tenantId, email, successUrl, cancelUrl }) {
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
            // Metadata para poder identificar el tenant en los webhooks
            metadata: {
                tenant_id: tenantId.toString(),
            },
            // Configuración de suscripción automática
            subscription_data: {
                metadata: {
                    tenant_id: tenantId.toString(),
                },
            },
        };

        // Si se proporciona email, agregarlo
        if (email) {
            sessionParams.customer_email = email;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        // Log sin mostrar claves sensibles
        console.log(`[Stripe] Checkout session created: ${session.id.substring(0, 10)}...`);

        return session;
    } catch (error) {
        console.error('[Stripe] Error creating checkout session:', error.message);
        throw error;
    }
}

/**
 * Verifica la firma del webhook de Stripe
 * @param {string} payload - Body de la petición
 * @param {string} signature - Firma del webhook (header stripe-signature)
 * @returns {Object} Evento verificado
 */
function verifyWebhookSignature(payload, signature) {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET no está configurado');
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

module.exports = {
    stripe,
    createCheckoutSession,
    verifyWebhookSignature,
    getSubscription,
    getCustomer,
    cancelSubscription,
};
