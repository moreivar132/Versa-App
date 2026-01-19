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
const finsaasRbacController = require('../src/modules/contable/api/controllers/finsaasRbac.controller');

// All routes require authentication + rbac manage permission
router.use(verifyJWT);
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
