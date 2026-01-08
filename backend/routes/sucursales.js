const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// GET /api/sucursales - Listar sucursales
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query;
        let params;

        console.log('GET /api/sucursales - User:', req.user);

        if (isSuperAdmin) {
            query = 'SELECT * FROM sucursal ORDER BY nombre ASC';
            params = [];
            console.log('Executing SuperAdmin query');
        } else {
            query = 'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre ASC';
            params = [id_tenant];
            console.log('Executing Tenant query for tenant:', id_tenant);
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});

/**
 * GET /api/sucursales/:id/tecnicos
 * Devuelve los técnicos (usuarios) asignados a una sucursal específica
 * Solo devuelve usuarios que están en la tabla usuario_sucursal
 */
router.get('/:id/tecnicos', verifyJWT, async (req, res) => {
    const id_sucursal = parseInt(req.params.id);
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        // 1. Verificar que la sucursal existe
        const sucursalCheck = await pool.query(
            'SELECT id FROM sucursal WHERE id = $1 AND (id_tenant = $2 OR $3 = true)',
            [id_sucursal, id_tenant, isSuperAdmin]
        );

        if (sucursalCheck.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Sucursal no encontrada'
            });
        }

        // 2. Obtener técnicos asignados a esa sucursal
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.nombre, 
                u.email,
                u.porcentaje_mano_obra
            FROM usuario u
            INNER JOIN usuario_sucursal us ON u.id = us.id_usuario
            WHERE us.id_sucursal = $1
              AND u.id_tenant = $2
              AND (u.is_super_admin = false OR u.is_super_admin IS NULL)
            ORDER BY u.nombre ASC
        `, [id_sucursal, id_tenant]);

        console.log(`GET /api/sucursales/${id_sucursal}/tecnicos -> ${result.rows.length} técnicos`);

        res.json({
            ok: true,
            tecnicos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener técnicos de sucursal:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener técnicos' });
    }
});

module.exports = router;

