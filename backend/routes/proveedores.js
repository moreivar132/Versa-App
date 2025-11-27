const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// POST /api/proveedores - Crear un nuevo proveedor
router.post('/', verifyJWT, async (req, res) => {
    const { nombre, cif, telefono, Correo, Domicilio_fiscal, Comentarios, Nombre_contacto, Sitio_web_b2b, Proviancia, cp_localidad } = req.body;

    // Validación básica
    if (!nombre || !cif) {
        return res.status(400).json({
            ok: false,
            error: 'Nombre y CIF/NIF son obligatorios.'
        });
    }

    // Obtener id_tenant del token (CRÍTICO)
    const id_tenant = req.user.id_tenant;

    if (!id_tenant) {
        return res.status(403).json({
            ok: false,
            error: 'El usuario no pertenece a ningún tenant válido.'
        });
    }

    try {
        // Verificar si ya existe el proveedor en este tenant
        const existing = await pool.query(
            'SELECT id FROM proveedor WHERE cif = $1 AND id_tenant = $2',
            [cif, id_tenant]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un proveedor con este CIF en su organización.'
            });
        }

        // Insertar proveedor
        const insertQuery = `
      INSERT INTO proveedor 
      (id_tenant, nombre, cif, telefono, "Correo", "Domicilio_fiscal", "Comentarios", "Nombre_contacto", "Sitio_web_b2b", "Proviancia", cp_localidad, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;

        const result = await pool.query(insertQuery, [
            id_tenant,
            nombre,
            cif,
            telefono || null,
            Correo || null,
            Domicilio_fiscal || null,
            Comentarios || null,
            Nombre_contacto || null,
            Sitio_web_b2b || null,
            Proviancia || null,
            cp_localidad || null
        ]);

        res.status(201).json({
            ok: true,
            message: 'Proveedor creado exitosamente',
            proveedor: result.rows[0]
        });

    } catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor al crear el proveedor.'
        });
    }
});

// GET /api/proveedores - Obtener últimos 3 proveedores
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query;
        let params;

        if (isSuperAdmin) {
            query = `
                SELECT * FROM proveedor 
                ORDER BY created_at DESC 
                LIMIT 3
            `;
            params = [];
        } else {
            query = `
                SELECT * FROM proveedor 
                WHERE id_tenant = $1 
                ORDER BY created_at DESC 
                LIMIT 3
            `;
            params = [id_tenant];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// GET /api/proveedores/count - Obtener total de proveedores
router.get('/count', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        let query;
        let params;

        if (isSuperAdmin) {
            query = 'SELECT COUNT(*) FROM proveedor';
            params = [];
        } else {
            query = 'SELECT COUNT(*) FROM proveedor WHERE id_tenant = $1';
            params = [id_tenant];
        }

        const result = await pool.query(query, params);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error al contar proveedores:', error);
        res.status(500).json({ error: 'Error al contar proveedores' });
    }
});

// PUT /api/proveedores/:id - Actualizar un proveedor existente
router.put('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const { nombre, cif, telefono, Correo, Domicilio_fiscal, Comentarios, Nombre_contacto, Sitio_web_b2b, Proviancia, cp_localidad } = req.body;

    if (!nombre || !cif) {
        return res.status(400).json({
            ok: false,
            error: 'Nombre y CIF/NIF son obligatorios.'
        });
    }

    const id_tenant = req.user.id_tenant;

    try {
        // Verificar que el proveedor pertenezca al tenant
        const checkQuery = 'SELECT id FROM proveedor WHERE id = $1 AND id_tenant = $2';
        const checkResult = await pool.query(checkQuery, [id, id_tenant]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Proveedor no encontrado o no autorizado.'
            });
        }

        // Actualizar proveedor
        const updateQuery = `
            UPDATE proveedor
            SET nombre = $1, cif = $2, telefono = $3, "Correo" = $4, "Domicilio_fiscal" = $5, 
                "Comentarios" = $6, "Nombre_contacto" = $7, "Sitio_web_b2b" = $8, 
                "Proviancia" = $9, cp_localidad = $10
            WHERE id = $11 AND id_tenant = $12
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            nombre,
            cif,
            telefono || null,
            Correo || null,
            Domicilio_fiscal || null,
            Comentarios || null,
            Nombre_contacto || null,
            Sitio_web_b2b || null,
            Proviancia || null,
            cp_localidad || null,
            id,
            id_tenant
        ]);

        res.json({
            ok: true,
            message: 'Proveedor actualizado exitosamente',
            proveedor: result.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor al actualizar el proveedor.'
        });
    }
});

// Búsqueda de proveedores
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
                SELECT * FROM proveedor 
                WHERE (nombre ILIKE $1 OR cif ILIKE $1 OR telefono ILIKE $1)
                LIMIT 10
            `;
            params = [searchTerm];
        } else {
            query = `
                SELECT * FROM proveedor 
                WHERE id_tenant = $1 
                AND (nombre ILIKE $2 OR cif ILIKE $2 OR telefono ILIKE $2)
                LIMIT 10
            `;
            params = [id_tenant, searchTerm];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en búsqueda de proveedores:', error);
        res.status(500).json({ error: 'Error al buscar proveedores' });
    }
});

module.exports = router;
