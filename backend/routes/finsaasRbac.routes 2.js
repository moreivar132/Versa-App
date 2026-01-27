/**
 * FinSaaS RBAC Routes
 * Admin panel for managing user roles and access
 * 
 * SECURITY: All routes require TENANT_ADMIN permission (finsaas.rbac.manage)
 * 
 * Mounted at: /api/finsaas/admin/rbac
 */

const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { getTenantDb } = require('../src/core/db/tenant-db');
const { tenantContextMiddleware } = require('../src/core/http/middlewares/tenant-context');
const finsaasRbacController = require('../src/modules/contable/api/controllers/finsaasRbac.controller');

// All routes require authentication
router.use(verifyJWT);

// Setup Tenant Context and DB Injection
router.use(tenantContextMiddleware());
router.use((req, res, next) => {
    try {
        req.db = getTenantDb(req.ctx);
        next();
    } catch (err) {
        console.error('Error injecting Tenant DB in RBAC routes:', err);
        res.status(500).json({ error: 'Database context error' });
    }
});

// All routes require rbac manage permission
router.use(requirePermission('finsaas.rbac.manage'));

/**
 * GET /api/finsaas/admin/rbac/users
 * List all users in the tenant with their roles
 */
router.get('/users', finsaasRbacController.listUsers);

/**
 * GET /api/finsaas/admin/rbac/roles
 * List available roles for assignment
 */
router.get('/roles', finsaasRbacController.listRoles);

/**
 * GET /api/finsaas/admin/rbac/empresas
 * List empresas for assignment
 */
router.get('/empresas', finsaasRbacController.listEmpresas);

/**
 * PATCH /api/finsaas/admin/rbac/users/:userId
 * Update user's role and empresa access
 */
router.patch('/users/:userId', finsaasRbacController.updateUserAccess);

module.exports = router;
