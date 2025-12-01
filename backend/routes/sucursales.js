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

        if (isSuperAdmin) {
            query = 'SELECT * FROM sucursal ORDER BY nombre ASC';
            params = [];
        } else {
            query = 'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre ASC';
            params = [id_tenant];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});

module.exports = router;
