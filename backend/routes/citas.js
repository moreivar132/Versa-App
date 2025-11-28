const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/citas/crear - Crear una nueva cita (Público)
router.post('/crear', async (req, res) => {
    const {
        sucursal_ref,
        fecha_hora,
        duracion_min,
        motivo,
        notas,
        cliente,
        vehiculo_categoria
    } = req.body;

    // Validación básica
    if (!sucursal_ref || !fecha_hora || !cliente || !cliente.email) {
        return res.status(400).json({
            ok: false,
            error: 'Faltan datos obligatorios (sucursal, fecha, email del cliente).'
        });
    }

    // Mapeo de sucursal (Hardcoded por ahora, idealmente consultar DB)
    // tesoro -> 1, mella -> 2
    let id_sucursal = 1;
    if (sucursal_ref === 'mella') id_sucursal = 2;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Buscar o Crear Cliente
        let id_cliente;
        // Intentar buscar por email
        const existingClient = await client.query(
            'SELECT id FROM clientefinal WHERE email = $1 LIMIT 1',
            [cliente.email]
        );

        if (existingClient.rows.length > 0) {
            id_cliente = existingClient.rows[0].id;
        } else {
            // Crear nuevo cliente
            // Usamos email como documento si no existe, o generamos uno
            const documento = cliente.email;
            // Asumimos id_tenant = 1 para clientes públicos por defecto
            const id_tenant = 1;

            const insertClient = await client.query(`
                INSERT INTO clientefinal 
                (id_tenant, nombre, email, telefono, documento, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING id
            `, [id_tenant, cliente.nombre, cliente.email, cliente.telefono, documento]);

            id_cliente = insertClient.rows[0].id;
        }

        // 2. Crear Vehículo (Placeholder)
        // Como es una cita rápida, creamos un vehículo asociado a la categoría
        const matriculaPlaceholder = `TEMP-${Date.now().toString().slice(-6)}`;
        const insertVehiculo = await client.query(`
            INSERT INTO vehiculo
            (id_cliente, id_sucursal, matricula, marca, modelo, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
        `, [id_cliente, id_sucursal, matriculaPlaceholder, vehiculo_categoria.toUpperCase(), 'Generico']);

        const id_vehiculo = insertVehiculo.rows[0].id;

        // 3. Crear Cita
        const insertCita = await client.query(`
            INSERT INTO citataller
            (id_sucursal, id_cliente, id_vehiculo, fecha_hora, duracion_min, estado, motivo, notas, creado_por)
            VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, $7, NULL)
            RETURNING id
        `, [
            id_sucursal,
            id_cliente,
            id_vehiculo,
            fecha_hora,
            duracion_min,
            motivo,
            notas
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            ok: true,
            message: 'Cita creada exitosamente',
            cita_id: insertCita.rows[0].id
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear cita:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno al procesar la cita.',
            details: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;
