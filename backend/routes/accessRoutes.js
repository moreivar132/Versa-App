/**
 * Access Management Routes
 * Tenant-scoped CRUD for users, roles, permissions with RBAC validation
 */

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const verifyJWT = require('../middleware/auth');
const { requirePermission, requireSuperAdmin, getEffectiveTenant, validateTenantAccess } = require('../middleware/rbac');
const { logAudit, getAuditLogs, getAuditContext, AUDIT_ACTIONS } = require('../services/auditService');

const userModel = require('../models/userModel');
const tenantModel = require('../models/tenantModel');
const roleModel = require('../models/roleModel');
const sucursalModel = require('../models/sucursalModel');
const permisoModel = require('../models/permisoModel');
const { getTenantDb } = require('../src/core/db/tenant-db');

// All routes require authentication
router.use(verifyJWT);

// Inject Tenant DB
router.use((req, res, next) => {
    try {
        req.db = getTenantDb(req.user); // req.user acts as context
        next();
    } catch (err) {
        console.error('Error injecting Tenant DB:', err);
        res.status(500).json({ error: 'Database context error' });
    }
});

// ================================================================
// USERS ENDPOINTS
// ================================================================

/**
 * GET /api/access/users
 * List users (scoped to tenant for non-super admins)
 */
router.get('/users', requirePermission('users.view'), async (req, res) => {
    try {
        const tenantId = getEffectiveTenant(req);

        let users;
        if (req.userPermissions?.isSuperAdmin) {
            // Super admin sees all users
            users = await userModel.getAllUsers();
        } else {
            // Regular users only see their tenant's users
            const result = await req.db.query(`
                SELECT u.*, t.nombre as tenant_nombre 
                FROM usuario u
                LEFT JOIN tenant t ON u.id_tenant = t.id
                WHERE u.id_tenant = $1 
                ORDER BY u.created_at DESC`,
                [tenantId]
            );
            users = result.rows;
        }

        // Enrich with roles and sucursales
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const roles = await roleModel.getUserRoles(user.id);
            const sucursales = await sucursalModel.getUserSucursales(user.id);
            const { password_hash, ...safeUser } = user;
            return {
                ...safeUser,
                roles: roles.map(r => r.nombre),
                sucursales
            };
        }));

        res.json(enrichedUsers);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

/**
 * POST /api/access/users
 * Create new user
 */
