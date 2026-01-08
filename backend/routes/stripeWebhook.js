// routes/stripeWebhook.js
/**
 * Ruta específica para el webhook de Stripe
 * IMPORTANTE: Esta ruta debe montarse ANTES del middleware express.json()
 * porque necesita acceso al raw body para verificar la firma
 * 
 * Maneja:
 * - Suscripciones de tenant (subscription events)
 * - Pagos de reservas del marketplace (checkout one-time payment)
 * 
 * Features:
 * - Idempotency via stripe_event_log table
 * - Plan inference from price.id when not in metadata
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const stripeService = require('../services/stripeService');
const incomeService = require('../services/incomeService');

// ============================================================
// IDEMPOTENCY HELPERS
// ============================================================

/**
 * Check if an event has already been processed
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<boolean>} True if already processed
 */
async function isEventProcessed(eventId) {
    try {
        const result = await pool.query(
            'SELECT id FROM stripe_event_log WHERE stripe_event_id = $1',
            [eventId]
        );
        return result.rows.length > 0;
    } catch (error) {
        // If table doesn't exist yet, return false
        if (error.code === '42P01') {
            console.warn('[Stripe Webhook] stripe_event_log table not found, skipping idempotency check');
            return false;
        }
        throw error;
    }
}

/**
 * Mark an event as processed
 * @param {Object} event - Stripe event object
 * @param {string|null} error - Processing error if any
 */
async function markEventProcessed(event, processingError = null) {
    try {
        await pool.query(`
            INSERT INTO stripe_event_log (stripe_event_id, type, created, payload_json, processing_error)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (stripe_event_id) DO UPDATE SET
                processing_error = COALESCE(EXCLUDED.processing_error, stripe_event_log.processing_error),
                processed_at = NOW()
        `, [
            event.id,
            event.type,
            event.created,
            JSON.stringify(event.data.object),
            processingError
        ]);
    } catch (error) {
        // Non-fatal - log but don't throw
        console.error('[Stripe Webhook] Error marking event as processed:', error.message);
    }
}

/**
 * POST /api/stripe/webhook
 * Endpoint para recibir eventos de Stripe
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
        // Verificar la firma del webhook
        const event = stripeService.verifyWebhookSignature(req.body, signature);

        console.log(`[Stripe Webhook] Evento recibido: ${event.type} (${event.id})`);

        // IDEMPOTENCY CHECK
        const alreadyProcessed = await isEventProcessed(event.id);
        if (alreadyProcessed) {
            console.log(`[Stripe Webhook] Evento ${event.id} ya procesado, ignorando`);
            return res.json({ received: true, status: 'already_processed' });
        }

        // Obtener el tipo de transacción desde metadata
        const metadata = event.data.object?.metadata || {};
        const transactionType = metadata.type || 'unknown';

        let processingError = null;

        try {
            // Procesar el evento según su tipo
            switch (event.type) {
                // =====================================================
                // EVENTOS DE CHECKOUT SESSION
                // =====================================================
                case 'checkout.session.completed':
                    if (transactionType === 'marketplace_booking') {
                        await handleBookingCheckoutCompleted(event.data.object);
                    } else {
                        // Asumir suscripción (comportamiento anterior)
                        await handleSubscriptionCheckoutCompleted(event.data.object);
                    }
                    break;

                case 'checkout.session.expired':
                    if (transactionType === 'marketplace_booking') {
                        await handleBookingCheckoutExpired(event.data.object);
                    } else {
                        console.log('[Stripe] Checkout session expirada (suscripción)');
                    }
                    break;

                // =====================================================
                // EVENTOS DE PAYMENT INTENT
                // =====================================================
                case 'payment_intent.payment_failed':
                    if (transactionType === 'marketplace_booking' || metadata.id_cita) {
                        await handleBookingPaymentFailed(event.data.object);
                    }
                    break;

                case 'payment_intent.succeeded':
                    // Por si completamos el payment intent directamente
                    console.log(`[Stripe] Payment Intent succeeded: ${event.data.object.id}`);
                    break;

                // =====================================================
                // EVENTOS DE SUSCRIPCIÓN
                // =====================================================
                case 'customer.subscription.created':
                    await handleSubscriptionCreated(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.paid':
                    await handleInvoicePaid(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await handleInvoicePaymentFailed(event.data.object);
                    break;

                default:
                    console.log(`[Stripe] Evento no manejado: ${event.type}`);
            }
        } catch (handlerError) {
            console.error(`[Stripe Webhook] Error procesando ${event.type}:`, handlerError);
            processingError = handlerError.message;
        }

        // Mark event as processed (with error if any)
        await markEventProcessed(event, processingError);

        // Responder 200 OK para confirmar recepción
        res.json({ received: true });

    } catch (error) {
        console.error('[Stripe] Error en webhook:', error);
        res.status(400).json({
            ok: false,
            error: 'Error procesando webhook',
        });
    }
});

// ============================================================
// HANDLERS PARA PAGOS DE RESERVAS (MARKETPLACE)
// ============================================================

/**
 * Maneja checkout.session.completed para reservas del marketplace
 */
