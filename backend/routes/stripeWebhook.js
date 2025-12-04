// routes/stripeWebhook.js
/**
 * Ruta específica para el webhook de Stripe
 * IMPORTANTE: Esta ruta debe montarse ANTES del middleware express.json()
 * porque necesita acceso al raw body para verificar la firma
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

        // Procesar el evento según su tipo
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;

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

/**
 * Maneja el evento checkout.session.completed
 */
async function handleCheckoutSessionCompleted(session) {
    console.log('[Stripe] Procesando checkout.session.completed:', session.id);

    const tenantId = parseInt(session.metadata.tenant_id);
    const subscriptionId = session.subscription;
    const customerId = session.customer;

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

    // Marcar la suscripción como con problemas de pago
    await pool.query(
        `UPDATE tenant_suscripcion SET
      status = 'past_due',
      ultima_sync_stripe_at = NOW()
    WHERE stripe_subscription_id = $1`,
        [subscriptionId]
    );

    console.log(`[Stripe] Suscripción ${subscriptionId} marcada como past_due`);
}

/**
 * Maneja el evento customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription) {
    console.log('[Stripe] Procesando customer.subscription.deleted:', subscription.id);

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
}

/**
 * Maneja el evento customer.subscription.updated
 */
async function handleSubscriptionUpdated(subscription) {
    console.log('[Stripe] Procesando customer.subscription.updated:', subscription.id);

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
}

module.exports = router;
