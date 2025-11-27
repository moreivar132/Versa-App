const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// POST /api/proveedores - Crear un nuevo proveedor
router.post('/', verifyJWT, async (req, res) => {
    const { nombre, ruc_dni, telefono, email, direccion } = req.body;

    // Validación básica
    if (!nombre || !ruc_dni) {
        return res.status(400).json({
            ok: false,
            error: 'Nombre y RUC/DNI son obligatorios.'
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
            [ruc_dni, id_tenant]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un proveedor con este CUIT/CIF en su organización.'
            });
        }

        // Insertar proveedor
        // Columnas reales: id_tenant, nombre, cif, telefono, Correo, Domicilio_fiscal, Comentarios, Nombre_contacto, cp_localidad
        const insertQuery = `
      INSERT INTO proveedor 
      (id_tenant, nombre, cif, telefono, "Correo", "Domicilio_fiscal", "Comentarios", "Nombre_contacto", created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

        // Mapeo de campos del frontend
        // nombre -> nombre
        // ruc_dni -> cif
        // telefono -> telefono
        // email -> Correo
        // direccion -> Domicilio_fiscal
        // comentario -> Comentarios
        // personaContacto -> Nombre_contacto

        const result = await pool.query(insertQuery, [
            id_tenant,
            nombre,
            ruc_dni, // Frontend envía ruc_dni o cuit, aquí lo recibimos como ruc_dni en el destructuring
            telefono || null,
            email || null,
            direccion || null,
            req.body.comentario || null,
            req.body.personaContacto || null
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

// Búsqueda de proveedores
router.get('/search', verifyJWT, async (req, res) => {
    const { q } = req.query;
    const id_tenant = req.user.id_tenant;

    if (!q) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    try {
        const searchTerm = `%${q}%`;
        const query = `
            SELECT * FROM proveedor 
            WHERE id_tenant = $1 
            AND (nombre ILIKE $2 OR cif ILIKE $2 OR telefono ILIKE $2)
            LIMIT 10
        `;

        const result = await pool.query(query, [id_tenant, searchTerm]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en búsqueda de proveedores:', error);
        res.status(500).json({ error: 'Error al buscar proveedores' });
    }
});

module.exports = router;