async function handleBookingCheckoutCompleted(session) {
    console.log('[Stripe] Procesando checkout.session.completed (booking):', session.id);

    const { id_cita, id_cliente, payment_mode, id_tenant, id_sucursal } = session.metadata || {};
    const paymentIntentId = session.payment_intent;

    if (!id_cita) {
        console.error('[Stripe] checkout.session.completed sin id_cita en metadata');
        return;
    }

    try {
        // Actualizar registro de pago a PAID
        const updateResult = await pool.query(
            `UPDATE marketplace_reserva_pago 
             SET status = 'PAID',
                 stripe_payment_intent_id = $1,
                 updated_at = NOW(),
                 metadata_json = COALESCE(metadata_json, '{}')::jsonb || $2::jsonb
             WHERE stripe_checkout_session_id = $3
             RETURNING *`,
            [
                paymentIntentId,
                JSON.stringify({
                    paid_at: new Date().toISOString(),
                    amount_received: session.amount_total / 100
                }),
                session.id
            ]
        );

        if (updateResult.rowCount === 0) {
            console.warn(`[Stripe] No se encontró registro de pago para session: ${session.id}`);
            return;
        }

        const pago = updateResult.rows[0];
        console.log(`[Stripe] Pago marcado como PAID para cita ${id_cita}`);

        // =====================================================
        // CREAR INCOME EVENT EN EL LEDGER
        // =====================================================
        try {
            const tenantId = parseInt(id_tenant) || pago.id_tenant;
            const sucursalId = parseInt(id_sucursal) || pago.id_sucursal;
            const clienteId = parseInt(id_cliente) || pago.id_cliente;
            const amount = session.amount_total / 100; // Stripe usa centavos

            await incomeService.createIncomeEvent({
                idTenant: tenantId,
                idSucursal: sucursalId,
                origen: 'marketplace',
                originType: 'cita',
                originId: parseInt(id_cita),
                idCliente: clienteId || null,
                amount: amount,
                currency: (session.currency || 'EUR').toUpperCase(),
                status: 'paid',
                provider: 'stripe',
                reference: `stripe:${session.id}`,
                description: `Pago ${payment_mode === 'DEPOSITO' ? 'señal' : 'reserva'} marketplace`,
                metadata: {
                    stripe_session_id: session.id,
                    stripe_payment_intent_id: paymentIntentId,
                    payment_mode: payment_mode,
                    cita_id: id_cita
                }
            });

            console.log(`[Stripe] ✅ Income event creado para marketplace: ${amount}€`);
        } catch (incomeError) {
            // No fallar el webhook por error en income_event (idempotencia lo manejará)
            console.error('[Stripe] Error creando income_event:', incomeError.message);
        }

        // Enviar WhatsApp de confirmación de pago (opcional)
        try {
            const timelinesService = require('../services/timelinesService');
            const { cliente_telefono } = pago.metadata_json || {};

            if (cliente_telefono && cliente_telefono.startsWith('+')) {
                await timelinesService.sendInitialMessage(
                    cliente_telefono,
                    `Pago recibido ✅ Gracias. Tu ${payment_mode === 'DEPOSITO' ? 'señal' : 'pago'} de ${pago.amount}€ ha sido confirmado. ¡Te esperamos!`
                );
            }
        } catch (whatsappError) {
            console.warn('[Stripe] No se pudo enviar WhatsApp de confirmación:', whatsappError.message);
        }

    } catch (error) {
        console.error('[Stripe] Error actualizando pago a PAID:', error);
    }
}

