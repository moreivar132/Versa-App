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

/**
 * Middleware que establece el contexto de tenant en req.context
 * DEBE usarse DESPUÉS de verifyJWT (auth middleware)
 * 
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.required - Si es true, bloquea requests sin tenantId (default: true)
 */
function tenantContextMiddleware(options = {}) {
    const { required = true } = options;

    return (req, res, next) => {
        // Inicializar req.context si no existe (por si request-id no lo hizo)
        if (!req.context) {
            req.context = {};
        }

        // Si es ruta pública, continuar sin verificar tenant
        if (isPublicRoute(req.path)) {
            return next();
        }

        // Si no hay usuario autenticado, el auth middleware ya debió bloquear
        // pero por seguridad, verificamos
        if (!req.user) {
            // Si required es false, continuar (ruta semipública)
            if (!required) {
                return next();
            }
            return res.status(401).json({
                ok: false,
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
                requestId: req.requestId || req.context?.requestId
            });
        }

        // Obtener tenantId usando la lógica existente de rbac.js
        const tenantId = getEffectiveTenant(req);

        // Si no hay tenantId y es requerido, bloquear
        if (!tenantId && required) {
            return res.status(403).json({
                ok: false,
                error: 'Contexto de tenant no encontrado',
                code: 'TENANT_REQUIRED',
                requestId: req.requestId || req.context?.requestId
            });
        }

        // Establecer contexto con toda la información del usuario
        req.context.tenantId = tenantId;
        req.context.userId = req.user?.id;
        req.context.isSuperAdmin = req.user?.is_super_admin || req.isSuperAdmin || false;

        next();
    };
}

/**
 * Helper para obtener el tenantId del contexto de forma segura
 * @param {Object} req - Express request object
 * @returns {number|null}
 */
function getTenantId(req) {
    return req.context?.tenantId || req.user?.id_tenant || null;
}

/**
 * Helper para obtener el userId del contexto de forma segura
 * @param {Object} req - Express request object
 * @returns {number|null}
 */
function getUserId(req) {
    return req.context?.userId || req.user?.id || null;
}

module.exports = {
    tenantContextMiddleware,
    isPublicRoute,
    getTenantId,
    getUserId,
    PUBLIC_ROUTES
};
