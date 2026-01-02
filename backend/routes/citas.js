const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/citas/config - Obtener configuración (sucursales y técnicos)
// GET /api/citas/config - Obtener configuración (sucursales y técnicos)
router.get('/config', async (req, res) => {
    try {
        const sucursalesRes = await pool.query('SELECT id, nombre, direccion, direccion_iframe FROM sucursal ORDER BY id');

        let tecnicos = [];
        try {
            // Fetch technicians (users associated with sucursales)
            // We assume 'usuariosucursal' links users to sucursales
            const tecnicosRes = await pool.query(`
                SELECT u.id, u.nombre, us.id_sucursal 
                FROM usuario u 
                JOIN usuariosucursal us ON u.id = us.id_usuario
                ORDER BY u.nombre
            `);
            tecnicos = tecnicosRes.rows;
        } catch (err) {
            console.warn('Could not fetch technicians (usuariosucursal might be missing):', err.message);
        }

        res.json({
            ok: true,
            sucursales: sucursalesRes.rows,
            tecnicos: tecnicos
        });
    } catch (error) {
        console.error('Error al obtener config de citas:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener configuración' });
    }
});

// GET /api/citas - Listar citas (Interno)
router.get('/', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        // 1. Fetch Citas
        let query = `
            SELECT 
                c.id,
                c.fecha_hora,
                c.duracion_min,
                c.estado,
                c.motivo,
                c.notas,
                c.id_mecanico,
                c.id_sucursal,
                COALESCE(c.nombre_cliente, cli.nombre) as cliente_nombre,
                COALESCE(c.telefono_cliente, cli.telefono) as cliente_telefono,
                COALESCE(c.correo_cliente, cli.email) as cliente_email,
                v.marca as vehiculo_marca,
                v.modelo as vehiculo_modelo,
                v.matricula as vehiculo_matricula,
                s.nombre as sucursal_nombre,
                u.nombre as mecanico_nombre,
                COALESCE(p.status, 'PENDING') as payment_status,
                p.payment_mode
            FROM citataller c
            LEFT JOIN clientefinal cli ON c.id_cliente = cli.id
            LEFT JOIN vehiculo v ON c.id_vehiculo = v.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
            LEFT JOIN usuario u ON c.id_mecanico = u.id
            LEFT JOIN (
                SELECT DISTINCT ON (id_cita) id_cita, status, payment_mode
                FROM marketplace_reserva_pago
                ORDER BY id_cita, created_at DESC
            ) p ON c.id = p.id_cita
        `;

        const params = [];
        if (start_date && end_date) {
            query += ` WHERE c.fecha_hora BETWEEN $1 AND $2`;
            params.push(start_date, end_date);
        }

        query += ` ORDER BY c.fecha_hora ASC`; // Order by date ascending for calendar view

        if (!start_date) {
            query += ` LIMIT 50`; // Default limit if no range
        }

        const result = await pool.query(query, params);

        // 2. Calculate Stats (Real Data)
        // We need separate queries for global stats or derive them if the range covers today.
        // For robustness, let's do a quick separate query for "Today's Stats" regardless of the filter.

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const statsQuery = `
            SELECT
                COUNT(*) FILTER (WHERE fecha_hora BETWEEN $1 AND $2) as citas_hoy,
                COUNT(*) FILTER (WHERE estado = 'en proceso') as en_taller,
                COUNT(*) FILTER (WHERE estado = 'pendiente') as solicitudes_web
            FROM citataller
        `;
        const statsRes = await pool.query(statsQuery, [todayStart.toISOString(), todayEnd.toISOString()]);

        // For billing, we sum 'total_neto' from 'orden' where created_at is today (Estimate)
        const billingQuery = `
            SELECT SUM(total_neto) as total 
            FROM orden 
            WHERE created_at BETWEEN $1 AND $2
        `;
        const billingRes = await pool.query(billingQuery, [todayStart.toISOString(), todayEnd.toISOString()]);

        const stats = {
            citas_hoy: parseInt(statsRes.rows[0].citas_hoy || 0),
            en_taller: parseInt(statsRes.rows[0].en_taller || 0), // This might need to be global, not just today? Usually "In Workshop Now" implies current state. The query above filters 'en_taller' globally because the WHERE clause for date is only inside the first FILTER. Wait, no.
            // Correction: The FILTER syntax applies the condition. 
            // The query `SELECT COUNT(*) FILTER (WHERE fecha_hora...)` counts only those matching.
            // `COUNT(*) FILTER (WHERE estado = 'en proceso')` counts ALL 'en proceso' in the table? 
            // Yes, if there is no main WHERE clause.
            // Let's refine the stats query to be safe.
            solicitudes_web: parseInt(statsRes.rows[0].solicitudes_web || 0),
            facturacion_est: parseFloat(billingRes.rows[0].total || 0)
        };

        // Refined Stats Query to ensure 'en_taller' and 'solicitudes_web' are global (or relevant context)
        // and 'citas_hoy' is strictly today.
        const globalStatsRes = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM citataller WHERE fecha_hora BETWEEN $1 AND $2) as citas_hoy,
                (SELECT COUNT(*) FROM citataller WHERE estado = 'en proceso') as en_taller,
                (SELECT COUNT(*) FROM citataller WHERE estado = 'pendiente') as solicitudes_web
        `, [todayStart.toISOString(), todayEnd.toISOString()]);

        const finalStats = {
            citas_hoy: parseInt(globalStatsRes.rows[0].citas_hoy || 0),
            en_taller: parseInt(globalStatsRes.rows[0].en_taller || 0),
            solicitudes_web: parseInt(globalStatsRes.rows[0].solicitudes_web || 0),
            facturacion_est: parseFloat(billingRes.rows[0].total || 0)
        };

        res.json({ ok: true, citas: result.rows, stats: finalStats });
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener citas' });
    }
});

// PUT /api/citas/:id - Actualizar cita
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { estado, motivo, notas, fecha_hora, id_mecanico, id_sucursal } = req.body;

    try {
        // Obtener estado anterior para notificación
        let estadoAnterior = null;
        if (estado) {
            const citaActual = await pool.query('SELECT estado FROM citataller WHERE id = $1', [id]);
            if (citaActual.rows.length > 0) {
                estadoAnterior = citaActual.rows[0].estado;
            }
        }

        const result = await pool.query(`
            UPDATE citataller 
            SET estado = COALESCE($1, estado),
                motivo = COALESCE($2, motivo),
                notas = COALESCE($3, notas),
                fecha_hora = COALESCE($4, fecha_hora),
                id_mecanico = COALESCE($5, id_mecanico),
                id_sucursal = COALESCE($6, id_sucursal)
            WHERE id = $7
            RETURNING *
        `, [estado, motivo, notas, fecha_hora, id_mecanico, id_sucursal, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'Cita no encontrada' });
        }

        // Si cambió el estado, notificar al cliente
        if (estado && estadoAnterior && estado !== estadoAnterior) {
            try {
                const notificacionService = require('../services/notificacionService');
                await notificacionService.notificarCambioEstadoCita(id, estadoAnterior, estado);
            } catch (notifError) {
                console.warn('No se pudo crear notificación:', notifError.message);
            }
        }

        res.json({ ok: true, cita: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ ok: false, error: 'Error al actualizar cita' });
    }
});

// DELETE /api/citas/:id - Eliminar cita
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM citataller WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'Cita no encontrada' });
        }
        res.json({ ok: true, message: 'Cita eliminada' });
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ ok: false, error: 'Error al eliminar cita' });
    }
});

// POST /api/citas/crear - Crear nueva cita (Interno)
router.post('/crear', async (req, res) => {
    const { fecha_hora, motivo, cliente, vehiculo_categoria, sucursal_ref, duracion_min, notas, id_mecanico } = req.body;

    // Validación básica
    if (!sucursal_ref || !fecha_hora || !cliente || !cliente.email) {
        return res.status(400).json({
            ok: false,
            error: 'Faltan datos obligatorios (sucursal, fecha, email del cliente).'
        });
    }

    // Mapeo de sucursal
    let id_sucursal = parseInt(sucursal_ref);
    if (isNaN(id_sucursal)) {
        // Fallback para referencias antiguas de texto
        if (sucursal_ref === 'mella') id_sucursal = 2;
        else id_sucursal = 1; // Default
    }

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
            (id_sucursal, id_cliente, id_vehiculo, fecha_hora, duracion_min, estado, motivo, notas, creado_por, nombre_cliente, telefono_cliente, correo_cliente)
            VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, $7, NULL, $8, $9, $10)
            RETURNING id
        `, [
            id_sucursal,
            id_cliente,
            id_vehiculo,
            fecha_hora,
            duracion_min,
            motivo,
            notas,
            cliente.nombre,
            cliente.telefono,
            cliente.email
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

// POST /api/citas/:id/pago - Registrar pago manual (Manager)
router.post('/:id/pago', async (req, res) => {
    try {
        const { id } = req.params;
        const { method, amount, note } = req.body; // method: 'CASH', 'CARD_TERMINAL', 'OTHER'

        if (!id || !amount) {
            return res.status(400).json({ ok: false, error: 'Faltan datos requeridos (id, amount)' });
        }

        // Obtener datos de la cita
        const citaRes = await pool.query('SELECT * FROM citataller WHERE id = $1', [id]);
        if (citaRes.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Cita no encontrada' });
        }
        const cita = citaRes.rows[0];

        // Verificar si ya existe pago PAID
        const pagoExistente = await pool.query(
            `SELECT id FROM marketplace_reserva_pago WHERE id_cita = $1 AND status = 'PAID'`,
            [id]
        );

        if (pagoExistente.rows.length > 0) {
            return res.status(400).json({ ok: false, error: 'Esta cita ya tiene un pago registrado' });
        }

        // Registrar pago
        await pool.query(
            `INSERT INTO marketplace_reserva_pago 
             (id_tenant, id_sucursal, id_cita, id_cliente, payment_mode, amount, currency, status, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PAID', $8)`,
            [
                cita.id_tenant || 1, // Fallback si no tiene tenant
                cita.id_sucursal,
                id,
                cita.id_cliente,
                'MANUAL',
                amount,
                'eur',
                JSON.stringify({
                    manual_payment: true,
                    method: method,
                    note: note,
                    registered_at: new Date().toISOString(),
                    registered_by: 'manager' // Idealmente obtener del token
                })
            ]
        );

        res.json({ ok: true, message: 'Pago registrado correctamente' });

    } catch (error) {
        console.error('Error al registrar pago manual:', error);
        res.status(500).json({ ok: false, error: 'Error al registrar pago' });
    }
});

module.exports = router;