/**
 * Maneja checkout.session.expired para reservas del marketplace
 * IMPORTANTE: NO cancela la cita (regla de negocio)
 */
async function handleBookingCheckoutExpired(session) {
    console.log('[Stripe] Procesando checkout.session.expired (booking):', session.id);

    const { id_cita } = session.metadata || {};

    try {
        // Solo actualizar el registro de pago a EXPIRED
        await pool.query(
            `UPDATE marketplace_reserva_pago 
             SET status = 'EXPIRED',
                 updated_at = NOW()
             WHERE stripe_checkout_session_id = $1`,
            [session.id]
        );

        console.log(`[Stripe] Pago marcado como EXPIRED para session: ${session.id}`);
        console.log(`[Stripe] NOTA: La cita ${id_cita} NO fue cancelada (regla de negocio)`);

        // Enviar WhatsApp opcional informando que el enlace expiró
        try {
            const result = await pool.query(
                `SELECT metadata_json->>'cliente_telefono' as telefono
                 FROM marketplace_reserva_pago 
                 WHERE stripe_checkout_session_id = $1`,
                [session.id]
            );

            if (result.rows.length > 0 && result.rows[0].telefono) {
                const timelinesService = require('../services/timelinesService');
                await timelinesService.sendInitialMessage(
                    result.rows[0].telefono,
                    `⏰ Tu enlace de pago ha expirado. Tu reserva sigue registrada. Si deseas generar un nuevo enlace de pago, contacta con el taller.`
                );
            }
        } catch (whatsappError) {
            console.warn('[Stripe] No se pudo enviar WhatsApp de expiración:', whatsappError.message);
        }

    } catch (error) {
        console.error('[Stripe] Error actualizando pago a EXPIRED:', error);
    }
}

/**
 * Maneja payment_intent.payment_failed para reservas del marketplace
 */
async function handleBookingPaymentFailed(paymentIntent) {
    console.log('[Stripe] Procesando payment_intent.payment_failed:', paymentIntent.id);

    try {
        // Buscar el pago por payment_intent_id
        await pool.query(
            `UPDATE marketplace_reserva_pago 
             SET status = 'FAILED',
                 updated_at = NOW(),
                 metadata_json = COALESCE(metadata_json, '{}')::jsonb || $1::jsonb
             WHERE stripe_payment_intent_id = $2`,
            [
                JSON.stringify({
                    failed_at: new Date().toISOString(),
                    error: paymentIntent.last_payment_error?.message || 'Unknown error'
                }),
                paymentIntent.id
            ]
        );

        console.log(`[Stripe] Pago marcado como FAILED: ${paymentIntent.id}`);
    } catch (error) {
        console.error('[Stripe] Error actualizando pago a FAILED:', error);
    }
}

// ============================================================
// HANDLERS PARA SUSCRIPCIONES (TENANT)
// ============================================================

/**
 * Maneja el evento checkout.session.completed para suscripciones
 */
async function handleSubscriptionCheckoutCompleted(session) {
    console.log('[Stripe] Procesando checkout.session.completed (subscription):', session.id);

    const tenantId = parseInt(session.metadata?.tenant_id);
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    if (!tenantId || !subscriptionId) {
        console.warn('[Stripe] checkout.session.completed sin tenant_id o subscription');
        return;
    }

    try {
        // Obtener la suscripción completa de Stripe
        const subscription = await stripeService.getSubscription(subscriptionId);

        // Determinar el plan según el price_id
        const priceId = subscription.items.data[0].price.id;
        const planQuery = await pool.query(
            `SELECT id FROM plan_suscripcion 
             WHERE precio_mensual_stripe_price_id = $1 
             OR precio_anual_stripe_price_id = $1 
             LIMIT 1`,
            [priceId]
        );

        if (planQuery.rows.length === 0) {
            console.error('[Stripe] No se encontró plan para price_id:', priceId);
            return;
        }

        const planId = planQuery.rows[0].id;

        // Crear o actualizar la suscripción del tenant
        await pool.query(
            `INSERT INTO tenant_suscripcion (
              tenant_id,
              plan_id,
              stripe_customer_id,
              stripe_subscription_id,
              status,
              trial_start_at,
              trial_end_at,
              current_period_start,
              current_period_end,
              cancel_at_period_end,
              ultima_sync_stripe_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (tenant_id)
            DO UPDATE SET
              plan_id = EXCLUDED.plan_id,
              stripe_customer_id = EXCLUDED.stripe_customer_id,
              stripe_subscription_id = EXCLUDED.stripe_subscription_id,
              status = EXCLUDED.status,
              trial_start_at = EXCLUDED.trial_start_at,
              trial_end_at = EXCLUDED.trial_end_at,
              current_period_start = EXCLUDED.current_period_start,
              current_period_end = EXCLUDED.current_period_end,
              cancel_at_period_end = EXCLUDED.cancel_at_period_end,
              ultima_sync_stripe_at = NOW()`,
            [
                tenantId,
                planId,
                customerId,
                subscriptionId,
                subscription.status,
                subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000),
                subscription.cancel_at_period_end || false,
            ]
        );

        console.log(`[Stripe] Suscripción creada/actualizada para tenant ${tenantId}`);
    } catch (error) {
        console.error('[Stripe] Error procesando suscripción:', error);
    }
}

