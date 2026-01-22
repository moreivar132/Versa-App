/**
 * Rutas API para el módulo de Cuentas Corrientes
 * 
 * Endpoints para gestionar cuentas corrientes de clientes,
 * movimientos y cobros.
 */

const express = require('express');
const router = express.Router();
const { getTenantDb } = require('../src/core/db/tenant-db');
const verifyJWT = require('../middleware/auth');

// Middleware to inject tenant-safe DB wrapper
router.use((req, _res, next) => {
    req.db = getTenantDb(req.ctx);
    next();
});

// =====================================================
// ENDPOINTS DE CUENTAS CORRIENTES
// =====================================================

/**
 * GET /api/cuentas-corrientes
 * Lista todas las cuentas corrientes con saldo del tenant
 */
router.get('/', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user?.id_tenant || req.query.tenantId;
        const { estado, busqueda, limit = 100, offset = 0 } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        let query = `
            SELECT 
                cc.id,
                cc.id_cliente,
                cf.nombre AS cliente_nombre,
                cf.telefono AS cliente_telefono,
                cf.documento AS cliente_nif,
                cc.limite_credito,
                cc.saldo_actual,
                cc.estado,
                cc.fecha_apertura,
                cc.notas,
                cc.created_at,
                (SELECT COUNT(*) FROM movimientocuenta mc WHERE mc.id_cuenta_corriente = cc.id) AS total_movimientos,
                (SELECT MAX(mc.fecha_movimiento) FROM movimientocuenta mc WHERE mc.id_cuenta_corriente = cc.id) AS ultimo_movimiento
            FROM cuentacorriente cc
            JOIN clientefinal cf ON cc.id_cliente = cf.id
            WHERE cc.id_tenant = $1
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (estado && estado !== 'all') {
            query += ` AND cc.estado = $${paramIndex}`;
            params.push(estado);
            paramIndex++;
        }

        if (busqueda) {
            query += ` AND (
                cf.nombre ILIKE $${paramIndex} OR 
                cf.telefono ILIKE $${paramIndex} OR 
                cf.documento ILIKE $${paramIndex}
            )`;
            params.push(`%${busqueda}%`);
            paramIndex++;
        }

        query += ` ORDER BY cc.saldo_actual DESC, cf.nombre ASC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await req.db.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Error al listar cuentas corrientes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/cuentas-corrientes/stats
 * Estadísticas generales de cuentas corrientes
 */
router.get('/stats', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user?.id_tenant || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        // Deuda total
        const deudaTotal = await req.db.query(`
            SELECT COALESCE(SUM(saldo_actual), 0) AS total
            FROM cuentacorriente
            WHERE id_tenant = $1 AND estado = 'ACTIVA' AND saldo_actual > 0
        `, [tenantId]);

        // Cobrado este mes
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const cobradoMes = await req.db.query(`
            SELECT COALESCE(SUM(mc.importe), 0) AS total
            FROM movimientocuenta mc
            JOIN cuentacorriente cc ON mc.id_cuenta_corriente = cc.id
            WHERE cc.id_tenant = $1 
              AND mc.tipo_movimiento = 'ABONO'
              AND mc.fecha_movimiento >= $2
        `, [tenantId, inicioMes.toISOString().split('T')[0]]);

        // Movimientos de hoy
        const hoy = new Date().toISOString().split('T')[0];
        const movimientosHoy = await req.db.query(`
            SELECT COUNT(*) AS total
            FROM movimientocuenta mc
            JOIN cuentacorriente cc ON mc.id_cuenta_corriente = cc.id
            WHERE cc.id_tenant = $1 AND DATE(mc.created_at) = $2
        `, [tenantId, hoy]);

        // Clientes con cuenta
        const clientesCuenta = await req.db.query(`
            SELECT COUNT(*) AS total FROM cuentacorriente WHERE id_tenant = $1
        `, [tenantId]);

        res.json({
            success: true,
            data: {
                deudaTotal: parseFloat(deudaTotal.rows[0].total) || 0,
                cobradoMes: parseFloat(cobradoMes.rows[0].total) || 0,
                movimientosHoy: parseInt(movimientosHoy.rows[0].total) || 0,
                clientesCuenta: parseInt(clientesCuenta.rows[0].total) || 0
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/cuentas-corrientes/movimientos
 * Lista movimientos con filtros
 */
router.get('/movimientos', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user?.id_tenant || req.query.tenantId;
        const {
            busqueda,
            tipo,
            periodo = 'mes',
            limit = 50,
            offset = 0
        } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        // Calcular fecha según periodo
        let fechaDesde = null;
        const hoy = new Date();

        switch (periodo) {
            case 'hoy':
                fechaDesde = hoy.toISOString().split('T')[0];
                break;
            case 'semana':
                const inicioSemana = new Date(hoy);
                inicioSemana.setDate(hoy.getDate() - 7);
                fechaDesde = inicioSemana.toISOString().split('T')[0];
                break;
            case 'mes':
                const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaDesde = inicioMes.toISOString().split('T')[0];
                break;
            case 'trimestre':
                const inicioTrimestre = new Date(hoy.getFullYear(), Math.floor(hoy.getMonth() / 3) * 3, 1);
                fechaDesde = inicioTrimestre.toISOString().split('T')[0];
                break;
            case 'anio':
                fechaDesde = `${hoy.getFullYear()}-01-01`;
                break;
            case 'custom':
                // Se usarán fechaInicio y fechaFin del query
                break;
            // 'todo' no filtra por fecha
        }

        let query = `
            SELECT 
                mc.id,
                mc.fecha_movimiento,
                mc.tipo_movimiento,
                mc.importe,
                mc.concepto,
                mc.saldo_anterior,
                mc.saldo_posterior,
                mc.id_orden,
                mc.id_factura,
                mc.referencia_externa,
                mc.created_at,
                cc.id AS id_cuenta_corriente,
                cc.saldo_actual,
                cf.id AS id_cliente,
                cf.nombre AS cliente_nombre,
                cf.telefono AS cliente_telefono
            FROM movimientocuenta mc
            JOIN cuentacorriente cc ON mc.id_cuenta_corriente = cc.id
            JOIN clientefinal cf ON cc.id_cliente = cf.id
            WHERE cc.id_tenant = $1
        `;
        const params = [tenantId];
        let paramIndex = 2;

        const { fechaInicio, fechaFin } = req.query;

        if (periodo === 'custom') {
            if (fechaInicio) {
                query += ` AND mc.fecha_movimiento >= $${paramIndex}`;
                params.push(fechaInicio);
                paramIndex++;
            }
            if (fechaFin) {
                query += ` AND mc.fecha_movimiento <= $${paramIndex}`;
                params.push(fechaFin);
                paramIndex++;
            }
        } else if (fechaDesde) {
            query += ` AND mc.fecha_movimiento >= $${paramIndex}`;
            params.push(fechaDesde);
            paramIndex++;
        }

        if (tipo && tipo !== 'all') {
            const tipoMov = tipo === 'DEUDA' ? 'CARGO' : 'ABONO';
            query += ` AND mc.tipo_movimiento = $${paramIndex}`;
            params.push(tipoMov);
            paramIndex++;
        }

        if (busqueda) {
            query += ` AND (
                cf.nombre ILIKE $${paramIndex} OR 
                mc.concepto ILIKE $${paramIndex}
            )`;
            params.push(`%${busqueda}%`);
            paramIndex++;
        }

        // Nuevo: Filtrado por ID Cliente exacto (para el autocomplete)
        const { idCliente } = req.query;
        if (idCliente) {
            query += ` AND cf.id = $${paramIndex}`;
            params.push(idCliente);
            paramIndex++;
        }

        query += ` ORDER BY mc.fecha_movimiento DESC, mc.created_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await req.db.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Error al listar movimientos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/cuentas-corrientes/cliente/:idCliente
 * Obtiene o crea cuenta corriente de un cliente
 */
router.get('/cliente/:idCliente', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user?.id_tenant || req.query.tenantId;
        const idCliente = parseInt(req.params.idCliente);
        const { crear = false } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        // Buscar cuenta existente
        let cuenta = await req.db.query(`
            SELECT cc.*, cf.nombre AS cliente_nombre
            FROM cuentacorriente cc
            JOIN clientefinal cf ON cc.id_cliente = cf.id
            WHERE cc.id_cliente = $1 AND cc.id_tenant = $2
        `, [idCliente, tenantId]);

        if (cuenta.rows.length > 0) {
            return res.json({
                success: true,
                data: cuenta.rows[0],
                existente: true
            });
        }

        // Si no existe y se pidió crear
        if (crear === 'true' || crear === true) {
            const nueva = await req.db.query(`
                INSERT INTO cuentacorriente (id_cliente, id_tenant, created_by)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [idCliente, tenantId, req.user?.id]);

            // Obtener con datos del cliente
            cuenta = await req.db.query(`
                SELECT cc.*, cf.nombre AS cliente_nombre
                FROM cuentacorriente cc
                JOIN clientefinal cf ON cc.id_cliente = cf.id
                WHERE cc.id = $1
            `, [nueva.rows[0].id]);

            return res.json({
                success: true,
                data: cuenta.rows[0],
                existente: false,
                message: 'Cuenta corriente creada'
            });
        }

        res.json({
            success: true,
            data: null,
            existente: false
        });

    } catch (error) {
        console.error('Error al obtener cuenta del cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/cuentas-corrientes/cargar
 * Carga un importe genérico a la cuenta corriente de un cliente
 * Body: { idCliente, importe, concepto, idSucursal }
 */
router.post('/cargar', verifyJWT, async (req, res) => {
    try {
        const { idCliente, importe, concepto, idSucursal } = req.body;
        const tenantId = req.user?.id_tenant;
        const userId = req.user?.id;

        if (!idCliente || !importe) {
            return res.status(400).json({ success: false, error: 'Cliente e importe son obligatorios' });
        }

        if (importe <= 0) {
            return res.status(400).json({ success: false, error: 'El importe debe ser mayor a 0' });
        }

        const result = await req.db.txWithRLS(async (tx) => {
            // 1. Obtener o crear cuenta corriente del cliente
            let cuentaResult = await tx.query(`
                SELECT id, saldo_actual FROM cuentacorriente 
                WHERE id_cliente = $1 AND id_tenant = $2
            `, [idCliente, tenantId]);

            let idCuenta;
            let saldoAnterior;

            if (cuentaResult.rows.length === 0) {
                // Crear cuenta corriente
                const nuevaCuenta = await tx.query(`
                    INSERT INTO cuentacorriente (id_cliente, id_tenant, saldo_actual, estado, created_by)
                    VALUES ($1, $2, 0, 'ACTIVA', $3)
                    RETURNING id
                `, [idCliente, tenantId, userId]);
                idCuenta = nuevaCuenta.rows[0].id;
                saldoAnterior = 0;
            } else {
                idCuenta = cuentaResult.rows[0].id;
                saldoAnterior = parseFloat(cuentaResult.rows[0].saldo_actual) || 0;
            }

            // 2. Crear movimiento de cargo
            const saldoPosterior = saldoAnterior + parseFloat(importe);

            await tx.query(`
                INSERT INTO movimientocuenta (
                    id_cuenta_corriente,
                    tipo_movimiento,
                    importe,
                    saldo_anterior,
                    saldo_posterior,
                    concepto,
                    created_by
                ) VALUES ($1, 'CARGO', $2, $3, $4, $5, $6)
            `, [
                idCuenta,
                importe,
                saldoAnterior,
                saldoPosterior,
                concepto || 'Cargo a cuenta corriente',
                userId
            ]);

            // 3. Actualizar saldo de la cuenta
            await tx.query(`
                UPDATE cuentacorriente SET saldo_actual = $1 WHERE id = $2
            `, [saldoPosterior, idCuenta]);

            return { idCuenta, saldoAnterior, saldoPosterior };
        });

        res.json({
            success: true,
            message: `${parseFloat(importe).toFixed(2)}€ cargados a cuenta corriente`,
            data: {
                idCuenta: result.idCuenta,
                saldoAnterior: result.saldoAnterior,
                saldoPosterior: result.saldoPosterior,
                importe: parseFloat(importe)
            }
        });

    } catch (error) {
        console.error('Error al cargar a cuenta corriente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/cuentas-corrientes/cargar-orden
 * Carga el saldo pendiente de una orden a cuenta corriente
 */
router.post('/cargar-orden', verifyJWT, async (req, res) => {
    try {
        console.log('[DEBUG cargar-orden] Body recibido:', req.body);
        const { idOrden } = req.body;
        const tenantId = req.user?.id_tenant;
        const userId = req.user?.id;

        if (!idOrden) {
            console.log('[DEBUG cargar-orden] ERROR: idOrden no encontrado en body');
            return res.status(400).json({ success: false, error: 'ID de orden requerido' });
        }

        const result = await req.db.txWithRLS(async (tx) => {
            // 1. Obtener datos de la orden
            const ordenResult = await tx.query(`
                SELECT 
                    o.id,
                    o.id_cliente,
                    o.total_neto,
                    o.en_cuenta_corriente,
                    o.id_sucursal,
                    s.id_tenant,
                    COALESCE((SELECT SUM(importe) FROM ordenpago WHERE id_orden = o.id), 0) AS total_pagado
                FROM orden o
                JOIN sucursal s ON o.id_sucursal = s.id
                WHERE o.id = $1
            `, [idOrden]);

            if (ordenResult.rows.length === 0) {
                throw new Error('Orden no encontrada');
            }

            const orden = ordenResult.rows[0];
            const pendiente = parseFloat(orden.total_neto) - parseFloat(orden.total_pagado);

            if (pendiente <= 0) {
                throw new Error('La orden no tiene saldo pendiente');
            }

            if (orden.en_cuenta_corriente) {
                throw new Error('Esta orden ya fue cargada a cuenta corriente');
            }

            // 2. Obtener o crear cuenta corriente del cliente
            let cuentaResult = await tx.query(`
                SELECT * FROM cuentacorriente 
                WHERE id_cliente = $1 AND id_tenant = $2
            `, [orden.id_cliente, orden.id_tenant]);

            let idCuenta;
            let saldoAnterior = 0;

            if (cuentaResult.rows.length === 0) {
                // Crear cuenta corriente
                const nuevaCuenta = await tx.query(`
                    INSERT INTO cuentacorriente (id_cliente, id_tenant, created_by)
                    VALUES ($1, $2, $3)
                    RETURNING id, saldo_actual
                `, [orden.id_cliente, orden.id_tenant, userId]);

                idCuenta = nuevaCuenta.rows[0].id;
                saldoAnterior = 0;
            } else {
                idCuenta = cuentaResult.rows[0].id;
                saldoAnterior = parseFloat(cuentaResult.rows[0].saldo_actual);
            }

            // 3. Crear movimiento de cargo
            const saldoPosterior = saldoAnterior + pendiente;

            await tx.query(`
                INSERT INTO movimientocuenta (
                    id_cuenta_corriente,
                    tipo_movimiento,
                    importe,
                    saldo_anterior,
                    saldo_posterior,
                    concepto,
                    id_orden,
                    created_by
                ) VALUES ($1, 'CARGO', $2, $3, $4, $5, $6, $7)
            `, [
                idCuenta,
                pendiente,
                saldoAnterior,
                saldoPosterior,
                `Orden #${orden.id} - Saldo pendiente`,
                idOrden,
                userId
            ]);

            // 4. Marcar orden como cargada a cuenta corriente
            // Solo actualizamos en_cuenta_corriente e id_cuenta_corriente
            // (la columna estado_pago no existe en la tabla)
            await tx.query(`
                UPDATE orden 
                SET en_cuenta_corriente = true, 
                    id_cuenta_corriente = $1
                WHERE id = $2
            `, [idCuenta, idOrden]);

            return { idCuenta, pendiente, saldoAnterior, saldoPosterior };
        });

        res.json({
            success: true,
            message: `Saldo de ${result.pendiente.toFixed(2)}€ cargado a cuenta corriente`,
            data: {
                idCuenta: result.idCuenta,
                importeCargado: result.pendiente,
                saldoAnterior: result.saldoAnterior,
                saldoPosterior: result.saldoPosterior
            }
        });

    } catch (error) {
        console.error('Error al cargar orden a cuenta corriente:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/cuentas-corrientes/pago
 * Registra un pago/abono a cuenta corriente
 */
router.post('/pago', verifyJWT, async (req, res) => {
    try {
        const {
            idCuentaCorriente,
            idCliente, // Alternativo: buscar por cliente
            importe,
            concepto = 'Pago a cuenta',
            idMedioPago,
            fecha,
            idSucursal // Opcional: sucursal donde se registra el pago
        } = req.body;

        const tenantId = req.user?.id_tenant;
        const userId = req.user?.id;
        // Usar la sucursal enviada, o la del usuario, o buscar una del tenant
        const sucursalDelUsuario = req.user?.id_sucursal;

        if (!importe || importe <= 0) {
            return res.status(400).json({ success: false, error: 'Importe inválido' });
        }

        const result = await req.db.txWithRLS(async (tx) => {
            // Determinar cuenta corriente
            let cuentaId = idCuentaCorriente;

            if (!cuentaId && idCliente) {
                const cuenta = await tx.query(`
                    SELECT id FROM cuentacorriente 
                    WHERE id_cliente = $1 AND id_tenant = $2
                `, [idCliente, tenantId]);

                if (cuenta.rows.length === 0) {
                    throw new Error('El cliente no tiene cuenta corriente');
                }
                cuentaId = cuenta.rows[0].id;
            }

            if (!cuentaId) {
                throw new Error('Cuenta corriente no especificada');
            }

            // Obtener saldo actual
            const cuentaResult = await tx.query(`
                SELECT saldo_actual FROM cuentacorriente WHERE id = $1
            `, [cuentaId]);

            if (cuentaResult.rows.length === 0) {
                throw new Error('Cuenta corriente no encontrada');
            }

            const saldoAnterior = parseFloat(cuentaResult.rows[0].saldo_actual);
            const saldoPosterior = saldoAnterior - parseFloat(importe);

            // Crear movimiento de abono
            await tx.query(`
                INSERT INTO movimientocuenta (
                    id_cuenta_corriente,
                    tipo_movimiento,
                    importe,
                    saldo_anterior,
                    saldo_posterior,
                    concepto,
                    fecha_movimiento,
                    created_by
                ) VALUES ($1, 'ABONO', $2, $3, $4, $5, $6, $7)
            `, [
                cuentaId,
                importe,
                saldoAnterior,
                saldoPosterior,
                concepto,
                fecha || new Date().toISOString().split('T')[0],
                userId
            ]);

            // Actualizar saldo de la cuenta corriente
            await tx.query(`
                UPDATE cuentacorriente SET saldo_actual = $1 WHERE id = $2
            `, [saldoPosterior, cuentaId]);

            // Si el medio de pago implica movimiento de caja, crearlo
            if (idMedioPago) {
                // Verificar si el medio de pago requiere movimiento de caja (EFECTIVO, TARJETA, etc.)
                const medioPagoResult = await tx.query(`
                    SELECT codigo, nombre FROM mediopago WHERE id = $1
                `, [idMedioPago]);

                if (medioPagoResult.rows.length > 0) {
                    const codigoMedio = (medioPagoResult.rows[0].codigo || '').toUpperCase();
                    console.log(`[CC Pago] Medio de pago ID ${idMedioPago}: código "${codigoMedio}"`);
                    // Cualquier pago real genera movimiento de caja (excepto CUENTA_CORRIENTE que es aplazamiento)
                    const mediosSinCaja = ['CUENTA_CORRIENTE'];
                    const generaCaja = !mediosSinCaja.includes(codigoMedio);

                    if (generaCaja) {
                        console.log(`[CC Pago] Medio ${codigoMedio} requiere movimiento de caja`);
                        // Obtener la sucursal del cliente desde la cuenta corriente
                        const cuentaInfo = await tx.query(`
                            SELECT cc.id_tenant, cf.id
                            FROM cuentacorriente cc
                            JOIN clientefinal cf ON cc.id_cliente = cf.id
                            WHERE cc.id = $1
                        `, [cuentaId]);

                        if (cuentaInfo.rows.length > 0) {
                            const tenantIdPago = cuentaInfo.rows[0].id_tenant;

                            // Determinar sucursal: usar la enviada, la del usuario, o buscar una del tenant
                            let sucursalParaCaja = idSucursal || sucursalDelUsuario;

                            if (!sucursalParaCaja) {
                                const sucursalResult = await tx.query(`
                                    SELECT id FROM sucursal WHERE id_tenant = $1 LIMIT 1
                                `, [tenantIdPago]);
                                sucursalParaCaja = sucursalResult.rows[0]?.id;
                            }

                            if (sucursalParaCaja) {
                                console.log(`[CC Pago] Buscando caja abierta en sucursal ${sucursalParaCaja}`);

                                // Buscar caja abierta
                                const cajaResult = await tx.query(`
                                    SELECT id FROM caja 
                                    WHERE id_sucursal = $1 AND estado = 'ABIERTA' 
                                    ORDER BY created_at DESC LIMIT 1
                                `, [sucursalParaCaja]);

                                if (cajaResult.rows.length > 0) {
                                    const idCaja = cajaResult.rows[0].id;

                                    // Crear movimiento de caja (INGRESO) con el medio de pago
                                    await tx.query(`
                                        INSERT INTO cajamovimiento 
                                        (id_caja, id_usuario, tipo, monto, concepto, origen_tipo, origen_id, id_medio_pago, fecha, created_at, created_by)
                                        VALUES ($1, $2, 'INGRESO', $3, $4, 'CUENTA_CORRIENTE', $5, $6, NOW(), NOW(), $2)
                                    `, [idCaja, userId, importe, `Pago cuenta corriente - ${concepto}`, cuentaId, idMedioPago]);

                                    console.log(`Movimiento de caja creado: ${importe}€ en caja ${idCaja}`);
                                } else {
                                    console.warn('No hay caja abierta para registrar el movimiento de efectivo');
                                }
                            }
                        }
                    }
                }
            }

            return { saldoAnterior, saldoPosterior };
        });

        res.json({
            success: true,
            message: `Pago de ${parseFloat(importe).toFixed(2)}€ registrado correctamente`,
            data: {
                saldoAnterior: result.saldoAnterior,
                saldoPosterior: result.saldoPosterior,
                importeAbonado: parseFloat(importe)
            }
        });

    } catch (error) {
        console.error('Error al registrar pago:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/cuentas-corrientes/:id
 * Obtiene detalle de una cuenta corriente
 */
router.get('/:id', verifyJWT, async (req, res) => {
    try {
        const idCuenta = parseInt(req.params.id);

        const cuenta = await req.db.query(`
            SELECT 
                cc.*,
                cf.nombre AS cliente_nombre,
                cf.telefono AS cliente_telefono,
                cf.documento AS cliente_nif,
                cf.direccion AS cliente_direccion,
                cf.email AS cliente_email
            FROM cuentacorriente cc
            JOIN clientefinal cf ON cc.id_cliente = cf.id
            WHERE cc.id = $1
        `, [idCuenta]);

        if (cuenta.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
        }

        // Obtener últimos movimientos
        const movimientos = await req.db.query(`
            SELECT * FROM movimientocuenta
            WHERE id_cuenta_corriente = $1
            ORDER BY fecha_movimiento DESC, created_at DESC
            LIMIT 20
        `, [idCuenta]);

        res.json({
            success: true,
            data: {
                cuenta: cuenta.rows[0],
                movimientos: movimientos.rows
            }
        });

    } catch (error) {
        console.error('Error al obtener cuenta corriente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/cuentas-corrientes/:id
 * Actualiza configuración de cuenta corriente
 */
router.put('/:id', verifyJWT, async (req, res) => {
    try {
        const idCuenta = parseInt(req.params.id);
        const { limite_credito, estado, notas } = req.body;

        const campos = [];
        const valores = [];
        let paramIndex = 1;

        if (limite_credito !== undefined) {
            campos.push(`limite_credito = $${paramIndex}`);
            valores.push(limite_credito);
            paramIndex++;
        }

        if (estado !== undefined) {
            campos.push(`estado = $${paramIndex}`);
            valores.push(estado);
            paramIndex++;
        }

        if (notas !== undefined) {
            campos.push(`notas = $${paramIndex}`);
            valores.push(notas);
            paramIndex++;
        }

        if (campos.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        }

        campos.push(`updated_at = NOW()`);
        valores.push(idCuenta);

        const query = `
            UPDATE cuentacorriente
            SET ${campos.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await req.db.query(query, valores);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Cuenta actualizada correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar cuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
