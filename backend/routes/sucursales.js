const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// ================================================================
// SUCURSALES CRUD
// ================================================================

// GET /api/sucursales - List sucursales
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query;
        let params;

        if (isSuperAdmin) {
            // Super admins see all, optionally filtered by tenant_id query param
            if (req.query.tenant_id) {
                query = 'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre ASC';
                params = [req.query.tenant_id];
            } else {
                query = 'SELECT * FROM sucursal ORDER BY nombre ASC';
                params = [];
            }
        } else {
            // Regular users only see their tenant's branches
            query = 'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre ASC';
            params = [id_tenant];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});

// POST /api/sucursales - Create sucursal
router.post('/', verifyJWT, async (req, res) => {
    const { nombre, direccion, telefono, email } = req.body;
    const id_tenant = req.user.id_tenant;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Super admin can specify tenant_id
    const targetTenantId = (req.user.is_super_admin && req.body.id_tenant)
        ? req.body.id_tenant
        : id_tenant;

    try {
        const result = await pool.query(`
            INSERT INTO sucursal (nombre, direccion, telefono, email, id_tenant, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *
        `, [nombre, direccion, telefono, email, targetTenantId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating sucursal detailed:', error);
        res.status(500).json({ error: 'Error al crear sucursal', details: error.message });
    }
});

// PUT /api/sucursales/:id - Update sucursal
router.put('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const { nombre, direccion, telefono, email } = req.body;
    const id_tenant = req.user.id_tenant;

    try {
        // Verify ownership/existence first
        const check = await pool.query(
            'SELECT id, id_tenant FROM sucursal WHERE id = $1',
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        if (!req.user.is_super_admin && check.rows[0].id_tenant !== id_tenant) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta sucursal' });
        }

        const result = await pool.query(`
            UPDATE sucursal 
            SET nombre = $1, direccion = $2, telefono = $3, email = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [nombre, direccion, telefono, email, id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating sucursal:', error);
        res.status(500).json({ error: 'Error al actualizar sucursal' });
    }
});

// DELETE /api/sucursales/:id - Delete sucursal
router.delete('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const id_tenant = req.user.id_tenant;

    try {
        // Verify ownership first
        const check = await pool.query(
            'SELECT id, id_tenant FROM sucursal WHERE id = $1',
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        if (!req.user.is_super_admin && check.rows[0].id_tenant !== id_tenant) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta sucursal' });
        }

        await pool.query('DELETE FROM sucursal WHERE id = $1', [id]);
        res.json({ success: true, message: 'Sucursal eliminada' });
    } catch (error) {
        console.error('Error deleting sucursal:', error);
        // Check for FK constraint violation
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede eliminar la sucursal porque tiene datos asociados (citas, órdenes, etc.)' });
        }
        res.status(500).json({ error: 'Error al eliminar sucursal' });
    }
});

module.exports = router;
