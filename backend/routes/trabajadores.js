const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

/**
 * GET /api/trabajadores
 * Lista de trabajadores (usuarios que son técnicos/mecánicos, NO super admins)
 */
router.get('/', verifyJWT, async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { buscar } = req.query;

        // Solo usuarios que NO son super_admin
        let sql = `
            SELECT id, nombre, email, is_super_admin, porcentaje_mano_obra
            FROM usuario 
            WHERE id_tenant = $1`;
        const params = [id_tenant];

        if (buscar) {
            sql += ` AND (nombre ILIKE $2 OR email ILIKE $2)`;
            params.push(`%${buscar}%`);
        }

        sql += ` ORDER BY nombre ASC`;

        const result = await pool.query(sql, params);
        res.json({ ok: true, trabajadores: result.rows });
    } catch (error) {
        console.error('Error listando trabajadores:', error);
        res.status(500).json({ ok: false, error: 'Error al listar trabajadores' });
    }
});

/**
 * GET /api/trabajadores/:id/movimientos
 * Movimientos de cuenta del mecánico (ingresos por órdenes, pagos, adelantos)
 */
router.get('/:id/movimientos', verifyJWT, async (req, res) => {
    try {
        const id_mecanico = parseInt(req.params.id);
        const id_tenant = req.user.id_tenant;
        const { fechaDesde, fechaHasta, tipo, limit = 100, offset = 0, idSucursal } = req.query;

        // Verificar que el mecánico pertenece al tenant
        const mecanicoCheck = await pool.query(
            'SELECT id FROM usuario WHERE id = $1 AND id_tenant = $2',
            [id_mecanico, id_tenant]
        );
        if (mecanicoCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Mecánico no encontrado' });
        }

        let sql = `
            SELECT 
                cmm.id,
                cmm.tipo,
                cmm.monto,
                cmm.fecha,
                cmm.origen_tipo,
                cmm.origen_id,
                cmm.id_medio_pago,
                cmm.created_at,
                mp.nombre as medio_pago_nombre,
                mp.codigo as medio_pago_codigo,
                COALESCE(o.id_sucursal, c.id_sucursal) as inferred_sucursal
            FROM cuentamecanicomovimiento cmm
            LEFT JOIN mediopago mp ON cmm.id_medio_pago = mp.id
            LEFT JOIN orden o ON (cmm.origen_tipo = 'ORDEN' AND cmm.origen_id = o.id)
            LEFT JOIN cajamovimiento cm ON (cmm.origen_tipo = 'MANUAL' AND cm.origen_id = cmm.id AND cm.origen_tipo = 'PAGO_TRABAJADOR')
            LEFT JOIN caja c ON cm.id_caja = c.id
            WHERE cmm.id_mecanico = $1
        `;
        const params = [id_mecanico];
        let paramIndex = 2;

        if (fechaDesde) {
            sql += ` AND cmm.fecha >= $${paramIndex}`;
            params.push(fechaDesde);
            paramIndex++;
        }
        if (fechaHasta) {
            sql += ` AND cmm.fecha <= $${paramIndex}`;
            params.push(fechaHasta);
            paramIndex++;
        }
        if (tipo) {
            sql += ` AND cmm.tipo = $${paramIndex}`;
            params.push(tipo);
            paramIndex++;
        }
        if (idSucursal) {
            sql += ` AND COALESCE(o.id_sucursal, c.id_sucursal) = $${paramIndex}`;
            params.push(parseInt(idSucursal));
            paramIndex++;
        }

        sql += ` ORDER BY cmm.fecha DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(sql, params);

        // Calcular totales con los mismos filtros
        let totalesSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN cmm.tipo IN ('INGRESO', 'COMISION') THEN cmm.monto ELSE 0 END), 0) as total_ingresos,
                COALESCE(SUM(CASE WHEN cmm.tipo IN ('PAGO', 'ADELANTO', 'EGRESO') THEN cmm.monto ELSE 0 END), 0) as total_egresos
            FROM cuentamecanicomovimiento cmm
            LEFT JOIN orden o ON (cmm.origen_tipo = 'ORDEN' AND cmm.origen_id = o.id)
            LEFT JOIN cajamovimiento cm ON (cmm.origen_tipo = 'MANUAL' AND cm.origen_id = cmm.id AND cm.origen_tipo = 'PAGO_TRABAJADOR')
            LEFT JOIN caja c ON cm.id_caja = c.id
            WHERE cmm.id_mecanico = $1
        `;
        const totalesParams = [id_mecanico];
        let idx = 2;

        if (fechaDesde) {
            totalesSql += ` AND cmm.fecha >= $${idx}`;
            totalesParams.push(fechaDesde);
            idx++;
        }
        if (fechaHasta) {
            totalesSql += ` AND cmm.fecha <= $${idx}`;
            totalesParams.push(fechaHasta);
            idx++;
        }
        if (idSucursal) {
            totalesSql += ` AND COALESCE(o.id_sucursal, c.id_sucursal) = $${idx}`;
            totalesParams.push(parseInt(idSucursal));
            idx++;
        }

        const totalesResult = await pool.query(totalesSql, totalesParams);
        const totales = totalesResult.rows[0];

        res.json({
            ok: true,
            movimientos: result.rows,
            totales: {
                ingresos: parseFloat(totales.total_ingresos),
                egresos: parseFloat(totales.total_egresos),
                saldo: parseFloat(totales.total_ingresos) - parseFloat(totales.total_egresos)
            }
        });
    } catch (error) {
        console.error('Error obteniendo movimientos:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener movimientos' });
    }
});

