/**
 * VERSA - User Access API Routes
 * 
 * Provides the /api/me/access endpoint for frontend to get current user's
 * verticals, permissions, branches, and roles.
 */

const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const { buildUserAccessInfo } = require('../src/core/security/context');
const { resolveTenantContext } = require('../src/core/security/tenant-context');
const logger = require('../src/core/logging/logger');

/**
 * GET /api/me/access
 * 
 * Returns the current user's access information including:
 * - verticals: accessible verticals with enabled status
 * - permissions: list of permission keys
 * - branches: accessible branches/sucursales
 * - roles: assigned roles
 * 
 * @returns {Object} User access info
 */
router.get('/access', verifyJWT, async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Usuario no autenticado',
                code: 'AUTH_REQUIRED'
            });
        }

        const { tenantId } = resolveTenantContext(req);

        if (!tenantId) {
            return res.status(400).json({
                error: 'Tenant no identificado',
                code: 'TENANT_REQUIRED'
            });
        }

        const accessInfo = await buildUserAccessInfo(userId, tenantId);

        // Log access info request for debugging
        logger.debug({
            userId,
            tenantId,
            verticalsCount: accessInfo.verticals.length,
            permissionsCount: accessInfo.permissions.length,
            branchesCount: accessInfo.branches.length,
            rolesCount: accessInfo.roles.length
        }, 'User access info requested');

        res.json(accessInfo);

    } catch (error) {
        logger.error({
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        }, 'Error fetching user access info');

        res.status(500).json({
            error: 'Error obteniendo información de acceso',
            code: 'ACCESS_INFO_ERROR'
        });
    }
});

/**
 * GET /api/me/profile
 * 
 * Returns basic user profile info
 */
router.get('/profile', verifyJWT, async (req, res) => {
    try {
        const pool = require('../db');
        const userId = req.user?.id;

        const result = await pool.query(`
            SELECT 
                u.id,
                u.email,
                u.nombre,
                u.is_super_admin,
                u.id_tenant,
                t.nombre as tenant_nombre
            FROM usuario u
            LEFT JOIN tenant t ON t.id = u.id_tenant
            WHERE u.id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const user = result.rows[0];

        res.json({
            id: user.id,
            email: user.email,
            name: user.nombre,
            isSuperAdmin: user.is_super_admin,
            tenantId: user.id_tenant,
            tenantName: user.tenant_nombre
        });

    } catch (error) {
        logger.error({
            error: error.message,
            userId: req.user?.id
        }, 'Error fetching user profile');

        res.status(500).json({
            error: 'Error obteniendo perfil de usuario',
            code: 'PROFILE_ERROR'
        });
    }
});

/**
 * GET /api/me/can/:permission
 * 
 * Quick check if user has a specific permission
 */
router.get('/can/:permission', verifyJWT, async (req, res) => {
    try {
        const { hasPermission } = require('../middleware/rbac');
        const userId = req.user?.id;
        const { tenantId } = resolveTenantContext(req);
        const permission = req.params.permission;

        const allowed = await hasPermission(userId, tenantId, permission);

        res.json({
            permission,
            allowed
        });

    } catch (error) {
        logger.error({
            error: error.message,
            userId: req.user?.id,
            permission: req.params.permission
        }, 'Error checking permission');

        res.status(500).json({
            error: 'Error verificando permiso',
            code: 'PERMISSION_CHECK_ERROR'
        });
    }
});

module.exports = router;
