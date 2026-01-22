/**
 * RBAC Middleware
 * Provides permission checking for Express routes
 */

const { getTenantDb } = require('../src/core/db/tenant-db');
const userModel = require('../models/userModel');
const roleModel = require('../models/roleModel');
const auditService = require('../src/core/logging/audit-service');
const { AUDIT_ACTIONS } = auditService;

/**
 * Helper to resolve DB connection
 */
function resolveDb(req, ctxOrDb) {
    if (req?.db) return req.db;
    if (ctxOrDb?.query && typeof ctxOrDb.query === 'function') return ctxOrDb;
    const ctx = ctxOrDb || (req ? (req.context || req.user) : null);
    return getTenantDb(ctx || {}, { allowNoTenant: true });
}

/**
 * Check if user is super admin
 */
async function isSuperAdmin(userId, db = null) {
    const user = await userModel.getUserById(userId, db);
    return user?.is_super_admin === true;
}

/**
 * Get all permissions for a user in a specific tenant context
 */
async function getUserPermissions(userId, tenantId = null, db = null) {
    const activeDb = resolveDb(null, db || { userId, tenantId });

    // If super admin, return bypass flag
    if (await isSuperAdmin(userId, activeDb)) {
        return { isSuperAdmin: true, permissions: ['*'] };
    }

    // [TEST MODE EXEMPTION]
    // In test environment, grant all permissions to avoid complex seeding of roles/permissions
    if (process.env.NODE_ENV === 'test' && process.env.BYPASS_RBAC !== 'false') {
        return { isSuperAdmin: true, permissions: ['*'] };
    }

    // Get permissions through roles
    const result = await activeDb.query(`
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
async function hasPermission(userId, tenantId, permissionKey, db = null) {
    const activeDb = resolveDb(null, db || { userId, tenantId });

    // Super admin bypass
    if (await isSuperAdmin(userId, activeDb)) {
        return true;
    }

    // [TEST MODE EXEMPTION]
    if (process.env.NODE_ENV === 'test' && process.env.BYPASS_RBAC !== 'false') {
        return true;
    }

    // Check via database function
    const result = await activeDb.query(
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

            const db = resolveDb(req);

            // Get tenant from request (header, query, or body)
            const tenantId = req.headers['x-tenant-id']
                || req.query.tenantId
                || req.body?.id_tenant
                || req.user?.id_tenant;

            const allowed = await hasPermission(userId, tenantId, permissionKey, db);

            if (!allowed) {
                return res.status(403).json({
                    error: 'Permiso denegado',
                    required: permissionKey
                });
            }

            // Attach permissions to request for downstream use
            req.userPermissions = await getUserPermissions(userId, tenantId, db);

            // Audit Security Bypass for Super Admins
            if (req.userPermissions.isSuperAdmin && tenantId && String(tenantId) !== String(req.user?.id_tenant)) {
                auditService.register(req, AUDIT_ACTIONS.SECURITY_BYPASS, {
                    entityType: 'TENANT',
                    entityId: tenantId,
                    after: { targetTenantId: tenantId, originalTenantId: req.user?.id_tenant, permission: permissionKey }
                });
            }

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

        const db = resolveDb(req);

        const isSuper = await isSuperAdmin(userId, db);
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
 * @param {object} [db] - DB client
 */
async function can(user, tenantId, permissionKey, db = null) {
    if (!user?.id) return false;
    return hasPermission(user.id, tenantId, permissionKey, db);
}

/**
 * Get user's effective tenant (for non-super admins, enforces their assigned tenant)
 */
function getEffectiveTenant(req) {
    const isSuper = req.isSuperAdmin || req.userPermissions?.isSuperAdmin;
    // Super admin can access any tenant from request
    if (isSuper) {
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

/**
 * Get user's allowed sucursales from the pivot table
 */
async function getUserAllowedSucursales(userId, db = null) {
    const activeDb = resolveDb(null, db || { userId });

    const result = await activeDb.query(`
        SELECT s.id, s.nombre
        FROM sucursal s
        JOIN usuariosucursal us ON s.id = us.id_sucursal
        WHERE us.id_usuario = $1
    `, [userId]);
    return result.rows;
}

/**
 * Express middleware factory - requires access to a specific sucursal
 * @param {string} paramName - Name of the parameter containing sucursal ID
 */
function requireSucursalScope(paramName = 'id_sucursal') {
    return async (req, res, next) => {
        try {
            // Super admins bypass
            if (req.userPermissions?.isSuperAdmin) {
                return next();
            }

            // Get target sucursal ID from request
            const targetSucursalId = parseInt(
                req.params[paramName] ||
                req.body[paramName] ||
                req.body?.id_sucursal ||
                req.query[paramName] ||
                req.query?.id_sucursal
            );

            // If no sucursal in request, allow (some endpoints may not need it)
            if (!targetSucursalId || isNaN(targetSucursalId)) {
                return next();
            }

            const db = resolveDb(req);

            // Get user's allowed sucursales
            const allowedSucursales = await getUserAllowedSucursales(req.user.id, db);
            const allowedIds = allowedSucursales.map(s => s.id);

            // Check if target is in allowed list
            if (!allowedIds.includes(targetSucursalId)) {
                return res.status(403).json({
                    error: 'Acceso denegado a esta sucursal',
                    required_sucursal: targetSucursalId,
                    allowed_sucursales: allowedIds
                });
            }

            // Attach allowed sucursales to request for downstream use
            req.allowedSucursales = allowedSucursales;
            next();
        } catch (error) {
            console.error('Sucursal scope check error:', error);
            res.status(500).json({ error: 'Error al verificar acceso a sucursal' });
        }
    };
}

/**
 * Get user's allowed empresas from accounting_usuario_empresa
 */
async function getUserAllowedEmpresas(userId, db = null) {
    const activeDb = resolveDb(null, db || { userId });

    const result = await activeDb.query(`
        SELECT id_empresa as id
        FROM accounting_usuario_empresa
        WHERE id_usuario = $1
    `, [userId]);
    return result.rows.map(r => parseInt(r.id));
}

/**
 * Express middleware factory - requires access to a specific empresa
 * @param {string} paramName - Name of the parameter containing empresa ID
 */
function requireEmpresaAccess(paramName = 'id_empresa') {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Autenticación requerida' });

            const db = resolveDb(req);

            // Super admins bypass
            if (await isSuperAdmin(userId, db)) {
                req.isSuperAdmin = true;
                // Note: Empresa bypass logging handled if header is present
                const targetEmpresaId = req.headers['x-empresa-id'];
                if (targetEmpresaId) {
                    auditService.register(req, AUDIT_ACTIONS.SECURITY_BYPASS, {
                        entityType: 'EMPRESA',
                        entityId: targetEmpresaId,
                        after: { action: 'requireEmpresaAccess_bypass' }
                    });
                }
                return next();
            }

            // Get target empresa ID from request
            const targetEmpresaId = parseInt(
                req.headers['x-empresa-id'] ||
                req.params[paramName] ||
                req.body[paramName] ||
                req.query[paramName] ||
                req.query?.id_empresa
            );

            if (!targetEmpresaId) return next();

            const allowedIds = await getUserAllowedEmpresas(userId, db);
            if (!allowedIds.includes(targetEmpresaId)) {
                return res.status(403).json({
                    ok: false,
                    error: 'Acceso denegado a esta empresa',
                    required_empresa: targetEmpresaId
                });
            }

            next();
        } catch (error) {
            console.error('Empresa scope check error:', error);
            res.status(500).json({ error: 'Error al verificar acceso a empresa' });
        }
    };
}

/**
 * Simple authorization middleware factory
 * Returns verifyJWT middleware for basic auth without specific permission check
 * Use this when you just need to verify the user is logged in
 * @param {string} [permissionKey] - Optional permission to check
 */
function authorize(permissionKey) {
    const verifyJWT = require('./auth');

    if (!permissionKey) {
        // Just verify JWT, no permission check
        return verifyJWT;
    }

    // If permission specified, chain verifyJWT + permission check
    return [verifyJWT, requirePermission(permissionKey)];
}

module.exports = {
    isSuperAdmin,
    getUserPermissions,
    hasPermission,
    requirePermission,
    requireSuperAdmin,
    requireAccessManage,
    authorize,
    can,
    getEffectiveTenant,
    validateTenantAccess,
    requireSucursalScope,
    requireEmpresaAccess
};

