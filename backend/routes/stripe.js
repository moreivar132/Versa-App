// routes/stripe.js
/**
 * Rutas para la integración con Stripe (excepto webhook)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const stripeService = require('../services/stripeService');

/**
 * POST /api/stripe/create-checkout-session
 * Crea una sesión de checkout de Stripe para suscripciones
 */
router.post('/create-checkout-session', async (req, res) => {
    try {
        const { tenantId, plan, billingInterval, email } = req.body;

        // Validación de parámetros
        if (!tenantId || !plan || !billingInterval) {
            return res.status(400).json({
                ok: false,
                error: 'Faltan parámetros requeridos: tenantId, plan, billingInterval',
            });
        }

        // Validar que billingInterval sea válido
        if (!['monthly', 'yearly'].includes(billingInterval)) {
            return res.status(400).json({
                ok: false,
                error: 'billingInterval debe ser "monthly" o "yearly"',
            });
        }

        // Verificar que el tenant existe
        const tenantCheck = await pool.query('SELECT id FROM tenant WHERE id = $1', [tenantId]);
        if (tenantCheck.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Tenant no encontrado',
            });
        }

        // Obtener el plan de suscripción de la base de datos
        const planQuery = await pool.query(
            'SELECT * FROM plan_suscripcion WHERE LOWER(nombre) = LOWER($1) AND activo = true',
            [plan]
        );

        if (planQuery.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: `Plan "${plan}" no encontrado o no está activo`,
            });
        }

        const planData = planQuery.rows[0];

        // Determinar el price_id según el intervalo de facturación
        let priceId;
        if (billingInterval === 'monthly') {
            priceId = planData.precio_mensual_stripe_price_id;
        } else {
            priceId = planData.precio_anual_stripe_price_id;
        }

        if (!priceId) {
            return res.status(400).json({
                ok: false,
                error: `No hay price_id configurado para el plan "${plan}" con intervalo "${billingInterval}"`,
            });
        }

        // Construir URLs de éxito y cancelación
        const successUrl = `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&tenant_id=${tenantId}`;
        const cancelUrl = process.env.STRIPE_CANCEL_URL;

        // Crear la sesión de checkout
        const session = await stripeService.createCheckoutSession({
            priceId,
            tenantId,
            email,
            successUrl,
            cancelUrl,
        });

        // Responder con la URL de checkout
        res.json({
            ok: true,
            url: session.url,
        });

    } catch (error) {
        console.error('[Stripe] Error en /create-checkout-session:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear la sesión de checkout',
            details: error.message,
        });
    }
});

module.exports = router;
