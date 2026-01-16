/**
 * VERSA - Security Context Resolver
 * 
 * Unified security context for all requests. Centralizes the resolution of:
 * - User identity
 * - Tenant context
 * - Super admin status
 * - Active vertical
 * - Branch/sucursal scope
 * 
 * Usage:
 *   const ctx = resolveSecurityContext(req);
 *   if (ctx.isSuperAdmin) { ... }
 */

const { resolveTenantContext } = require('./tenant-context');
const pool = require('../../../db');

/**
 * Security context object
 * @typedef {Object} SecurityContext
 * @property {number|null} userId - Current user ID
 * @property {number|null} tenantId - Resolved tenant ID
 * @property {boolean} isSuperAdmin - Whether user is super admin
 * @property {boolean} isImpersonating - Whether super admin is impersonating a tenant
 * @property {string|null} verticalKey - Active vertical (if any)
 * @property {number|null} verticalId - Active vertical ID (if any)
 * @property {Array<number>} branchIds - User's accessible branch IDs
 * @property {Object} user - Raw user object from JWT
 */

/**
 * Resolve the complete security context for a request
 * 
 * @param {Object} req - Express request object
 * @returns {SecurityContext}
 */
function resolveSecurityContext(req) {
    const user = req.user || {};
    const tenantContext = resolveTenantContext(req);

    return {
        userId: user.id || null,
        tenantId: tenantContext.tenantId,
        isSuperAdmin: user.is_super_admin === true || req.isSuperAdmin === true,
        isImpersonating: tenantContext.isImpersonating,
        verticalKey: req.verticalKey || null,
        verticalId: req.verticalId || null,
        branchIds: req.allowedSucursales?.map(s => s.id) || [],
        user: user
    };
}

/**
 * Get user's accessible branches
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function getUserBranches(userId, tenantId) {
    const result = await pool.query(`
        SELECT s.id, s.nombre
        FROM sucursal s
        JOIN usuariosucursal us ON us.id_sucursal = s.id
        WHERE us.id_usuario = $1 AND s.id_tenant = $2
        ORDER BY s.nombre
    `, [userId, tenantId]);

    return result.rows;
}

/**
 * Get user's roles in a tenant
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @returns {Promise<Array<{id: number, nombre: string, key: string}>>}
 */
async function getUserRoles(userId, tenantId) {
    const result = await pool.query(`
        SELECT DISTINCT r.id, r.nombre, r.nombre as key
        FROM rol r
        JOIN usuariorol ur ON ur.id_rol = r.id
        WHERE ur.id_usuario = $1
          AND (r.tenant_id = $2 OR r.tenant_id IS NULL OR r.scope = 'global')
        ORDER BY r.nombre
    `, [userId, tenantId]);

    return result.rows;
}

/**
 * Get user's permissions in a tenant context
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @returns {Promise<Array<string>>}
 */
async function getUserPermissions(userId, tenantId) {
    // Check for super admin
    const userResult = await pool.query(
        'SELECT is_super_admin FROM usuario WHERE id = $1',
        [userId]
    );

    if (userResult.rows[0]?.is_super_admin === true) {
        return ['*']; // Super admin has all permissions
    }

    // Get permissions through roles, filtered by enabled verticals
    const result = await pool.query(`
        SELECT DISTINCT COALESCE(p.key, p.nombre) as permission_key
        FROM usuariorol ur
        JOIN rol r ON ur.id_rol = r.id
        JOIN rolpermiso rp ON rp.id_rol = r.id
        JOIN permiso p ON p.id = rp.id_permiso
        LEFT JOIN vertical v ON v.id = p.vertical_id
        LEFT JOIN tenant_vertical tv ON tv.vertical_id = v.id AND tv.tenant_id = $2
        WHERE ur.id_usuario = $1
          AND (
              r.scope = 'global' 
              OR r.tenant_id IS NULL
              OR r.tenant_id = $2
              OR ur.tenant_id = $2
          )
          AND (
              p.vertical_id IS NULL  -- Permission without vertical (global)
              OR tv.is_enabled = true  -- Or vertical is enabled for tenant
          )
        ORDER BY permission_key
    `, [userId, tenantId]);

    // Also check for explicit overrides
    const overrides = await pool.query(`
        SELECT 
            COALESCE(p.key, p.nombre) as permission_key,
            upo.effect
        FROM user_permission_override upo
        JOIN permiso p ON p.id = upo.permission_id
        WHERE upo.user_id = $1 AND upo.tenant_id = $2
          AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
    `, [userId, tenantId]);

    // Build final permission set
    const permissions = new Set(result.rows.map(r => r.permission_key));

    for (const override of overrides.rows) {
        if (override.effect === 'deny') {
            permissions.delete(override.permission_key);
        } else if (override.effect === 'allow') {
            permissions.add(override.permission_key);
        }
    }

    return Array.from(permissions);
}

/**
 * Build complete access info for a user (for /api/me/access endpoint)
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @returns {Promise<Object>}
 */
async function buildUserAccessInfo(userId, tenantId) {
    const { getUserAccessibleVerticals } = require('./requireVerticalAccess');

    const [verticals, permissions, branches, roles] = await Promise.all([
        getUserAccessibleVerticals(userId, tenantId),
        getUserPermissions(userId, tenantId),
        getUserBranches(userId, tenantId),
        getUserRoles(userId, tenantId)
    ]);

    return {
        verticals,
        permissions,
        branches,
        roles
    };
}

module.exports = {
    resolveSecurityContext,
    getUserBranches,
    getUserRoles,
    getUserPermissions,
    buildUserAccessInfo
};
