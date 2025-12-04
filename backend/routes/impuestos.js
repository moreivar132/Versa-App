const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, porcentaje FROM impuesto ORDER BY porcentaje ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching impuestos:', error);
        res.status(500).json({ error: 'Error al obtener impuestos' });
    }
});

module.exports = router;