/**
 * Maneja el evento invoice.paid
 * Clears past_due_since when payment succeeds
 */
async function handleInvoicePaid(invoice) {
    console.log('[Stripe] Procesando invoice.paid:', invoice.id);

    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
        console.log('[Stripe] Invoice sin suscripción asociada');
        return;
    }

    try {
        const subscription = await stripeService.getSubscription(subscriptionId);

        // Actualizar el estado de la suscripción y clear past_due_since
        await pool.query(
            `UPDATE tenant_suscripcion SET
              status = $1,
              current_period_start = $2,
              current_period_end = $3,
              past_due_since = NULL,
              ultima_sync_stripe_at = NOW()
            WHERE stripe_subscription_id = $4`,
            [
                subscription.status,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000),
                subscriptionId,
            ]
        );

        console.log(`[Stripe] Suscripción ${subscriptionId} actualizada a status ${subscription.status}, past_due cleared`);
    } catch (error) {
        console.error('[Stripe] Error actualizando suscripción:', error);
    }
}

/**
 * Maneja el evento invoice.payment_failed
 * Sets past_due_since if not already set
 */
async function handleInvoicePaymentFailed(invoice) {
    console.log('[Stripe] Procesando invoice.payment_failed:', invoice.id);

    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
        return;
    }

    try {
        // Marcar la suscripción como past_due y set past_due_since if null
        await pool.query(
            `UPDATE tenant_suscripcion SET
              status = 'past_due',
              past_due_since = COALESCE(past_due_since, NOW()),
              ultima_sync_stripe_at = NOW()
            WHERE stripe_subscription_id = $1`,
            [subscriptionId]
        );

        console.log(`[Stripe] Suscripción ${subscriptionId} marcada como past_due`);
    } catch (error) {
        console.error('[Stripe] Error marcando suscripción como past_due:', error);
    }
}

/**
 * Maneja el evento customer.subscription.created
 * Creates or updates subscription record with plan_key inference
 */
async function handleSubscriptionCreated(subscription) {
    console.log('[Stripe] Procesando customer.subscription.created:', subscription.id);

    try {
        // Get tenant_id from metadata
        const tenantId = parseInt(subscription.metadata?.tenant_id);
        const metadataPlanKey = subscription.metadata?.plan_key;
        const customerId = subscription.customer;

        if (!tenantId) {
            console.warn('[Stripe] customer.subscription.created sin tenant_id en metadata');
            return;
        }

        // Get price_id and infer plan if not in metadata
        const priceId = subscription.items?.data?.[0]?.price?.id;
        let planKey = metadataPlanKey;

        if (!planKey && priceId) {
            planKey = await stripeService.inferPlanKeyFromPriceId(priceId);
        }

        // Get plan_id from database
        const planQuery = await pool.query(
            `SELECT id, plan_key FROM plan_suscripcion 
             WHERE (plan_key = $1 OR precio_mensual_stripe_price_id = $2 OR precio_anual_stripe_price_id = $2)
             AND activo = true
             LIMIT 1`,
            [planKey, priceId]
        );

        if (planQuery.rows.length === 0) {
            console.error('[Stripe] No se encontró plan para:', { planKey, priceId });
            return;
        }

        const plan = planQuery.rows[0];

        // Upsert subscription
        await pool.query(`
            INSERT INTO tenant_suscripcion (
                tenant_id, plan_id, plan_key, stripe_customer_id, stripe_subscription_id,
                status, trial_start_at, trial_end_at, current_period_start, current_period_end,
                cancel_at_period_end, ultima_sync_stripe_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (tenant_id) DO UPDATE SET
                plan_id = EXCLUDED.plan_id,
                plan_key = EXCLUDED.plan_key,
                stripe_customer_id = EXCLUDED.stripe_customer_id,
                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                status = EXCLUDED.status,
                trial_start_at = EXCLUDED.trial_start_at,
                trial_end_at = EXCLUDED.trial_end_at,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                past_due_since = NULL,
                ultima_sync_stripe_at = NOW()
        `, [
            tenantId,
            plan.id,
            plan.plan_key,
            customerId,
            subscription.id,
            subscription.status,
            subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            new Date(subscription.current_period_start * 1000),
            new Date(subscription.current_period_end * 1000),
            subscription.cancel_at_period_end || false
        ]);

        console.log(`[Stripe] ✅ Suscripción creada para tenant ${tenantId} con plan ${plan.plan_key}`);
    } catch (error) {
        console.error('[Stripe] Error en handleSubscriptionCreated:', error);
        throw error;
    }
}

