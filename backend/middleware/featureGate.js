/**
 * VERSA - Feature Gate Middleware
 * Middleware para controlar acceso a features según plan de suscripción
 */
const pool = require('../db');

/**
 * Cache simple en memoria para evitar consultas repetidas
 * Se limpia cada 5 minutos
 */
const planCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

setInterval(() => {
    planCache.clear();
}, CACHE_TTL);

/**
 * Obtener el plan actual de un tenant (con cache)
 * @param {number} tenantId
 * @returns {Object|null} Plan con features
 */
async function getTenantPlan(tenantId) {
    const cacheKey = `tenant:${tenantId}`;

    // Verificar cache
    if (planCache.has(cacheKey)) {
        const cached = planCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.plan;
        }
    }

    try {
        const result = await pool.query(`
            SELECT 
                ps.id,
                ps.nombre,
                ps.incluye_marketplace,
                ps.incluye_crm,
                ps.features_json,
                ts.status AS subscription_status
            FROM tenant_suscripcion ts
            JOIN plan_suscripcion ps ON ts.plan_id = ps.id
            WHERE ts.tenant_id = $1
        `, [tenantId]);

        const plan = result.rows[0] || null;

        // Guardar en cache
        planCache.set(cacheKey, {
            plan,
            timestamp: Date.now()
        });

        return plan;
    } catch (error) {
        console.error('Error obteniendo plan del tenant:', error.message);
        return null;
    }
}

/**
 * Middleware factory para validar acceso a features
 * @param {string} feature - 'marketplace' | 'crm' | 'api_access' | etc
 * @returns {Function} Middleware de Express
 */
function featureGate(feature) {
    return async (req, res, next) => {
        try {
            // SUPER ADMIN BYPASS - never restricted by features
            if (req.user?.is_super_admin || req.isSuperAdmin) {
                req.tenantPlan = { name: 'SUPER_ADMIN_BYPASS', features_json: {} };
                return next();
            }

            // Check is_super_admin from database if not already set
            if (req.user?.id) {
                const { isSuperAdmin } = require('./subscriptionCheck');
                if (await isSuperAdmin(req.user.id)) {
                    req.isSuperAdmin = true;
                    req.tenantPlan = { name: 'SUPER_ADMIN_BYPASS', features_json: {} };
                    return next();
                }
            }

            // Obtener tenantId del request (puede venir de auth o params)
            const tenantId = req.tenantId || req.user?.tenantId || req.user?.tenant_id || req.params?.tenantId;

            if (!tenantId) {
                return res.status(401).json({
                    error: 'Tenant no identificado',
                    code: 'TENANT_REQUIRED'
                });
            }

            // Obtener plan del tenant
            const plan = await getTenantPlan(tenantId);

            if (!plan) {
                return res.status(403).json({
                    error: 'Sin suscripción activa',
                    code: 'NO_SUBSCRIPTION'
                });
            }

            // Verificar estado de la suscripción
            const activeStates = ['active', 'trialing'];
            if (!activeStates.includes(plan.subscription_status)) {
                return res.status(403).json({
                    error: 'Suscripción no activa',
                    code: 'SUBSCRIPTION_INACTIVE',
                    status: plan.subscription_status
                });
            }

            // Verificar feature específico
            let hasAccess = false;

            switch (feature) {
                case 'marketplace':
                    hasAccess = plan.incluye_marketplace === true;
                    break;
                case 'crm':
                    hasAccess = plan.incluye_crm === true;
                    break;
                case 'api_access':
                    hasAccess = plan.features_json?.api_access === true;
                    break;
                default:
                    // Para features en features_json
                    hasAccess = plan.features_json?.[feature] === true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    error: `Tu plan (${plan.nombre}) no incluye acceso a ${feature}`,
                    code: 'FEATURE_NOT_INCLUDED',
                    feature,
                    currentPlan: plan.nombre,
                    upgrade: true
                });
            }

            // Feature disponible, añadir info al request
            req.tenantPlan = plan;
            next();

        } catch (error) {
            console.error('Error en featureGate:', error.message);
            return res.status(500).json({
                error: 'Error verificando acceso',
                code: 'FEATURE_GATE_ERROR'
            });
        }
    };
}

/**
 * Middleware para verificar múltiples features (requiere todos)
 * @param {string[]} features - Array de features requeridos
 */
function requireAllFeatures(features) {
    return async (req, res, next) => {
        const tenantId = req.tenantId || req.user?.tenantId;

        if (!tenantId) {
            return res.status(401).json({ error: 'Tenant no identificado' });
        }

        const plan = await getTenantPlan(tenantId);

        if (!plan) {
            return res.status(403).json({ error: 'Sin suscripción activa' });
        }

        const missingFeatures = features.filter(f => {
            if (f === 'marketplace') return !plan.incluye_marketplace;
            if (f === 'crm') return !plan.incluye_crm;
            return !plan.features_json?.[f];
        });

        if (missingFeatures.length > 0) {
            return res.status(403).json({
                error: 'Features no disponibles en tu plan',
                code: 'FEATURES_NOT_INCLUDED',
                missingFeatures,
                currentPlan: plan.nombre
            });
        }

        req.tenantPlan = plan;
        next();
    };
}

/**
 * Helper para verificar acceso sin middleware (para uso interno)
 * @param {number} tenantId
 * @param {string} feature
 * @returns {Promise<boolean>}
 */
async function checkFeatureAccess(tenantId, feature) {
    const plan = await getTenantPlan(tenantId);

    if (!plan) return false;

    const activeStates = ['active', 'trialing'];
    if (!activeStates.includes(plan.subscription_status)) return false;

    switch (feature) {
        case 'marketplace':
            return plan.incluye_marketplace === true;
        case 'crm':
            return plan.incluye_crm === true;
        default:
            return plan.features_json?.[feature] === true;
    }
}

/**
 * Limpiar cache para un tenant específico
 * @param {number} tenantId
 */
function clearPlanCache(tenantId) {
    planCache.delete(`tenant:${tenantId}`);
}

module.exports = {
    featureGate,
    requireAllFeatures,
    checkFeatureAccess,
    getTenantPlan,
    clearPlanCache
};
