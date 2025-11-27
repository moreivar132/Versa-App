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
            'SELECT id FROM proveedor WHERE ruc_dni = $1 AND id_tenant = $2',
            [ruc_dni, id_tenant]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un proveedor con este RUC/DNI en su organización.'
            });
        }

        // Insertar proveedor
        // Se asume que la tabla tiene los campos: id_tenant, nombre, ruc_dni, telefono, email, direccion, estado, created_at
        const insertQuery = `
      INSERT INTO proveedor 
      (id_tenant, nombre, ruc_dni, telefono, email, direccion, estado, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', NOW())
      RETURNING *
    `;

        const result = await pool.query(insertQuery, [
            id_tenant,
            nombre,
            ruc_dni,
            telefono || null,
            email || null,
            direccion || null
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

module.exports = router;