router.post('/users', requirePermission('users.create'), async (req, res) => {
    try {
        const { nombre, email, password, id_tenant, is_super_admin, porcentaje_mano_obra, sucursal_ids, crear_sucursal } = req.body;

        // Non-super admins can only create users in their own tenant
        const effectiveTenant = getEffectiveTenant(req);
        if (!req.userPermissions?.isSuperAdmin && id_tenant !== effectiveTenant) {
            return res.status(403).json({ error: 'No puedes crear usuarios en otro tenant' });
        }

        // Non-super admins cannot create super admins
        if (is_super_admin && !req.userPermissions?.isSuperAdmin) {
            return res.status(403).json({ error: 'Solo super admins pueden crear super admins' });
        }

        // Check for duplicate email
        const existing = await userModel.getUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Get tenant sucursales to check if onboarding is needed
        const tenantSucursales = await sucursalModel.getSucursalesByTenant(id_tenant);
        let createdSucursalId = null;

        // Handle onboarding flow: create first sucursal if tenant has none
        if (tenantSucursales.length === 0 && crear_sucursal?.nombre) {
            const newSucursalResult = await req.db.query(`
                INSERT INTO sucursal (nombre, direccion, id_tenant, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *
            `, [crear_sucursal.nombre, crear_sucursal.direccion || null, id_tenant]);
            createdSucursalId = newSucursalResult.rows[0].id;
            console.log(`Created first sucursal ${createdSucursalId} for tenant ${id_tenant}`);
        }

        // Validate sucursal_ids belong to the target tenant
        if (sucursal_ids && sucursal_ids.length > 0) {
            const validSucursales = await req.db.query(
                'SELECT id FROM sucursal WHERE id = ANY($1) AND id_tenant = $2',
                [sucursal_ids, id_tenant]
            );
            if (validSucursales.rows.length !== sucursal_ids.length) {
                return res.status(400).json({ error: 'Una o más sucursales no pertenecen a este tenant' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await userModel.createUser({
            id_tenant,
            nombre,
            email,
            passwordHash,
            isSuperAdmin: is_super_admin,
            porcentaje_mano_obra
        });

        // Assign sucursales
        const sucursalesToAssign = createdSucursalId
            ? [createdSucursalId]
            : (sucursal_ids || []);

        for (const sucursalId of sucursalesToAssign) {
            await sucursalModel.assignSucursalToUser(newUser.id, sucursalId);
        }

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.USER_CREATE,
            entityType: 'user',
            entityId: newUser.id,
            after: { nombre, email, id_tenant, is_super_admin, sucursales: sucursalesToAssign }
        });

        // Get assigned sucursales for response
        const assignedSucursales = await sucursalModel.getUserSucursales(newUser.id);
        const { password_hash, ...safeUser } = newUser;
        res.status(201).json({ ...safeUser, sucursales: assignedSucursales });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});


/**
 * PUT /api/access/users/:id
 * Update user
 */
router.put('/users/:id', requirePermission('users.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { sucursal_ids } = req.body;
        const targetUser = await userModel.getUserById(id);

        if (!targetUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Non-super admins can only edit users in their tenant
        if (!req.userPermissions?.isSuperAdmin && targetUser.id_tenant !== req.user.id_tenant) {
            return res.status(403).json({ error: 'No puedes editar usuarios de otro tenant' });
        }

        // Prevent non-super admins from promoting to super admin
        if (req.body.is_super_admin && !req.userPermissions?.isSuperAdmin) {
            return res.status(403).json({ error: 'Solo super admins pueden asignar super admin' });
        }

        // Handle tenant change - clear sucursales
        const newTenantId = req.body.id_tenant || targetUser.id_tenant;
        const tenantChanged = newTenantId !== targetUser.id_tenant;

        if (tenantChanged) {
            // Clear existing sucursales when tenant changes
            await sucursalModel.clearUserSucursales(id);
        }

        // Validate sucursal_ids belong to the target tenant
        if (sucursal_ids && sucursal_ids.length > 0) {
            const validSucursales = await req.db.query(
                'SELECT id FROM sucursal WHERE id = ANY($1) AND id_tenant = $2',
                [sucursal_ids, newTenantId]
            );
            if (validSucursales.rows.length !== sucursal_ids.length) {
                return res.status(400).json({ error: 'Una o más sucursales no pertenecen a este tenant' });
            }
        }

        const before = { ...targetUser };
        delete before.password_hash;

        // Prepare update data
        const updateData = { ...req.body };
        let passwordUpdated = false;

        // If password is provided, hash it
        if (req.body.password && req.body.password.trim() !== '') {
            updateData.password_hash = await bcrypt.hash(req.body.password, 10);
            passwordUpdated = true;
            console.log(`Password updated for user ${id} by admin ${req.user.id}`);
        }
        // Remove plaintext password from updateData
        delete updateData.password;

        const updatedUser = await userModel.updateUser(id, updateData);

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.USER_UPDATE,
            entityType: 'user',
            entityId: id,
            before,
            after: { ...req.body, sucursal_ids, passwordUpdated }
        });

        // Get current sucursales
        const assignedSucursales = await sucursalModel.getUserSucursales(id);
        const { password_hash, ...safeUser } = updatedUser;
        res.json({ ...safeUser, sucursales: assignedSucursales, passwordUpdated });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});


/**
 * DELETE /api/access/users/:id
 * Delete user
 */
router.delete('/users/:id', requirePermission('users.delete'), async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await userModel.getUserById(id);

        if (!targetUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Non-super admins can only delete users in their tenant
        if (!req.userPermissions?.isSuperAdmin && targetUser.id_tenant !== req.user.id_tenant) {
            return res.status(403).json({ error: 'No puedes eliminar usuarios de otro tenant' });
        }

        // Prevent deleting yourself
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        await userModel.deleteUser(id);

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.USER_DELETE,
            entityType: 'user',
            entityId: id,
            before: { nombre: targetUser.nombre, email: targetUser.email }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

/**
 * POST /api/access/users/:id/roles
 * Assign roles to user
 */
router.post('/users/:id/roles', requirePermission('users.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role_ids } = req.body;

        if (!Array.isArray(role_ids)) {
            return res.status(400).json({ error: 'role_ids debe ser un array' });
        }

        await roleModel.clearUserRoles(id);
        for (const roleId of role_ids) {
            await roleModel.assignRoleToUser(id, roleId);
        }

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.USER_ROLE_ASSIGN,
            entityType: 'user',
            entityId: id,
            after: { roles: role_ids }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning roles:', error);
        res.status(500).json({ error: 'Error al asignar roles' });
    }
});

/**
 * POST /api/access/users/:id/sucursales
 * Assign sucursales to user
 */
router.post('/users/:id/sucursales', requirePermission('users.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { sucursal_ids } = req.body;

        if (!Array.isArray(sucursal_ids)) {
            return res.status(400).json({ error: 'sucursal_ids debe ser un array' });
        }

        await sucursalModel.clearUserSucursales(id);
        for (const sucursalId of sucursal_ids) {
            await sucursalModel.assignSucursalToUser(id, sucursalId);
        }

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.USER_SUCURSAL_ASSIGN,
            entityType: 'user',
            entityId: id,
            after: { sucursales: sucursal_ids }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning sucursales:', error);
        res.status(500).json({ error: 'Error al asignar sucursales' });
    }
});

// ================================================================
// ROLES ENDPOINTS  
// ================================================================

/**
 * GET /api/access/roles
 * List roles (scoped to tenant for non-super admins)
 */
router.get('/roles', requirePermission('roles.view'), async (req, res) => {
    try {
        let roles;

        if (req.userPermissions?.isSuperAdmin) {
            // Super admin sees all roles
            roles = await roleModel.getAllRoles();
        } else {
            // Regular users see global roles + their tenant's roles
            const result = await req.db.query(`
                SELECT * FROM rol 
                WHERE scope = 'global' 
                   OR tenant_id IS NULL 
                   OR tenant_id = $1
                ORDER BY level, nombre
            `, [req.user.id_tenant]);
            roles = result.rows;
        }

        res.json(roles);
    } catch (error) {
        console.error('Error getting roles:', error);
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

/**
 * POST /api/access/roles
 * Create new role
 */
router.post('/roles', requirePermission('roles.create'), async (req, res) => {
    try {
        const { nombre, display_name, scope, level } = req.body;

        // Non-super admins can only create tenant-scoped roles
        if (!req.userPermissions?.isSuperAdmin && scope === 'global') {
            return res.status(403).json({ error: 'Solo super admins pueden crear roles globales' });
        }

        const tenantId = req.userPermissions?.isSuperAdmin ? req.body.tenant_id : req.user.id_tenant;

        const result = await req.db.query(`
            INSERT INTO rol (nombre, display_name, scope, tenant_id, level, is_system)
            VALUES ($1, $2, $3, $4, $5, false)
            RETURNING *
        `, [nombre, display_name || nombre, scope || 'tenant', tenantId, level || 50]);

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.ROLE_CREATE,
            entityType: 'role',
            entityId: result.rows[0].id,
            after: { nombre, display_name, scope }
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

/**
 * PUT /api/access/roles/:id
 * Update role
 */
router.put('/roles/:id', requirePermission('roles.update'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if role exists and is editable
        const existing = await roleModel.getRoleById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }

        // Prevent editing system roles (except by super admin)
        if (existing.is_system && !req.userPermissions?.isSuperAdmin) {
            return res.status(403).json({ error: 'No puedes editar roles del sistema' });
        }

        const updated = await roleModel.updateRole(id, req.body);

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.ROLE_UPDATE,
            entityType: 'role',
            entityId: id,
            before: existing,
            after: req.body
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

/**
 * DELETE /api/access/roles/:id
 * Delete role
 */
router.delete('/roles/:id', requirePermission('roles.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await roleModel.getRoleById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }

        // Never delete system roles
        if (existing.is_system) {
            return res.status(403).json({ error: 'No se pueden eliminar roles del sistema' });
        }

        await roleModel.deleteRole(id);

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.ROLE_DELETE,
            entityType: 'role',
            entityId: id,
            before: existing
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Error al eliminar rol' });
    }
});

/**
 * GET /api/access/roles/:id/permisos
 * Get permissions for a role
 */
router.get('/roles/:id/permisos', requirePermission('roles.view'), async (req, res) => {
    try {
        const permisos = await roleModel.getRolePermissions(req.params.id);
        res.json(permisos);
    } catch (error) {
        console.error('Error getting role permissions:', error);
        res.status(500).json({ error: 'Error al obtener permisos del rol' });
    }
});

/**
 * POST /api/access/roles/:id/permisos
 * Assign permissions to role
 */
router.post('/roles/:id/permisos', requirePermission('roles.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { permiso_ids } = req.body;

        if (!Array.isArray(permiso_ids)) {
            return res.status(400).json({ error: 'permiso_ids debe ser un array' });
        }

        // Check role exists and is editable
        const existing = await roleModel.getRoleById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }

        if (existing.is_system && !req.userPermissions?.isSuperAdmin) {
            return res.status(403).json({ error: 'No puedes editar permisos de roles del sistema' });
        }

        await roleModel.clearRolePermissions(id);
        for (const permisoId of permiso_ids) {
            await roleModel.assignPermissionToRole(id, permisoId);
        }

        // Audit log
        const ctx = getAuditContext(req);
        await logAudit({
            ...ctx,
            action: AUDIT_ACTIONS.ROLE_PERMISSION_ASSIGN,
            entityType: 'role',
            entityId: id,
            after: { permissions: permiso_ids }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning permissions:', error);
        res.status(500).json({ error: 'Error al asignar permisos' });
    }
});

// ================================================================
// PERMISSIONS ENDPOINTS
// ================================================================

/**
 * GET /api/access/permissions
 * List all permissions (read-only for most users)
 */
router.get('/permissions', requirePermission('permissions.view'), async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT id, COALESCE(key, nombre) as key, nombre, module, descripcion, created_at
            FROM permiso
            ORDER BY module, key
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting permissions:', error);
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

// ================================================================
// TENANTS ENDPOINTS (Super Admin Only)
// ================================================================

router.get('/tenants', requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await tenantModel.getAllTenants();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tenants' });
    }
});

// ================================================================
// AUDIT LOGS ENDPOINTS
// ================================================================

/**
 * GET /api/access/audit
 * Get audit logs
 */
router.get('/audit', requirePermission('audit.view'), async (req, res) => {
    try {
        const tenantId = req.userPermissions?.isSuperAdmin ? req.query.tenantId : req.user.id_tenant;

        const logs = await getAuditLogs({
            tenantId,
            entityType: req.query.entityType,
            action: req.query.action,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        });

        res.json(logs);
    } catch (error) {
        console.error('Error getting audit logs:', error);
        res.status(500).json({ error: 'Error al obtener logs de auditoría' });
    }
});

// ================================================================
// USER PERMISSIONS ENDPOINT (for frontend)
// ================================================================

/**
 * GET /api/access/me/permissions
 * Get current user's permissions
 */
router.get('/me/permissions', async (req, res) => {
    try {
        const { getUserPermissions } = require('../middleware/rbac');
        const permissions = await getUserPermissions(req.user.id, req.user.id_tenant);
        res.json(permissions);
    } catch (error) {
        console.error('Error getting user permissions:', error);
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

module.exports = router;
