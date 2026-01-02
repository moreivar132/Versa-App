/**
 * RBAC Middleware
 * Provides permission checking for Express routes
 */

const pool = require('../db');
const userModel = require('../models/userModel');
const roleModel = require('../models/roleModel');

/**
 * Check if user is super admin
 */
async function isSuperAdmin(userId) {
    const user = await userModel.getUserById(userId);
    return user?.is_super_admin === true;
}

/**
 * Get all permissions for a user in a specific tenant context
 */
async function getUserPermissions(userId, tenantId = null) {
    // If super admin, return bypass flag
    if (await isSuperAdmin(userId)) {
        return { isSuperAdmin: true, permissions: ['*'] };
    }

    // Get permissions through roles
    const result = await pool.query(`
        SELECT DISTINCT COALESCE(p.key, p.nombre) as permission_key
        FROM usuariorol ur
        JOIN rol r ON ur.id_rol = r.id
        JOIN rolpermiso rp ON rp.id_rol = r.id
        JOIN permiso p ON p.id = rp.id_permiso
        WHERE ur.id_usuario = $1
          AND (
              r.scope = 'global' 
              OR r.tenant_id IS NULL
              OR r.tenant_id = $2
              OR ur.tenant_id = $2
              OR ($2 IS NULL)
          )
    `, [userId, tenantId]);

    return {
        isSuperAdmin: false,
        permissions: result.rows.map(r => r.permission_key)
    };
}

/**
 * Check if user has a specific permission
 */
async function hasPermission(userId, tenantId, permissionKey) {
    // Super admin bypass
    if (await isSuperAdmin(userId)) {
        return true;
    }

    // Check via database function
    const result = await pool.query(
        'SELECT user_has_permission($1, $2, $3) as has_perm',
        [userId, tenantId, permissionKey]
    );

    return result.rows[0]?.has_perm === true;
}

/**
 * Express middleware factory - requires specific permission
 * @param {string} permissionKey - Permission to check (e.g., 'users.create')
 */
function requirePermission(permissionKey) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Autenticación requerida' });
            }

            // Get tenant from request (header, query, or body)
            const tenantId = req.headers['x-tenant-id']
                || req.query.tenantId
                || req.body?.id_tenant
                || req.user?.id_tenant;

            const allowed = await hasPermission(userId, tenantId, permissionKey);

            if (!allowed) {
                return res.status(403).json({
                    error: 'Permiso denegado',
                    required: permissionKey
                });
            }

            // Attach permissions to request for downstream use
            req.userPermissions = await getUserPermissions(userId, tenantId);
            next();
        } catch (error) {
            console.error('RBAC middleware error:', error);
            res.status(500).json({ error: 'Error al verificar permisos' });
        }
    };
}

/**
 * Express middleware - requires super admin
 */
async function requireSuperAdmin(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }

        const isSuper = await isSuperAdmin(userId);
        if (!isSuper) {
            return res.status(403).json({
                error: 'Acceso denegado: Se requieren permisos de Super Admin'
            });
        }

        req.isSuperAdmin = true;
        next();
    } catch (error) {
        console.error('Super admin check error:', error);
        res.status(500).json({ error: 'Error al verificar permisos' });
    }
}

/**
 * Express middleware - requires access.manage OR super admin
 */
function requireAccessManage() {
    return requirePermission('access.manage');
}

/**
 * Helper function for use in routes (not middleware)
 * @param {object} user - User object from req.user
 * @param {number} tenantId - Tenant ID
 * @param {string} permissionKey - Permission to check
 */
async function can(user, tenantId, permissionKey) {
    if (!user?.id) return false;
    return hasPermission(user.id, tenantId, permissionKey);
}

/**
 * Get user's effective tenant (for non-super admins, enforces their assigned tenant)
 */
function getEffectiveTenant(req) {
    // Super admin can access any tenant from request
    if (req.isSuperAdmin || req.userPermissions?.isSuperAdmin) {
        return req.headers['x-tenant-id']
            || req.query.tenantId
            || req.body?.id_tenant
            || req.user?.id_tenant;
    }
    // Non-super admins are locked to their assigned tenant
    return req.user?.id_tenant;
}

/**
 * Validate that requested tenant matches user's tenant (for non-super admins)
 */
function validateTenantAccess(req, targetTenantId) {
    if (req.isSuperAdmin || req.userPermissions?.isSuperAdmin) {
        return true; // Super admins can access any tenant
    }
    return req.user?.id_tenant === targetTenantId;
}

module.exports = {
    isSuperAdmin,
    getUserPermissions,
    hasPermission,
    requirePermission,
    requireSuperAdmin,
    requireAccessManage,
    can,
    getEffectiveTenant,
    validateTenantAccess
};
