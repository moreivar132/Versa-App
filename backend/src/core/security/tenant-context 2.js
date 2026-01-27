/**
 * Tenant Context Resolver
 * 
 * Centraliza la lógica de identificación de tenant y superadmin impersonation.
 */

const logger = require('../logging/logger');

/**
 * Resuelve el contexto de tenant para una request dada.
 * 
 * Reglas:
 * 1. Usuarios normales: Siempre usan el id_tenant del JWT.
 * 2. SuperAdmin: Pueden usar x-tenant-id (header), tenantId (query), o id_tenant (body).
 * 
 * @param {Object} req - Express request
 * @returns {Object} { tenantId, isImpersonating, source }
 */
function resolveTenantContext(req) {
    const user = req.user;
    if (!user) {
        return { tenantId: null, isImpersonating: false, source: 'none' };
    }

    const isSuperAdmin = user.is_super_admin === true || user.role === 'SUPER_ADMIN';
    const jwtTenantId = user.id_tenant || user.tenant_id;

    if (!isSuperAdmin) {
        return {
            tenantId: jwtTenantId,
            isImpersonating: false,
            source: 'jwt'
        };
    }

    // Lógica para SuperAdmin (Impersonation)
    const headerTenantId = req.headers['x-tenant-id'];
    const queryTenantId = req.query.tenantId;
    const bodyTenantId = req.body?.id_tenant;

    const overrideTenantId = headerTenantId || queryTenantId || bodyTenantId;

    if (overrideTenantId && overrideTenantId != jwtTenantId) {
        const source = headerTenantId ? 'header' : (queryTenantId ? 'query' : 'body');

        // Log impersonation event
        logger.warn({
            requestId: req.requestId,
            userId: user.id,
            impersonatedTenantId: overrideTenantId,
            source: source,
            action: 'TENANT_IMPERSONATION'
        }, `SuperAdmin impersonating tenant ${overrideTenantId} via ${source}`);

        return {
            tenantId: overrideTenantId,
            isImpersonating: true,
            source: source
        };
    }

    return {
        tenantId: jwtTenantId,
        isImpersonating: false,
        source: 'jwt'
    };
}

module.exports = {
    resolveTenantContext
};
