const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const userModel = require('../models/userModel');
const tenantModel = require('../models/tenantModel');
const roleModel = require('../models/roleModel');
const sucursalModel = require('../models/sucursalModel');

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

router.get('/roles', async (req, res) => {
    try {
        const roles = await roleModel.getAllRoles();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
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

module.exports = router;
