// routes/stripeWebhook.js
/**
 * Ruta específica para el webhook de Stripe
 * IMPORTANTE: Esta ruta debe montarse ANTES del middleware express.json()
 * porque necesita acceso al raw body para verificar la firma
 * 
 * Maneja:
 * - Suscripciones de tenant (subscription events)
 * - Pagos de reservas del marketplace (checkout one-time payment)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const stripeService = require('../services/stripeService');

/**
 * POST /api/stripe/webhook
 * Endpoint para recibir eventos de Stripe
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
        // Verificar la firma del webhook
        const event = stripeService.verifyWebhookSignature(req.body, signature);

        console.log(`[Stripe Webhook] Evento recibido: ${event.type}`);

        // Obtener el tipo de transacción desde metadata
        const metadata = event.data.object?.metadata || {};
        const transactionType = metadata.type || 'unknown';

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
            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            default:
                console.log(`[Stripe] Evento no manejado: ${event.type}`);
        }

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

    const { id_cita, id_cliente, payment_mode } = session.metadata || {};
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

        // Actualizar el estado de la suscripción
        await pool.query(
            `UPDATE tenant_suscripcion SET
              status = $1,
              current_period_start = $2,
              current_period_end = $3,
              ultima_sync_stripe_at = NOW()
            WHERE stripe_subscription_id = $4`,
            [
                subscription.status,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000),
                subscriptionId,
            ]
        );

        console.log(`[Stripe] Suscripción ${subscriptionId} actualizada a status ${subscription.status}`);
    } catch (error) {
        console.error('[Stripe] Error actualizando suscripción:', error);
    }
}

/**
 * Maneja el evento invoice.payment_failed
 */
async function handleInvoicePaymentFailed(invoice) {
    console.log('[Stripe] Procesando invoice.payment_failed:', invoice.id);

    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
        return;
    }

    try {
        // Marcar la suscripción como con problemas de pago
        await pool.query(
            `UPDATE tenant_suscripcion SET
              status = 'past_due',
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
 */
async function handleSubscriptionUpdated(subscription) {
    console.log('[Stripe] Procesando customer.subscription.updated:', subscription.id);

    try {
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

        console.log(`[Stripe] Suscripción ${subscription.id} actualizada`);
    } catch (error) {
        console.error('[Stripe] Error actualizando suscripción:', error);
    }
}

module.exports = router;
