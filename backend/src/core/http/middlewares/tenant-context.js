/**
 * Tenant Context Middleware
 * Garantiza que toda ruta privada tenga un tenantId válido en req.context.
 * 
 * INTEGRACIÓN:
 * - Se usa DESPUÉS de verifyJWT (auth) en rutas privadas
 * - Se excluyen las rutas públicas (login, webhooks, health, etc.)
 * 
 * REUTILIZA: lógica de getEffectiveTenant de rbac.js
 */

const { getEffectiveTenant } = require('../../../../middleware/rbac');

/**
 * Lista de prefijos de rutas públicas que NO requieren tenantId
 * Estas rutas son accesibles sin autenticación o son webhooks externos
 */
const PUBLIC_ROUTES = [
    '/api/auth',                    // Login, register, refresh token
    '/api/cliente/auth',            // Customer auth (login cliente)
    '/api/portal',                  // Portal citas (usa customerAuth separado)
    '/api/stripe/webhook',          // Webhook Stripe (sin auth, firma propia)
    '/api/public',                  // Rutas públicas genéricas
    '/api/marketplace',             // Marketplace público (búsqueda, detalle)
    '/api/db-test',                 // Health check
    '/api/uploads',                 // Archivos estáticos
    '/health',                      // Health endpoint
];

/**
 * Verifica si una ruta es pública (no requiere tenantId)
 * @param {string} path - Path de la request
 * @returns {boolean}
 */
function isPublicRoute(path) {
    return PUBLIC_ROUTES.some(prefix => path.startsWith(prefix));
}

const { resolveTenantContext } = require('../../security/tenant-context');

/**
 * Middleware que establece el contexto de tenant en req.ctx
 * DEBE usarse DESPUÉS de verifyJWT (auth middleware)
 * 
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.required - Si es true, bloquea requests sin tenantId (default: true)
 */
function tenantContextMiddleware(options = {}) {
    const { required = true } = options;

    return (req, res, next) => {
        // Inicializar req.ctx si no existe
        if (!req.ctx) {
            req.ctx = {
                requestId: req.requestId,
                timestamp: new Date().toISOString()
            };
        }

        // Si es ruta pública, continuar sin verificar tenant
        if (isPublicRoute(req.path)) {
            return next();
        }

        if (!req.user) {
            if (!required) return next();
            return res.status(401).json({
                ok: false,
                error: 'Autenticación requerida',
                requestId: req.requestId
            });
        }

        // Resolver tenant usando el componente de seguridad
        const { tenantId, isImpersonating, source } = resolveTenantContext(req);

        if (!tenantId && required) {
            return res.status(403).json({
                ok: false,
                error: 'Contexto de tenant no encontrado',
                requestId: req.requestId
            });
        }

        // Asignar al contexto único req.ctx
        req.ctx.tenantId = tenantId;
        req.ctx.userId = req.user.id;
        req.ctx.isSuperAdmin = req.user.is_super_admin === true;
        req.ctx.isImpersonating = isImpersonating;
        req.ctx.tenantSource = source;

        next();
    };
}

/**
 * Helper para obtener el tenantId del contexto de forma segura
 * @param {Object} req - Express request object
 * @returns {number|null}
 */
function getTenantId(req) {
    return req.ctx?.tenantId || req.user?.id_tenant || null;
}

/**
 * Helper para obtener el userId del contexto de forma segura
 * @param {Object} req - Express request object
 * @returns {number|null}
 */
function getUserId(req) {
    return req.ctx?.userId || req.user?.id || null;
}

module.exports = {
    tenantContextMiddleware,
    isPublicRoute,
    getTenantId,
    getUserId,
    PUBLIC_ROUTES
};
