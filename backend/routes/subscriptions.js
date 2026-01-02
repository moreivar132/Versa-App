// routes/subscriptions.js
/**
 * Rutas para gestión y consulta de suscripciones
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { canTenantUseApp } = require('../middleware/subscriptionCheck');
const verifyJWT = require('../middleware/auth');

/**
 * GET /api/subscriptions/status
 * Obtiene el estado de suscripción del tenant autenticado
 */
router.get('/status', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        if (!tenantId) {
            return res.status(400).json({
                ok: false,
                error: 'No se pudo determinar el tenant',
            });
        }

        const accessCheck = await canTenantUseApp(tenantId);

        res.json({
            ok: true,
            hasAccess: accessCheck.hasAccess,
            reason: accessCheck.reason,
            subscription: accessCheck.subscription,
        });

    } catch (error) {
        console.error('[Subscriptions] Error obteniendo status:', error);
        res.status(500).json({
            ok: false,
            error: 'Error obteniendo estado de suscripción',
        });
    }
});

/**
 * GET /api/subscriptions/plans
 * Obtiene los planes de suscripción disponibles
 */
router.get('/plans', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, descripcion, trial_dias_default, activo
       FROM plan_suscripcion
       WHERE activo = true
       ORDER BY id ASC`
        );

        res.json({
            ok: true,
            plans: result.rows,
        });

    } catch (error) {
        console.error('[Subscriptions] Error obteniendo planes:', error);
        res.status(500).json({
            ok: false,
            error: 'Error obteniendo planes',
        });
    }
});

/**
 * GET /api/subscriptions/my-subscription
 * Obtiene la suscripción actual del tenant autenticado
 */
router.get('/my-subscription', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const result = await pool.query(
            `SELECT 
        ts.*,
        ps.nombre as plan_nombre,
        ps.descripcion as plan_descripcion
       FROM tenant_suscripcion ts
       JOIN plan_suscripcion ps ON ts.plan_id = ps.id
       WHERE ts.tenant_id = $1
       ORDER BY ts.created_at DESC
       LIMIT 1`,
            [tenantId]
        );

        if (result.rows.length === 0) {
            return res.json({
                ok: true,
                subscription: null,
            });
        }

        res.json({
            ok: true,
            subscription: result.rows[0],
        });

    } catch (error) {
        console.error('[Subscriptions] Error obteniendo suscripción:', error);
        res.status(500).json({
            ok: false,
            error: 'Error obteniendo suscripción',
        });
    }
});

module.exports = router;