/**
 * POST /api/trabajadores/:id/movimientos
 * Registrar un nuevo movimiento (pago, adelanto, etc.)
 * Si es efectivo, también registra en cajamovimiento como EGRESO
 */
router.post('/:id/movimientos', verifyJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const id_mecanico = parseInt(req.params.id);
        const id_tenant = req.user.id_tenant;
        const id_usuario = req.user.id;
        const { tipo, monto, fecha, origen_tipo, origen_id, descripcion, id_medio_pago, id_sucursal } = req.body;

        // Verificar que el mecánico pertenece al tenant
        const mecanicoCheck = await client.query(
            'SELECT id, nombre FROM usuario WHERE id = $1 AND id_tenant = $2',
            [id_mecanico, id_tenant]
        );
        if (mecanicoCheck.rows.length === 0) {
            client.release();
            return res.status(404).json({ ok: false, error: 'Mecánico no encontrado' });
        }
        const mecanico = mecanicoCheck.rows[0];

        // Validar tipo
        const tiposValidos = ['INGRESO', 'EGRESO', 'PAGO', 'ADELANTO', 'COMISION', 'AJUSTE'];
        if (!tiposValidos.includes(tipo)) {
            client.release();
            return res.status(400).json({ ok: false, error: 'Tipo de movimiento inválido' });
        }

        if (!monto || parseFloat(monto) <= 0) {
            client.release();
            return res.status(400).json({ ok: false, error: 'Monto debe ser mayor a 0' });
        }

        if (!id_medio_pago) {
            client.release();
            return res.status(400).json({ ok: false, error: 'Debe especificar el método de pago' });
        }

        // Verificar el medio de pago
        const medioPagoCheck = await client.query(
            'SELECT id, codigo, nombre FROM mediopago WHERE id = $1',
            [id_medio_pago]
        );
        if (medioPagoCheck.rows.length === 0) {
            client.release();
            return res.status(400).json({ ok: false, error: 'Método de pago no válido' });
        }
        const medioPago = medioPagoCheck.rows[0];
        // Efectivo afecta caja (código = 'CASH')
        const afectaCaja = medioPago.codigo === 'CASH';

        await client.query('BEGIN');

        // 1. Registrar movimiento en cuentamecanicomovimiento
        const movimientoResult = await client.query(`
            INSERT INTO cuentamecanicomovimiento 
                (id_mecanico, tipo, monto, fecha, origen_tipo, origen_id, id_medio_pago, created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            RETURNING *
        `, [
            id_mecanico,
            tipo,
            parseFloat(monto),
            fecha || new Date(),
            origen_tipo || 'MANUAL',
            origen_id || null,
            id_medio_pago,
            id_usuario
        ]);

        const movimiento = movimientoResult.rows[0];

        // 2. Siempre registrar movimiento de caja como EGRESO (indicando método de pago)
        let movimientoCaja = null;
        if (id_sucursal) {
            // Buscar la caja abierta de la sucursal
            const cajaResult = await client.query(
                'SELECT id FROM caja WHERE id_sucursal = $1 AND estado = $2 ORDER BY created_at DESC LIMIT 1',
                [id_sucursal, 'ABIERTA']
            );

            if (cajaResult.rows.length > 0) {
                const id_caja = cajaResult.rows[0].id;
                const conceptoPago = `Pago a ${mecanico.nombre} - ${tipo} (${medioPago.nombre})`;

                const cajaMovResult = await client.query(`
                    INSERT INTO cajamovimiento 
                        (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, origen_id, concepto, descripcion, created_at, created_by)
                    VALUES ($1, $2, 'EGRESO', $3, $4, 'PAGO_TRABAJADOR', $5, $6, $7, NOW(), $8)
                    RETURNING *
                `, [
                    id_caja,
                    id_usuario,
                    parseFloat(monto),
                    fecha || new Date(),
                    movimiento.id,
                    conceptoPago,
                    descripcion || `Método: ${medioPago.nombre}`,
                    id_usuario
                ]);
                movimientoCaja = cajaMovResult.rows[0];
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            ok: true,
            movimiento: movimiento,
            movimiento_caja: movimientoCaja,
            medio_pago: medioPago.nombre,
            medio_pago_codigo: medioPago.codigo
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creando movimiento:', error);
        res.status(500).json({ ok: false, error: 'Error al crear movimiento' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/trabajadores/:id/resumen
 * Resumen de cuenta del mecánico con órdenes asignadas
 */
router.get('/:id/resumen', verifyJWT, async (req, res) => {
    try {
        const id_mecanico = parseInt(req.params.id);
        const id_tenant = req.user.id_tenant;
        const { fechaDesde, fechaHasta, idSucursal } = req.query;

        // Verificar que el mecánico pertenece al tenant
        const mecanicoCheck = await pool.query(
            'SELECT id, nombre, email FROM usuario WHERE id = $1 AND id_tenant = $2',
            [id_mecanico, id_tenant]
        );
        if (mecanicoCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Mecánico no encontrado' });
        }

        const mecanico = mecanicoCheck.rows[0];

        // Obtener estadísticas de órdenes
        let ordenesQuery = `
            SELECT 
                COUNT(*) as total_ordenes,
                COALESCE(SUM(total_bruto), 0) as total_bruto,
                COALESCE(SUM(total_neto), 0) as total_neto
            FROM orden
            WHERE id_mecanico = $1
        `;
        const ordenesParams = [id_mecanico];
        let idx = 2;

        if (fechaDesde) {
            ordenesQuery += ` AND created_at >= $${idx}`;
            ordenesParams.push(fechaDesde);
            idx++;
        }
        if (fechaHasta) {
            ordenesQuery += ` AND created_at <= $${idx}`;
            ordenesParams.push(fechaHasta);
            idx++;
        }
        if (idSucursal) {
            ordenesQuery += ` AND id_sucursal = $${idx}`;
            ordenesParams.push(parseInt(idSucursal));
            idx++;
        }

        const ordenesResult = await pool.query(ordenesQuery, ordenesParams);
        const ordenesStats = ordenesResult.rows[0];

        // Obtener movimientos de cuenta
        let movQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN tipo IN ('INGRESO', 'COMISION') THEN monto ELSE 0 END), 0) as total_ingresos,
                COALESCE(SUM(CASE WHEN tipo IN ('PAGO', 'ADELANTO', 'EGRESO') THEN monto ELSE 0 END), 0) as total_pagos
            FROM cuentamecanicomovimiento
            WHERE id_mecanico = $1
        `;
        const movParams = [id_mecanico];
        idx = 2;

        if (fechaDesde) {
            movQuery += ` AND fecha >= $${idx}`;
            movParams.push(fechaDesde);
            idx++;
        }
        if (fechaHasta) {
            movQuery += ` AND fecha <= $${idx}`;
            movParams.push(fechaHasta);
            idx++;
        }

        const movResult = await pool.query(movQuery, movParams);
        const movStats = movResult.rows[0];

        res.json({
            ok: true,
            mecanico: {
                id: mecanico.id,
                nombre: mecanico.nombre,
                email: mecanico.email
            },
            ordenes: {
                total: parseInt(ordenesStats.total_ordenes),
                total_bruto: parseFloat(ordenesStats.total_bruto),
                total_neto: parseFloat(ordenesStats.total_neto)
            },
            cuenta: {
                total_ingresos: parseFloat(movStats.total_ingresos),
                total_pagos: parseFloat(movStats.total_pagos),
                saldo: parseFloat(movStats.total_ingresos) - parseFloat(movStats.total_pagos)
            }
        });
    } catch (error) {
        console.error('Error obteniendo resumen:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener resumen' });
    }
});

module.exports = router;
