const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');

// Buscar técnicos (usuarios)
router.post('/search', verifyJWT, async (req, res) => {
    try {
        const db = req.db;
        const { query } = req.body;
        const id_tenant = req.user.id_tenant;

        let sql = `
      SELECT id, nombre, email 
      FROM usuario 
      WHERE id_tenant = $1
    `;
        const params = [id_tenant];

        if (query) {
            sql += ` AND (nombre ILIKE $2 OR email ILIKE $2)`;
            params.push(`%${query}%`);
        }

        sql += ` ORDER BY nombre ASC LIMIT 20`;

        const result = await db.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error buscando técnicos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
