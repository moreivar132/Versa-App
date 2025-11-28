const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const userModel = require('../models/userModel');
const tenantModel = require('../models/tenantModel');
const roleModel = require('../models/roleModel');
const sucursalModel = require('../models/sucursalModel');
const permisoModel = require('../models/permisoModel');

// Middleware para verificar super admin
const requireSuperAdmin = async (req, res, next) => {
    try {
        const user = await userModel.getUserById(req.user.id);
        if (!user || !user.is_super_admin) {
            return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Super Admin' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Error verificando permisos' });
    }
};

router.use(verifyJWT);
router.use(requireSuperAdmin);

// ==========================================
// USUARIOS
// ==========================================

router.get('/users', async (req, res) => {
    try {
        const users = await userModel.getAllUsers();

        // Enriquecer con roles y sucursales
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const roles = await roleModel.getUserRoles(user.id);
            const sucursales = await sucursalModel.getUserSucursales(user.id);

            // Sanitizar password
            const { password_hash, ...safeUser } = user;

            return {
                ...safeUser,
                roles: roles.map(r => r.nombre),
                sucursales: sucursales
            };
        }));

        res.json(enrichedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { nombre, email, password, id_tenant, is_super_admin, porcentaje_mano_obra } = req.body;

        // Validar duplicados
        const existing = await userModel.getUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await userModel.createUser({
            nombre,
            email,
            passwordHash,
            id_tenant,
            isSuperAdmin: is_super_admin,
            porcentaje_mano_obra
        });

        const { password_hash, ...safeUser } = newUser;
        res.status(201).json(safeUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedUser = await userModel.updateUser(id, req.body);
        const { password_hash, ...safeUser } = updatedUser;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        await userModel.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// Asignaciones
router.post('/users/:id/roles', async (req, res) => {
    try {
        const { id } = req.params;
        const { role_ids } = req.body; // Array de IDs

        await roleModel.clearUserRoles(id);

        for (const roleId of role_ids) {
            await roleModel.assignRoleToUser(id, roleId);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar roles' });
    }
});

router.post('/users/:id/sucursales', async (req, res) => {
    try {
        const { id } = req.params;
        const { sucursal_ids } = req.body; // Array de IDs

        await sucursalModel.clearUserSucursales(id);

        for (const sucursalId of sucursal_ids) {
            await sucursalModel.assignSucursalToUser(id, sucursalId);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar sucursales' });
    }
});

// ==========================================
// CATÁLOGOS
// ==========================================

router.get('/tenants', async (req, res) => {
    try {
        const tenants = await tenantModel.getAllTenants();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tenants' });
    }
});

router.post('/tenants', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre del tenant es obligatorio' });
        }
        const newTenant = await tenantModel.createTenant(nombre);
        res.status(201).json(newTenant);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear tenant' });
    }
});

router.put('/tenants/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        const updatedTenant = await tenantModel.updateTenant(id, nombre);
        if (!updatedTenant) {
            return res.status(404).json({ error: 'Tenant no encontrado' });
        }
        res.json(updatedTenant);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar tenant' });
    }
});

router.delete('/tenants/:id', async (req, res) => {
    try {
        await tenantModel.deleteTenant(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar tenant' });
    }
});

router.get('/roles', async (req, res) => {
    try {
        const roles = await roleModel.getAllRoles();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

router.post('/roles', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
        }
        const newRole = await roleModel.createRole({ nombre });
        res.status(201).json(newRole);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

router.put('/roles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        const updatedRole = await roleModel.updateRole(id, { nombre });
        if (!updatedRole) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }
        res.json(updatedRole);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

router.delete('/roles/:id', async (req, res) => {
    try {
        await roleModel.deleteRole(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar rol' });
    }
});

router.get('/roles/:id/permisos', async (req, res) => {
    try {
        const permisos = await roleModel.getRolePermissions(req.params.id);
        res.json(permisos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos del rol' });
    }
});

router.post('/roles/:id/permisos', async (req, res) => {
    try {
        const { id } = req.params;
        const { permiso_ids } = req.body;

        if (!Array.isArray(permiso_ids)) {
            return res.status(400).json({ error: 'permiso_ids debe ser un array de IDs' });
        }

        await roleModel.clearRolePermissions(id);
        for (const permisoId of permiso_ids) {
            await roleModel.assignPermissionToRole(id, permisoId);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar permisos al rol' });
    }
});

router.get('/sucursales', async (req, res) => {
    try {
        const sucursales = await sucursalModel.getAllSucursales();
        res.json(sucursales);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});

router.post('/sucursales', async (req, res) => {
    try {
        const { nombre, id_tenant } = req.body;
        if (!nombre || !id_tenant) {
            return res.status(400).json({ error: 'Nombre e id_tenant son obligatorios' });
        }
        const sucursal = await sucursalModel.createSucursal({ nombre, id_tenant });
        res.status(201).json(sucursal);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear sucursal' });
    }
});

router.put('/sucursales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, id_tenant } = req.body;
        const sucursal = await sucursalModel.updateSucursal(id, { nombre, id_tenant });
        if (!sucursal) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }
        res.json(sucursal);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar sucursal' });
    }
});

router.delete('/sucursales/:id', async (req, res) => {
    try {
        await sucursalModel.deleteSucursal(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar sucursal' });
    }
});

router.get('/permisos', async (req, res) => {
    try {
        const permisos = await permisoModel.getAllPermisos();
        res.json(permisos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

router.post('/permisos', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre del permiso es obligatorio' });
        }
        const permiso = await permisoModel.createPermiso({ nombre, descripcion });
        res.status(201).json(permiso);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear permiso' });
    }
});

router.put('/permisos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;
        const permiso = await permisoModel.updatePermiso(id, { nombre, descripcion });
        if (!permiso) {
            return res.status(404).json({ error: 'Permiso no encontrado' });
        }
        res.json(permiso);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar permiso' });
    }
});

router.delete('/permisos/:id', async (req, res) => {
    try {
        await permisoModel.deletePermiso(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar permiso' });
    }
});

router.get('/users/:id/permisos', async (req, res) => {
    try {
        const permisos = await permisoModel.getUserPermisos(req.params.id);
        res.json(permisos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos del usuario' });
    }
});

module.exports = router;
