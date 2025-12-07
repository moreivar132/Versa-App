/**
 * Rutas de API para el módulo de Caja
 * Adaptado a la estructura de BD existente
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

router.use(verifyJWT);

const formatCurrency = (value) => parseFloat(value || 0).toFixed(2);

// Obtener o crear caja abierta para sucursal
async function getCajaAbierta(idSucursal, idUsuario, client = null) {
    const executor = client || pool;
    let result = await executor.query(
        `SELECT c.*, u.nombre as usuario_apertura_nombre 
         FROM caja c 
         LEFT JOIN usuario u ON c.id_usuario_apertura = u.id 
         WHERE c.id_sucursal = $1 AND c.estado = 'ABIERTA' 
         ORDER BY c.created_at DESC LIMIT 1`,
        [idSucursal]
    );
    if (result.rows.length > 0) return result.rows[0];
    // Crear nueva caja abierta
    const insertResult = await executor.query(
        `INSERT INTO caja (id_sucursal, nombre, estado, id_usuario_apertura, created_by, created_at, updated_at)
         VALUES ($1, 'Caja Principal', 'ABIERTA', $2, $2, NOW(), NOW()) RETURNING *`,
        [idSucursal, idUsuario]
    );
    // Obtener nombre del usuario
    if (idUsuario) {
        const userResult = await executor.query('SELECT nombre FROM usuario WHERE id = $1', [idUsuario]);
        insertResult.rows[0].usuario_apertura_nombre = userResult.rows[0]?.nombre || 'Usuario';
    }
    return insertResult.rows[0];
}

// Obtener o crear caja chica para sucursal
async function getCajaChica(idSucursal, client = null) {
    const executor = client || pool;
    let result = await executor.query(`SELECT * FROM cajachica WHERE id_sucursal = $1 LIMIT 1`, [idSucursal]);
    if (result.rows.length > 0) return result.rows[0];
    const insertResult = await executor.query(
        `INSERT INTO cajachica (id_sucursal, nombre, saldo_actual, created_at, updated_at) 
         VALUES ($1, 'Caja Chica', 0, NOW(), NOW()) RETURNING *`,
        [idSucursal]
    );
    return insertResult.rows[0];
}

// Helper: Determinar si el usuario puede cambiar de sucursal
function puedeSeleccionarSucursal(user) {
    // Super admin siempre puede
    if (user.is_super_admin) return true;
    // Si tiene id_sucursal fijo (empleado/mecánico), NO puede cambiar
    if (user.id_sucursal) return false;
    // Admin de tenant sin sucursal fija puede elegir entre las del tenant
    return true;
}

// Helper: Resolver id_sucursal según permisos del usuario
async function resolverSucursal(req) {
    // EMPLEADOS/MECÁNICOS: siempre usar su sucursal asignada, ignorar query/body
    if (req.user.id_sucursal && !req.user.is_super_admin) {
        return req.user.id_sucursal;
    }

    // Si viene en query o body y el usuario puede seleccionar, usarlo
    const explicitId = req.query?.idsucursal || req.body?.idsucursal;
    if (explicitId && puedeSeleccionarSucursal(req.user)) {
        return parseInt(explicitId);
    }

    // Si el usuario tiene id_sucursal asignado, usarlo
    if (req.user.id_sucursal) {
        return req.user.id_sucursal;
    }

    // Super admin: buscar primera sucursal disponible
    if (req.user.is_super_admin) {
        const result = await pool.query('SELECT id FROM sucursal ORDER BY id LIMIT 1');
        if (result.rows.length > 0) return result.rows[0].id;
        return null;
    }

    // Usuario de tenant: buscar primera sucursal de su tenant
    if (req.user.id_tenant) {
        const result = await pool.query('SELECT id FROM sucursal WHERE id_tenant = $1 ORDER BY id LIMIT 1', [req.user.id_tenant]);
        if (result.rows.length > 0) return result.rows[0].id;
        return null;
    }

    return null;
}

// GET /api/caja/sucursales - Obtener sucursales disponibles según permisos
router.get('/sucursales', async (req, res) => {
    try {
        let sucursales = [];
        let puedeSeleccionar = puedeSeleccionarSucursal(req.user);
        let sucursalActual = null;

        if (req.user.is_super_admin) {
            // Super admin: todas las sucursales
            const result = await pool.query('SELECT s.id, s.nombre, t.nombre as tenant_nombre FROM sucursal s LEFT JOIN tenant t ON s.id_tenant = t.id ORDER BY t.nombre, s.nombre');
            sucursales = result.rows;
        } else if (req.user.id_sucursal) {
            // Empleado con sucursal fija: solo su sucursal
            const result = await pool.query('SELECT s.id, s.nombre, t.nombre as tenant_nombre FROM sucursal s LEFT JOIN tenant t ON s.id_tenant = t.id WHERE s.id = $1', [req.user.id_sucursal]);
            sucursales = result.rows;
            sucursalActual = req.user.id_sucursal;
        } else if (req.user.id_tenant) {
            // Admin de tenant: sucursales de su tenant
            const result = await pool.query('SELECT s.id, s.nombre, t.nombre as tenant_nombre FROM sucursal s LEFT JOIN tenant t ON s.id_tenant = t.id WHERE s.id_tenant = $1 ORDER BY s.nombre', [req.user.id_tenant]);
            sucursales = result.rows;
            // Si solo hay una, no puede seleccionar
            if (sucursales.length <= 1) puedeSeleccionar = false;
        }

        // Determinar sucursal actual si no está fija
        if (!sucursalActual && sucursales.length > 0) {
            sucursalActual = sucursales[0].id;
        }

        res.json({
            ok: true,
            sucursales,
            puede_seleccionar: puedeSeleccionar,
            sucursal_actual: sucursalActual
        });
    } catch (error) {
        console.error('Error en /sucursales:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    }
});

// GET /api/caja/estado-actual
router.get('/estado-actual', async (req, res) => {
    try {
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'No se encontró sucursal asignada. Configure una sucursal para el usuario.' });

        const caja = await getCajaAbierta(idSucursal, req.user.id);

        // Totales por método de pago desde ordenpago
        const totalesPagoResult = await pool.query(`
            SELECT mp.codigo, mp.nombre, COALESCE(SUM(op.importe), 0) as total
            FROM ordenpago op 
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_caja = $1 
            GROUP BY mp.id, mp.codigo, mp.nombre
        `, [caja.id]);

        // Movimientos manuales de caja
        const movimientosResult = await pool.query(`
            SELECT tipo, COALESCE(SUM(monto), 0) as total 
            FROM cajamovimiento WHERE id_caja = $1 GROUP BY tipo
        `, [caja.id]);

        let totalIngresos = 0, totalEgresos = 0;
        movimientosResult.rows.forEach(row => {
            if (row.tipo === 'INGRESO') totalIngresos += parseFloat(row.total);
            else if (row.tipo === 'EGRESO') totalEgresos += parseFloat(row.total);
        });

        const efectivoPagos = totalesPagoResult.rows.filter(r => r.codigo === 'CASH').reduce((s, r) => s + parseFloat(r.total), 0);
        const tarjetaPagos = totalesPagoResult.rows.filter(r => r.codigo !== 'CASH').reduce((s, r) => s + parseFloat(r.total), 0);

        // El saldo de apertura viene del último cierre o es 0
        const ultimoCierreResult = await pool.query(
            `SELECT saldo_real FROM cajacierre WHERE id_caja = $1 ORDER BY fecha DESC LIMIT 1`,
            [caja.id]
        );
        const saldoApertura = ultimoCierreResult.rows[0]?.saldo_real || 0;
        const efectivoEsperado = parseFloat(saldoApertura) + efectivoPagos + totalIngresos - totalEgresos;

        // Detalle de operaciones por tipo
        const detalleOperacionesResult = await pool.query(`
            SELECT 
                COALESCE(to2.codigo, 'OTRO') as tipo_codigo,
                COALESCE(to2.nombre, 'Otros') as tipo_nombre,
                COALESCE(SUM(CASE WHEN mp.codigo = 'CASH' THEN op.importe ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN mp.codigo != 'CASH' THEN op.importe ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(op.importe), 0) as total
            FROM ordenpago op
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            JOIN orden o ON op.id_orden = o.id
            LEFT JOIN tipoorden to2 ON o.id_tipoorden = to2.id
            WHERE op.id_caja = $1
            GROUP BY to2.codigo, to2.nombre
            ORDER BY total DESC
        `, [caja.id]);

        // Movimientos manuales de caja (ingresos/egresos)
        const movimientosCajaDetalle = await pool.query(`
            SELECT 
                tipo,
                COALESCE(SUM(monto), 0) as total
            FROM cajamovimiento 
            WHERE id_caja = $1 
            GROUP BY tipo
        `, [caja.id]);

        // Construir detalle de operaciones
        const detalleOperaciones = [
            ...detalleOperacionesResult.rows.map(r => ({
                operacion: r.tipo_nombre,
                efectivo: formatCurrency(r.efectivo),
                tarjeta: formatCurrency(r.tarjeta),
                total: formatCurrency(r.total),
                es_gasto: false
            }))
        ];

        // Agregar movimientos manuales
        const ingresosManual = movimientosCajaDetalle.rows.find(r => r.tipo === 'INGRESO');
        const egresosManual = movimientosCajaDetalle.rows.find(r => r.tipo === 'EGRESO');

        if (ingresosManual && parseFloat(ingresosManual.total) > 0) {
            detalleOperaciones.push({
                operacion: 'Movimientos de caja (ingresos)',
                efectivo: formatCurrency(ingresosManual.total),
                tarjeta: '-',
                total: formatCurrency(ingresosManual.total),
                es_gasto: false
            });
        }

        if (egresosManual && parseFloat(egresosManual.total) > 0) {
            detalleOperaciones.push({
                operacion: 'Movimientos de caja (egresos)',
                efectivo: formatCurrency(-egresosManual.total),
                tarjeta: '-',
                total: formatCurrency(-egresosManual.total),
                es_gasto: true
            });
        }

        const cajaChica = await getCajaChica(idSucursal);

        res.json({
            ok: true,
            caja: {
                id: caja.id,
                estado: caja.estado,
                nombre: caja.nombre,
                usuario_apertura: caja.usuario_apertura_nombre || 'Usuario',
                fecha_apertura: caja.created_at,
                saldo_apertura: formatCurrency(saldoApertura),
                id_sucursal: caja.id_sucursal
            },
            totales: {
                efectivo: formatCurrency(efectivoPagos),
                tarjeta: formatCurrency(tarjetaPagos),
                ingresos_efectivo: formatCurrency(efectivoPagos + totalIngresos),
                egresos_efectivo: formatCurrency(totalEgresos),
                efectivo_esperado: formatCurrency(efectivoEsperado),
                total_periodo: formatCurrency(efectivoPagos + tarjetaPagos + totalIngresos - totalEgresos)
            },
            caja_chica: {
                saldo: formatCurrency(cajaChica.saldo_actual),
                ultimo_movimiento: cajaChica.updated_at
            },
            detalle_metodos_pago: totalesPagoResult.rows.map(r => ({
                codigo: r.codigo,
                nombre: r.nombre,
                total: formatCurrency(r.total)
            })),
            detalle_operaciones: detalleOperaciones
        });
    } catch (error) {
        console.error('Error en /caja/estado-actual:', error);
        res.status(500).json({ ok: false, error: 'Error interno', details: error.message });
    }
});

// GET /api/caja/movimientos
router.get('/movimientos', async (req, res) => {
    try {
        const { tipo, fecha_desde, fecha_hasta, page = 1, limit = 20 } = req.query;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const offset = (page - 1) * limit;

        let query = `
            SELECT cm.id, cm.tipo, cm.monto, cm.fecha, cm.origen_tipo, u.nombre as usuario
            FROM cajamovimiento cm 
            JOIN caja c ON cm.id_caja = c.id 
            LEFT JOIN usuario u ON cm.id_usuario = u.id 
            WHERE c.id_sucursal = $1`;
        const params = [idSucursal];
        let pi = 2;

        if (tipo) { query += ` AND cm.tipo = $${pi++}`; params.push(tipo); }
        if (fecha_desde) { query += ` AND cm.fecha >= $${pi++}`; params.push(fecha_desde); }
        if (fecha_hasta) { query += ` AND cm.fecha <= $${pi++}`; params.push(fecha_hasta); }

        const countResult = await pool.query(
            query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM'),
            params
        );
        query += ` ORDER BY cm.fecha DESC LIMIT $${pi++} OFFSET $${pi++}`;
        params.push(parseInt(limit), parseInt(offset));
        const result = await pool.query(query, params);

        res.json({
            ok: true,
            movimientos: result.rows.map(m => ({
                id: m.id,
                tipo: m.tipo,
                monto: formatCurrency(m.monto),
                fecha: m.fecha,
                usuario: m.usuario || 'Sistema',
                origen_tipo: m.origen_tipo
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error en /caja/movimientos:', error);
        res.status(500).json({ ok: false, error: 'Error interno', details: error.message });
    }
});

// GET /api/caja/cierres
router.get('/cierres', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const result = await pool.query(`
            SELECT cc.id, cc.fecha, cc.saldo_inicial, cc.saldo_teorico, cc.saldo_real, cc.diferencia,
                   c.nombre as caja_nombre, u.nombre as usuario_cierre
            FROM cajacierre cc 
            JOIN caja c ON cc.id_caja = c.id 
            LEFT JOIN usuario u ON cc.id_usuario = u.id
            WHERE c.id_sucursal = $1 
            ORDER BY cc.fecha DESC 
            LIMIT $2 OFFSET $3
        `, [idSucursal, parseInt(limit), (page - 1) * limit]);

        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM cajacierre cc JOIN caja c ON cc.id_caja = c.id WHERE c.id_sucursal = $1`,
            [idSucursal]
        );

        res.json({
            ok: true,
            cierres: result.rows.map(c => ({
                id: c.id,
                fecha_cierre: c.fecha,
                saldo_inicial: formatCurrency(c.saldo_inicial),
                saldo_teorico: formatCurrency(c.saldo_teorico),
                saldo_real: formatCurrency(c.saldo_real),
                diferencia: formatCurrency(c.diferencia),
                caja_nombre: c.caja_nombre,
                usuario_cierre: c.usuario_cierre,
                resultado_periodo: formatCurrency(parseFloat(c.saldo_real) - parseFloat(c.saldo_inicial))
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total)
            }
        });
    } catch (error) {
        console.error('Error en /caja/cierres:', error);
        res.status(500).json({ ok: false, error: 'Error interno', details: error.message });
    }
});

// GET /api/caja/cierres/:id
router.get('/cierres/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cc.*, c.nombre as caja_nombre, u.nombre as usuario_cierre
            FROM cajacierre cc 
            JOIN caja c ON cc.id_caja = c.id 
            LEFT JOIN usuario u ON cc.id_usuario = u.id 
            WHERE cc.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ ok: false, error: 'Cierre no encontrado' });
        const cierre = result.rows[0];

        const movResult = await pool.query(
            `SELECT id, tipo, monto, fecha, origen_tipo FROM cajamovimiento WHERE id_caja = $1 ORDER BY fecha DESC`,
            [cierre.id_caja]
        );

        res.json({
            ok: true,
            cierre: {
                ...cierre,
                saldo_inicial: formatCurrency(cierre.saldo_inicial),
                saldo_teorico: formatCurrency(cierre.saldo_teorico),
                saldo_real: formatCurrency(cierre.saldo_real)
            },
            movimientos: movResult.rows
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    }
});

// POST /api/caja/cerrar
router.post('/cerrar', async (req, res) => {
    const client = await pool.connect();
    try {
        const { saldo_real, a_caja_chica, descripcion } = req.body;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const idUsuario = req.user.id;

        if (saldo_real == null) return res.status(400).json({ ok: false, error: 'Saldo real (contado) es requerido' });

        await client.query('BEGIN');

        const cajaResult = await client.query(
            `SELECT * FROM caja WHERE id_sucursal = $1 AND estado = 'ABIERTA' LIMIT 1`,
            [idSucursal]
        );
        if (cajaResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ ok: false, error: 'No hay caja abierta' });
        }
        const caja = cajaResult.rows[0];

        // Calcular saldo teórico
        const movResult = await client.query(
            `SELECT tipo, COALESCE(SUM(monto), 0) as total FROM cajamovimiento WHERE id_caja = $1 GROUP BY tipo`,
            [caja.id]
        );
        let totalIngresos = 0, totalEgresos = 0;
        movResult.rows.forEach(r => {
            if (r.tipo === 'INGRESO') totalIngresos += parseFloat(r.total);
            else if (r.tipo === 'EGRESO') totalEgresos += parseFloat(r.total);
        });

        const efPagosResult = await client.query(`
            SELECT COALESCE(SUM(op.importe), 0) as total 
            FROM ordenpago op 
            JOIN mediopago mp ON op.id_medio_pago = mp.id 
            WHERE op.id_caja = $1 AND mp.codigo = 'CASH'
        `, [caja.id]);
        const efectivoPagos = parseFloat(efPagosResult.rows[0].total);

        // Obtener saldo inicial del último cierre
        const ultimoCierreResult = await client.query(
            `SELECT saldo_real FROM cajacierre WHERE id_caja = $1 ORDER BY fecha DESC LIMIT 1`,
            [caja.id]
        );
        const saldoInicial = parseFloat(ultimoCierreResult.rows[0]?.saldo_real || 0);
        const saldoTeorico = saldoInicial + efectivoPagos + totalIngresos - totalEgresos;
        const saldoRealNum = parseFloat(saldo_real);
        const diferencia = saldoRealNum - saldoTeorico;

        // Crear cierre
        const cierreResult = await client.query(`
            INSERT INTO cajacierre (id_caja, id_usuario, fecha, saldo_inicial, saldo_teorico, saldo_real, diferencia, created_at)
            VALUES ($1, $2, NOW(), $3, $4, $5, $6, NOW()) RETURNING *
        `, [caja.id, idUsuario, saldoInicial, saldoTeorico, saldoRealNum, diferencia]);

        // Si hay envío a caja chica
        const montoACajaChica = parseFloat(a_caja_chica) || 0;
        if (montoACajaChica > 0) {
            // Movimiento de egreso en caja
            const movCaja = await client.query(`
                INSERT INTO cajamovimiento (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, origen_id, created_at, created_by) 
                VALUES ($1, $2, 'EGRESO', $3, NOW(), 'CIERRE', $4, NOW(), $2) RETURNING id
            `, [caja.id, idUsuario, montoACajaChica, cierreResult.rows[0].id]);

            // Movimiento en caja chica
            const cajaChica = await getCajaChica(idSucursal, client);
            await client.query(`
                INSERT INTO cajachicamovimiento (id_cajachica, id_usuario, tipo, monto, fecha, descripcion, origen_tipo, origen_id, id_cajamovimiento, created_at, created_by) 
                VALUES ($1, $2, 'INTERNO', $3, NOW(), $4, 'CIERRE', $5, $6, NOW(), $2)
            `, [cajaChica.id, idUsuario, montoACajaChica, descripcion || 'Desde cierre de caja', cierreResult.rows[0].id, movCaja.rows[0].id]);

            await client.query(`UPDATE cajachica SET saldo_actual = saldo_actual + $1, updated_at = NOW() WHERE id = $2`, [montoACajaChica, cajaChica.id]);
        }

        // Cerrar caja actual
        await client.query(`UPDATE caja SET estado = 'CERRADA', updated_at = NOW() WHERE id = $1`, [caja.id]);

        // Crear nueva caja abierta
        await client.query(`
            INSERT INTO caja (id_sucursal, nombre, estado, created_at, updated_at) 
            VALUES ($1, 'Caja Principal', 'ABIERTA', NOW(), NOW())
        `, [idSucursal]);

        await client.query('COMMIT');
        res.json({
            ok: true,
            message: 'Caja cerrada correctamente',
            cierre: {
                id: cierreResult.rows[0].id,
                saldo_teorico: formatCurrency(saldoTeorico),
                saldo_real: formatCurrency(saldoRealNum),
                diferencia: formatCurrency(diferencia)
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno', details: error.message });
    } finally { client.release(); }
});

// POST /api/caja/enviar-caja-chica
router.post('/enviar-caja-chica', async (req, res) => {
    const client = await pool.connect();
    try {
        const { monto, descripcion } = req.body;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const idUsuario = req.user.id;

        if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ ok: false, error: 'Monto debe ser mayor a 0' });

        await client.query('BEGIN');
        const caja = await getCajaAbierta(idSucursal, idUsuario, client);
        const montoNum = parseFloat(monto);

        // Movimiento egreso en caja principal
        const movCajaResult = await client.query(`
            INSERT INTO cajamovimiento (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, created_at, created_by) 
            VALUES ($1, $2, 'EGRESO', $3, NOW(), 'CAJA_CHICA', NOW(), $2) RETURNING id
        `, [caja.id, idUsuario, montoNum]);

        // Movimiento ingreso en caja chica
        const cajaChica = await getCajaChica(idSucursal, client);
        await client.query(`
            INSERT INTO cajachicamovimiento (id_cajachica, id_usuario, tipo, monto, fecha, descripcion, origen_tipo, id_cajamovimiento, created_at, created_by) 
            VALUES ($1, $2, 'INTERNO', $3, NOW(), $4, 'CAJA_PRINCIPAL', $5, NOW(), $2)
        `, [cajaChica.id, idUsuario, montoNum, descripcion || 'Transferencia desde caja', movCajaResult.rows[0].id]);

        await client.query(`UPDATE cajachica SET saldo_actual = saldo_actual + $1, updated_at = NOW() WHERE id = $2`, [montoNum, cajaChica.id]);

        await client.query('COMMIT');
        res.json({
            ok: true,
            message: 'Transferencia realizada',
            monto: formatCurrency(montoNum),
            nuevo_saldo: formatCurrency(parseFloat(cajaChica.saldo_actual) + montoNum)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    } finally { client.release(); }
});

// GET /api/caja/chica/estado
router.get('/chica/estado', async (req, res) => {
    try {
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const cajaChica = await getCajaChica(idSucursal);

        const ultimoMovResult = await pool.query(`
            SELECT ccm.*, u.nombre as usuario 
            FROM cajachicamovimiento ccm 
            LEFT JOIN usuario u ON ccm.id_usuario = u.id 
            WHERE ccm.id_cajachica = $1 
            ORDER BY ccm.fecha DESC LIMIT 1
        `, [cajaChica.id]);

        res.json({
            ok: true,
            caja_chica: {
                id: cajaChica.id,
                nombre: cajaChica.nombre,
                saldo_actual: formatCurrency(cajaChica.saldo_actual),
                ultimo_movimiento: ultimoMovResult.rows[0] || null
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    }
});

// GET /api/caja/chica/movimientos
router.get('/chica/movimientos', async (req, res) => {
    try {
        const { tipo, fecha_desde, fecha_hasta, page = 1, limit = 20 } = req.query;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const cajaChica = await getCajaChica(idSucursal);

        let query = `
            SELECT ccm.id, ccm.tipo, ccm.monto, ccm.fecha, ccm.descripcion, ccm.origen_tipo, u.nombre as usuario 
            FROM cajachicamovimiento ccm 
            LEFT JOIN usuario u ON ccm.id_usuario = u.id 
            WHERE ccm.id_cajachica = $1`;
        const params = [cajaChica.id];
        let pi = 2;

        if (tipo) { query += ` AND ccm.tipo = $${pi++}`; params.push(tipo); }
        if (fecha_desde) { query += ` AND ccm.fecha >= $${pi++}`; params.push(fecha_desde); }
        if (fecha_hasta) { query += ` AND ccm.fecha <= $${pi++}`; params.push(fecha_hasta); }

        const countResult = await pool.query(
            query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM'),
            params
        );
        query += ` ORDER BY ccm.fecha DESC LIMIT $${pi++} OFFSET $${pi++}`;
        params.push(parseInt(limit), (page - 1) * limit);
        const result = await pool.query(query, params);

        res.json({
            ok: true,
            movimientos: result.rows.map(m => ({
                id: m.id,
                tipo: m.tipo,
                monto: formatCurrency(m.monto),
                fecha: m.fecha,
                usuario: m.usuario || 'Sistema',
                descripcion: m.descripcion,
                origen_tipo: m.origen_tipo
            })),
            pagination: {
                page: parseInt(page),
                total: parseInt(countResult.rows[0].total)
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    }
});

// POST /api/caja/chica/movimientos
router.post('/chica/movimientos', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tipo, monto, descripcion } = req.body;
        const idSucursal = await resolverSucursal(req);
        if (!idSucursal) return res.status(400).json({ ok: false, error: 'Sucursal no especificada' });
        const idUsuario = req.user.id;

        if (!tipo || !['INGRESO', 'EGRESO'].includes(tipo)) return res.status(400).json({ ok: false, error: 'Tipo inválido' });
        if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ ok: false, error: 'Monto debe ser mayor a 0' });
        if (tipo === 'EGRESO' && !descripcion) return res.status(400).json({ ok: false, error: 'Descripción obligatoria para egresos' });

        await client.query('BEGIN');
        const cajaChica = await getCajaChica(idSucursal, client);
        const montoNum = parseFloat(monto);

        if (tipo === 'EGRESO' && montoNum > parseFloat(cajaChica.saldo_actual)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ ok: false, error: 'Saldo insuficiente' });
        }

        await client.query(`
            INSERT INTO cajachicamovimiento (id_cajachica, id_usuario, tipo, monto, fecha, descripcion, origen_tipo, created_at, created_by) 
            VALUES ($1, $2, $3, $4, NOW(), $5, 'MANUAL', NOW(), $2)
        `, [cajaChica.id, idUsuario, tipo, montoNum, descripcion]);

        const nuevoSaldo = tipo === 'INGRESO'
            ? parseFloat(cajaChica.saldo_actual) + montoNum
            : parseFloat(cajaChica.saldo_actual) - montoNum;
        await client.query(`UPDATE cajachica SET saldo_actual = $1, updated_at = NOW() WHERE id = $2`, [nuevoSaldo, cajaChica.id]);

        await client.query('COMMIT');
        res.json({ ok: true, message: 'Movimiento registrado', nuevo_saldo: formatCurrency(nuevoSaldo) });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ ok: false, error: 'Error interno' });
    } finally { client.release(); }
});

module.exports = router;
