// middleware/subscriptionCheck.js
/**
 * Middleware para verificar si un tenant tiene una suscripción activa
 */

const pool = require('../db');

/**
 * Verifica si un tenant tiene acceso a la aplicación
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<Object>} { hasAccess: boolean, reason: string, subscription: object }
 */
async function canTenantUseApp(tenantId) {
    try {
        // Buscar la suscripción más reciente del tenant
        const result = await pool.query(
            `SELECT * FROM tenant_suscripcion 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
            [tenantId]
        );

        // Si no hay suscripción, no tiene acceso
        if (result.rows.length === 0) {
            return {
                hasAccess: false,
                reason: 'No tienes una suscripción activa. Por favor, suscríbete a un plan.',
                subscription: null,
            };
        }

        const subscription = result.rows[0];
        const now = new Date();

        // Verificar si está en trial vigente
        if (subscription.status === 'trialing') {
            const trialEnd = new Date(subscription.trial_end_at);
            if (trialEnd >= now) {
                return {
                    hasAccess: true,
                    reason: 'trial_active',
                    subscription,
                };
            } else {
                return {
                    hasAccess: false,
                    reason: 'Tu período de prueba ha caducado. Por favor, actualiza tu plan.',
                    subscription,
                };
            }
        }

        // Verificar si está activa
        if (subscription.status === 'active') {
            const periodEnd = new Date(subscription.current_period_end);
            if (periodEnd >= now) {
                return {
                    hasAccess: true,
                    reason: 'subscription_active',
                    subscription,
                };
            } else {
                return {
                    hasAccess: false,
                    reason: 'Tu suscripción ha caducado. Por favor, renueva tu plan.',
                    subscription,
                };
            }
        }

        // Otros estados (past_due, canceled, etc.)
        let reason = 'Tu suscripción no está activa.';

        if (subscription.status === 'past_due') {
            reason = 'Tu último pago falló. Por favor, actualiza tu método de pago.';
        } else if (subscription.status === 'canceled') {
            reason = 'Tu suscripción ha sido cancelada. Por favor, renueva tu plan.';
        } else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
            reason = 'Tu suscripción no se pudo completar. Por favor, intenta de nuevo.';
        } else if (subscription.status === 'unpaid') {
            reason = 'Tienes pagos pendientes. Por favor, actualiza tu método de pago.';
        }

        return {
            hasAccess: false,
            reason,
            subscription,
        };

    } catch (error) {
        console.error('[SubscriptionCheck] Error verificando suscripción:', error);
        return {
            hasAccess: false,
            reason: 'Error verificando suscripción. Por favor, contacta con soporte.',
            subscription: null,
        };
    }
}

/**
 * Middleware Express para verificar acceso del tenant
 * Espera que el tenantId esté en req.user.tenant_id (debe usarse después del middleware de autenticación)
 */
async function requireActiveSubscription(req, res, next) {
    try {
        // Verificar que haya un usuario autenticado
        if (!req.user || !req.user.tenant_id) {
            return res.status(401).json({
                ok: false,
                error: 'No autenticado',
            });
        }

        const tenantId = req.user.tenant_id;
        const accessCheck = await canTenantUseApp(tenantId);

        if (!accessCheck.hasAccess) {
            return res.status(402).json({
                ok: false,
                error: accessCheck.reason,
                subscriptionStatus: accessCheck.subscription ? accessCheck.subscription.status : null,
                needsPayment: true,
            });
        }

        // Agregar información de la suscripción al request para uso posterior
        req.subscription = accessCheck.subscription;
        next();

    } catch (error) {
        console.error('[SubscriptionCheck] Error en middleware:', error);
        return res.status(500).json({
            ok: false,
            error: 'Error verificando suscripción',
        });
    }
}

/**
 * Middleware más suave que solo agrega info de suscripción pero no bloquea
 * Útil para rutas donde quieras mostrar avisos pero no bloquear totalmente
 */
async function addSubscriptionInfo(req, res, next) {
    try {
        if (req.user && req.user.tenant_id) {
            const accessCheck = await canTenantUseApp(req.user.tenant_id);
            req.subscriptionInfo = accessCheck;
        }
        next();
    } catch (error) {
        console.error('[SubscriptionCheck] Error agregando info de suscripción:', error);
        next(); // Continuar aunque haya error
    }
}

module.exports = {
    canTenantUseApp,
    requireActiveSubscription,
    addSubscriptionInfo,
};
