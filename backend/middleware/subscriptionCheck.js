// middleware/subscriptionCheck.js
/**
 * Middleware para verificar si un tenant tiene una suscripción activa
 * 
 * Features:
 * - Super Admin bypass (is_super_admin = true)
 * - Configurable allowed statuses
 * - Past due grace period support
 */

const pool = require('../db');

/**
 * Check if user is super admin (bypasses all subscription checks)
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isSuperAdmin(userId) {
    if (!userId) return false;

    try {
        const result = await pool.query(
            'SELECT is_super_admin FROM usuario WHERE id = $1',
            [userId]
        );
        return result.rows[0]?.is_super_admin === true;
    } catch (error) {
        console.error('[SubscriptionCheck] Error checking super admin:', error);
        return false;
    }
}

/**
 * Verifica si un tenant tiene acceso a la aplicación
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<Object>} { hasAccess: boolean, reason: string, subscription: object, accessLevel: string }
 */
async function canTenantUseApp(tenantId) {
    try {
        // Buscar la suscripción más reciente del tenant
        const result = await pool.query(
            `SELECT ts.*, ps.plan_key, ps.nombre as plan_nombre, ps.features_json
             FROM tenant_suscripcion ts
             LEFT JOIN plan_suscripcion ps ON ts.plan_id = ps.id
             WHERE ts.tenant_id = $1 
             ORDER BY ts.created_at DESC 
             LIMIT 1`,
            [tenantId]
        );

        // Si no hay suscripción, no tiene acceso
        if (result.rows.length === 0) {
            return {
                hasAccess: false,
                reason: 'No tienes una suscripción activa. Por favor, suscríbete a un plan.',
                subscription: null,
                accessLevel: 'none',
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
                    accessLevel: 'full',
                };
            } else {
                return {
                    hasAccess: false,
                    reason: 'Tu período de prueba ha caducado. Por favor, actualiza tu plan.',
                    subscription,
                    accessLevel: 'blocked',
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
                    accessLevel: 'full',
                };
            } else {
                return {
                    hasAccess: false,
                    reason: 'Tu suscripción ha caducado. Por favor, renueva tu plan.',
                    subscription,
                    accessLevel: 'blocked',
                };
            }
        }

        // Past due - limited access
        if (subscription.status === 'past_due') {
            // Check grace period
            const graceUntil = subscription.grace_until ? new Date(subscription.grace_until) : null;
            if (graceUntil && graceUntil >= now) {
                return {
                    hasAccess: true,
                    reason: 'Tu último pago falló. Por favor, actualiza tu método de pago.',
                    subscription,
                    accessLevel: 'limited',
                };
            }
            return {
                hasAccess: false,
                reason: 'Tu último pago falló. Por favor, actualiza tu método de pago.',
                subscription,
                accessLevel: 'limited', // Can still access billing
            };
        }

        // Otros estados (canceled, unpaid, incomplete, etc.)
        let reason = 'Tu suscripción no está activa.';
        let accessLevel = 'blocked';

        if (subscription.status === 'canceled') {
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
            accessLevel,
        };

    } catch (error) {
        console.error('[SubscriptionCheck] Error verificando suscripción:', error);
        return {
            hasAccess: false,
            reason: 'Error verificando suscripción. Por favor, contacta con soporte.',
            subscription: null,
            accessLevel: 'error',
        };
    }
}

/**
 * Middleware Express para verificar acceso del tenant
 * Incluye BYPASS para super_admin
 */
async function requireActiveSubscription(req, res, next) {
    try {
        // SUPER ADMIN BYPASS
        if (req.user?.is_super_admin || await isSuperAdmin(req.user?.id)) {
            req.subscription = { status: 'bypass', isSuperAdmin: true };
            req.isSuperAdmin = true;
            return next();
        }

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
                subscriptionStatus: accessCheck.subscription?.status || null,
                accessLevel: accessCheck.accessLevel,
                needsPayment: true,
            });
        }

        // Agregar información de la suscripción al request
        req.subscription = accessCheck.subscription;
        req.accessLevel = accessCheck.accessLevel;
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
 * Middleware factory - requires specific subscription statuses
 * @param {string[]} allowedStatuses - e.g., ['active', 'trialing', 'past_due']
 */
function requireSubscription(allowedStatuses = ['active', 'trialing']) {
    return async (req, res, next) => {
        try {
            // SUPER ADMIN BYPASS
            if (req.user?.is_super_admin || await isSuperAdmin(req.user?.id)) {
                req.subscription = { status: 'bypass', isSuperAdmin: true };
                req.isSuperAdmin = true;
                return next();
            }

            if (!req.user?.tenant_id) {
                return res.status(401).json({
                    ok: false,
                    error: 'No autenticado',
                });
            }

            const accessCheck = await canTenantUseApp(req.user.tenant_id);

            if (!accessCheck.subscription) {
                return res.status(402).json({
                    ok: false,
                    error: 'No tienes una suscripción.',
                    needsPayment: true,
                });
            }

            const currentStatus = accessCheck.subscription.status;

            if (!allowedStatuses.includes(currentStatus)) {
                return res.status(402).json({
                    ok: false,
                    error: accessCheck.reason,
                    subscriptionStatus: currentStatus,
                    allowedStatuses,
                    needsPayment: true,
                });
            }

            req.subscription = accessCheck.subscription;
            req.accessLevel = accessCheck.accessLevel;
            next();

        } catch (error) {
            console.error('[SubscriptionCheck] Error en requireSubscription:', error);
            return res.status(500).json({
                ok: false,
                error: 'Error verificando suscripción',
            });
        }
    };
}

/**
 * Middleware más suave que solo agrega info de suscripción pero no bloquea
 * Útil para rutas donde quieras mostrar avisos pero no bloquear totalmente
 */
async function addSubscriptionInfo(req, res, next) {
    try {
        // Super admin check
        if (req.user?.is_super_admin || await isSuperAdmin(req.user?.id)) {
            req.subscriptionInfo = { hasAccess: true, isSuperAdmin: true };
            req.isSuperAdmin = true;
            return next();
        }

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

/**
 * Get access level based on subscription status
 * @param {string} status - Subscription status
 * @returns {'full' | 'limited' | 'blocked'}
 */
function getAccessLevel(status) {
    const fullAccess = ['active', 'trialing'];
    const limitedAccess = ['past_due'];

    if (fullAccess.includes(status)) return 'full';
    if (limitedAccess.includes(status)) return 'limited';
    return 'blocked';
}

module.exports = {
    isSuperAdmin,
    canTenantUseApp,
    requireActiveSubscription,
    requireSubscription,
    addSubscriptionInfo,
    getAccessLevel,
};
