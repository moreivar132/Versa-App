const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// POST /api/clientes - Crear un nuevo cliente
router.post('/', verifyJWT, async (req, res) => {
    const {
        nombre,
        tipo_documento,
        documento,
        origen_cliente,
        telefono,
        telefono_alternativo,
        email,
        direccion,
        localidad,
        cp_cliente,
        comentario
    } = req.body;

    // Validación básica
    if (!nombre || !documento || !telefono) {
        return res.status(400).json({
            ok: false,
            error: 'Nombre, Documento y Teléfono son obligatorios.'
        });
    }

    // Obtener id_tenant del token
    const id_tenant = req.user.id_tenant;

    if (!id_tenant) {
        return res.status(403).json({
            ok: false,
            error: 'El usuario no pertenece a ningún tenant válido.'
        });
    }

    try {
        // Verificar si ya existe el cliente en este tenant
        const existing = await pool.query(
            'SELECT id FROM clientefinal WHERE documento = $1 AND id_tenant = $2',
            [documento, id_tenant]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un cliente con este documento en su organización.'
            });
        }

        // Insertar cliente
        // Asumo que la tabla es 'clientes' y tiene estas columnas. 
        // Si fallan los nombres de columna, tendré que ajustar.
        const insertQuery = `
            INSERT INTO clientefinal 
            (id_tenant, nombre, tipo_documento, documento, origen_cliente, telefono, telefono_alternativo, email, direccion, localidad, cp_cliente, comentario, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            id_tenant,
            nombre,
            tipo_documento || null,
            documento,
            origen_cliente || null,
            telefono,
            telefono_alternativo || null,
            email || null,
            direccion || null,
            localidad || null,
            cp_cliente || null,
            comentario || null
        ]);

        res.status(201).json({
            ok: true,
            message: 'Cliente creado exitosamente',
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor al crear el cliente.'
        });
    }
});

// GET /api/clientes - Obtener últimos 10 clientes
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query;
        let params;

        if (isSuperAdmin) {
            query = `
                SELECT * FROM clientefinal 
                ORDER BY created_at DESC 
                LIMIT 10
            `;
            params = [];
        } else {
            query = `
                SELECT * FROM clientefinal 
                WHERE id_tenant = $1 
                ORDER BY created_at DESC 
                LIMIT 10
            `;
            params = [id_tenant];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// GET /api/clientes/search - Buscar clientes
router.get('/search', verifyJWT, async (req, res) => {
    const { q } = req.query;
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    if (!q) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    try {
        const searchTerm = `%${q}%`;
        let query;
        let params;

        if (isSuperAdmin) {
            query = `
                SELECT * FROM clientefinal 
                WHERE (nombre ILIKE $1 OR documento ILIKE $1 OR telefono ILIKE $1)
                LIMIT 10
            `;
            params = [searchTerm];
        } else {
            query = `
                SELECT * FROM clientefinal 
                WHERE id_tenant = $1 
                AND (nombre ILIKE $2 OR documento ILIKE $2 OR telefono ILIKE $2)
                LIMIT 10
            `;
            params = [id_tenant, searchTerm];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en búsqueda de clientes:', error);
        res.status(500).json({ error: 'Error al buscar clientes' });
    }
});

module.exports = router;
