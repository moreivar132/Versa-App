const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// GET /api/vehiculos - Listar vehículos
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query = `
            SELECT v.*, c.nombre as nombre_cliente, s.nombre as nombre_sucursal
            FROM vehiculo v
            LEFT JOIN clientefinal c ON v.id_cliente = c.id
            LEFT JOIN sucursal s ON v.id_sucursal = s.id
        `;
        let params = [];

        if (!isSuperAdmin) {
            // Filtrar por tenant a través de la sucursal
            query += ` WHERE s.id_tenant = $1`;
            params = [id_tenant];
        }

        query += ` ORDER BY v.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener vehículos:', error);
        res.status(500).json({ error: 'Error al obtener vehículos' });
    }
});

// POST /api/vehiculos - Crear vehículo
router.post('/', verifyJWT, async (req, res) => {
    const {
        id_cliente,
        id_sucursal,
        matricula,
        marca,
        modelo,
        year,
        serial,
        color,
        cc,
        seguro
    } = req.body;

    if (!id_sucursal || !matricula || !marca || !modelo) {
        return res.status(400).json({ error: 'Sucursal, Matrícula, Marca y Modelo son obligatorios.' });
    }

    try {
        const insertQuery = `
            INSERT INTO vehiculo
            (id_cliente, id_sucursal, matricula, marca, modelo, "year", "Serial", "Color", "CC", "Seguro", created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            id_cliente || null,
            id_sucursal,
            matricula,
            marca,
            modelo,
            year || null,
            serial || null,
            color || null,
            cc || null,
            seguro || null,
            req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear vehículo:', error);
        res.status(500).json({ error: 'Error al crear vehículo' });
    }
});

// PUT /api/vehiculos/:id - Actualizar vehículo
router.put('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const {
        id_cliente,
        id_sucursal,
        matricula,
        marca,
        modelo,
        year,
        serial,
        color,
        cc,
        seguro
    } = req.body;

    try {
        const updateQuery = `
            UPDATE vehiculo
            SET id_cliente = $1, id_sucursal = $2, matricula = $3, marca = $4, modelo = $5,
                "year" = $6, "Serial" = $7, "Color" = $8, "CC" = $9, "Seguro" = $10, updated_at = NOW(), updated_by = $11
            WHERE id = $12
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            id_cliente || null,
            id_sucursal,
            matricula,
            marca,
            modelo,
            year || null,
            serial || null,
            color || null,
            cc || null,
            seguro || null,
            req.user.id,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar vehículo:', error);
        res.status(500).json({ error: 'Error al actualizar vehículo' });
    }
});

// GET /api/vehiculos/search - Buscar vehículos
router.get('/search', verifyJWT, async (req, res) => {
    const { q, id_cliente } = req.query;
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    // Si hay id_cliente, q es opcional (puede listar todos los del cliente)
    // Si no hay id_cliente, q es obligatorio
    if (!q && !id_cliente) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido (q) o ID de cliente' });
    }



    try {
        let query = `
            SELECT v.*, c.nombre as nombre_cliente 
            FROM vehiculo v
            LEFT JOIN clientefinal c ON v.id_cliente = c.id
            LEFT JOIN sucursal s ON v.id_sucursal = s.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (!isSuperAdmin) {
            query += ` AND s.id_tenant = $${paramIndex}`;
            params.push(id_tenant);
            paramIndex++;
        }

        if (id_cliente) {
            query += ` AND v.id_cliente = $${paramIndex}`;
            params.push(id_cliente);
            paramIndex++;
        }

        if (q) {
            const searchTerm = `%${q}%`;
            query += ` AND (v.matricula ILIKE $${paramIndex} OR v.marca ILIKE $${paramIndex} OR v.modelo ILIKE $${paramIndex})`;
            params.push(searchTerm);
            paramIndex++;
        }

        query += ` LIMIT 20`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en búsqueda de vehículos:', error);
        res.status(500).json({ error: 'Error al buscar vehículos' });
    }
});

module.exports = router;