/**
 * Maneja el evento customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription) {
    console.log('[Stripe] Procesando customer.subscription.deleted:', subscription.id);

    try {
        await pool.query(
            `UPDATE tenant_suscripcion SET
              status = 'canceled',
              cancel_at = $1,
              ultima_sync_stripe_at = NOW()
            WHERE stripe_subscription_id = $2`,
            [
                subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date(),
                subscription.id,
            ]
        );

        console.log(`[Stripe] Suscripción ${subscription.id} cancelada`);
    } catch (error) {
        console.error('[Stripe] Error cancelando suscripción:', error);
    }
}

/**
 * Maneja el evento customer.subscription.updated
 * Updates status, period dates, and infers plan if changed
 */
async function handleSubscriptionUpdated(subscription) {
    console.log('[Stripe] Procesando customer.subscription.updated:', subscription.id);

    try {
        // Check if plan changed
        const priceId = subscription.items?.data?.[0]?.price?.id;
        let planKey = subscription.metadata?.plan_key;

        if (!planKey && priceId) {
            planKey = await stripeService.inferPlanKeyFromPriceId(priceId);
        }

        // Get plan details
        const planQuery = await pool.query(
            `SELECT id, plan_key FROM plan_suscripcion 
             WHERE (plan_key = $1 OR precio_mensual_stripe_price_id = $2 OR precio_anual_stripe_price_id = $2)
             AND activo = true
             LIMIT 1`,
            [planKey, priceId]
        );

        const plan = planQuery.rows[0];

        if (plan) {
            await pool.query(
                `UPDATE tenant_suscripcion SET
                  plan_id = $1,
                  plan_key = $2,
                  status = $3,
                  current_period_start = $4,
                  current_period_end = $5,
                  cancel_at_period_end = $6,
                  cancel_at = $7,
                  ultima_sync_stripe_at = NOW()
                WHERE stripe_subscription_id = $8`,
                [
                    plan.id,
                    plan.plan_key,
                    subscription.status,
                    new Date(subscription.current_period_start * 1000),
                    new Date(subscription.current_period_end * 1000),
                    subscription.cancel_at_period_end || false,
                    subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
                    subscription.id,
                ]
            );
        } else {
            // Just update status without plan change
            await pool.query(
                `UPDATE tenant_suscripcion SET
                  status = $1,
                  current_period_start = $2,
                  current_period_end = $3,
                  cancel_at_period_end = $4,
                  cancel_at = $5,
                  ultima_sync_stripe_at = NOW()
                WHERE stripe_subscription_id = $6`,
                [
                    subscription.status,
                    new Date(subscription.current_period_start * 1000),
                    new Date(subscription.current_period_end * 1000),
                    subscription.cancel_at_period_end || false,
                    subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
                    subscription.id,
                ]
            );
        }

        console.log(`[Stripe] Suscripción ${subscription.id} actualizada`);
    } catch (error) {
        console.error('[Stripe] Error actualizando suscripción:', error);
    }
}

module.exports = router;
