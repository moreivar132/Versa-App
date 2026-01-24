/**
 * Tesorería Controller
 * Gestión de cuentas de tesorería y transacciones
 */

const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * Obtener empresa context desde header o query
 */
function getEmpresaId(req) {
    return req.headers['x-empresa-id'] || req.query.empresaId;
}

// ===================================================================
// CUENTAS DE TESORERÍA
// ===================================================================

/**
 * GET /api/contabilidad/tesoreria/cuentas
 * Lista cuentas de tesorería de una empresa
 */
async function listCuentas(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        if (!empresaId) {
            return res.status(400).json({ ok: false, error: 'Empresa no especificada (header x-empresa-id o query empresaId)' });
        }

        // Verificar acceso a la empresa
        const empresaCheck = await req.db.query(
            'SELECT id FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );

        if (empresaCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        const result = await req.db.query(`
            SELECT c.*,
                   (SELECT COALESCE(SUM(CASE WHEN tipo IN ('COBRO', 'INGRESO_EFECTIVO') THEN importe ELSE -importe END), 0)
                    FROM accounting_transaccion t WHERE t.id_cuenta = c.id) as saldo_calculado
            FROM accounting_cuenta_tesoreria c
            WHERE c.id_empresa = $1
            ORDER BY c.es_default DESC, c.tipo, c.nombre
        `, [empresaId]);

        res.json({
            ok: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error en listCuentas:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/tesoreria/cuentas
 * Crea una cuenta de tesorería
 */
async function createCuenta(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const userId = req.user?.id;

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        const { nombre, tipo = 'CAJA', entidad, numero_cuenta, saldo_inicial = 0 } = req.body;

        if (!nombre) {
            return res.status(400).json({ ok: false, error: 'nombre es obligatorio' });
        }

        const result = await req.db.query(`
            INSERT INTO accounting_cuenta_tesoreria 
                (id_empresa, nombre, tipo, entidad, numero_cuenta, saldo_actual, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [empresaId, nombre, tipo, entidad, numero_cuenta, saldo_inicial, userId]);

        res.status(201).json({
            ok: true,
            data: result.rows[0],
            message: 'Cuenta creada correctamente'
        });
    } catch (error) {
        console.error('Error en createCuenta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/contabilidad/tesoreria/cuentas/:id
 * Actualiza una cuenta
 */
async function updateCuenta(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const cuentaId = req.params.id;
        const empresaId = getEmpresaId(req);

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        const { nombre, tipo, entidad, numero_cuenta, activo } = req.body;

        const result = await req.db.query(`
            UPDATE accounting_cuenta_tesoreria 
            SET nombre = COALESCE($3, nombre),
                tipo = COALESCE($4, tipo),
                entidad = COALESCE($5, entidad),
                numero_cuenta = COALESCE($6, numero_cuenta),
                activo = COALESCE($7, activo)
            WHERE id = $1 AND id_empresa = $2
            RETURNING *
        `, [cuentaId, empresaId, nombre, tipo, entidad, numero_cuenta, activo]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });
        }

        res.json({
            ok: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error en updateCuenta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

// ===================================================================
// TRANSACCIONES (COBROS, PAGOS, INGRESOS EFECTIVO)
// ===================================================================

/**
 * GET /api/contabilidad/tesoreria/transacciones
 * Lista transacciones de tesorería
 */
async function listTransacciones(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        const {
            tipo,
            fechaDesde,
            fechaHasta,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT t.*,
                   c.nombre as cuenta_nombre,
                   co.nombre as contacto_nombre,
                   f.numero_factura
            FROM accounting_transaccion t
            LEFT JOIN accounting_cuenta_tesoreria c ON c.id = t.id_cuenta
            LEFT JOIN contabilidad_contacto co ON co.id = t.id_contacto
            LEFT JOIN contabilidad_factura f ON f.id = t.id_factura
            WHERE t.id_empresa = $1
        `;
        const params = [empresaId];
        let paramCount = 2;

        if (tipo) {
            query += ` AND t.tipo = $${paramCount}`;
            params.push(tipo);
            paramCount++;
        }

        if (fechaDesde) {
            query += ` AND t.fecha >= $${paramCount}`;
            params.push(fechaDesde);
            paramCount++;
        }

        if (fechaHasta) {
            query += ` AND t.fecha <= $${paramCount}`;
            params.push(fechaHasta);
            paramCount++;
        }

        query += ` ORDER BY t.fecha DESC, t.id DESC`;
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await req.db.query(query, params);

        // Contar total
        const countResult = await req.db.query(`
            SELECT COUNT(*) FROM accounting_transaccion WHERE id_empresa = $1
        `, [empresaId]);

        res.json({
            ok: true,
            data: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error en listTransacciones:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/tesoreria/transacciones
 * Registra una transacción (cobro, pago, ingreso efectivo)
 */
async function createTransaccion(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const userId = req.user?.id;

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        const {
            tipo, // COBRO, PAGO, INGRESO_EFECTIVO, AJUSTE
            id_cuenta,
            id_factura,
            id_contacto,
            fecha,
            importe,
            metodo,
            referencia,
            concepto,
            incluye_en_resultados = true,
            incluye_en_iva = true,
            notas
        } = req.body;

        if (!tipo || !fecha || !importe) {
            return res.status(400).json({ ok: false, error: 'tipo, fecha e importe son obligatorios' });
        }

        if (parseFloat(importe) === 0) {
            return res.status(400).json({ ok: false, error: 'importe no puede ser 0' });
        }

        await req.db.txWithRLS(async (tx) => {
            // Crear transacción
            const result = await tx.query(`
                INSERT INTO accounting_transaccion (
                    id_empresa, id_cuenta, id_factura, id_contacto,
                    tipo, fecha, importe, metodo, referencia, concepto,
                    incluye_en_resultados, incluye_en_iva, notas, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                empresaId, id_cuenta, id_factura, id_contacto,
                tipo, fecha, importe, metodo, referencia, concepto,
                incluye_en_resultados, incluye_en_iva, notas, userId
            ]);

            // Si está asociada a una factura, actualizar total_pagado
            if (id_factura && (tipo === 'COBRO' || tipo === 'PAGO')) {
                // El trigger en la BD debería manejar esto, pero lo hacemos explícito por seguridad
                const totalPagos = await tx.query(`
                    SELECT COALESCE(SUM(importe), 0) as total
                    FROM accounting_transaccion
                    WHERE id_factura = $1 AND tipo IN ('COBRO', 'PAGO')
                `, [id_factura]);

                const totalFactura = await tx.query(`
                    SELECT total FROM contabilidad_factura WHERE id = $1
                `, [id_factura]);

                const pagado = parseFloat(totalPagos.rows[0].total);
                const total = parseFloat(totalFactura.rows[0]?.total || 0);

                let nuevoEstado = 'PENDIENTE';
                if (pagado >= total) {
                    nuevoEstado = 'PAGADA';
                } else if (pagado > 0) {
                    nuevoEstado = 'PARCIAL';
                }

                await tx.query(`
                    UPDATE contabilidad_factura
                    SET total_pagado = $2, estado = $3, updated_at = now()
                    WHERE id = $1
                `, [id_factura, pagado, nuevoEstado]);
            }

            // Actualizar saldo de cuenta si se especificó
            if (id_cuenta) {
                const delta = (tipo === 'COBRO' || tipo === 'INGRESO_EFECTIVO') ? importe : -importe;
                await tx.query(`
                    UPDATE accounting_cuenta_tesoreria
                    SET saldo_actual = saldo_actual + $2
                    WHERE id = $1
                `, [id_cuenta, delta]);
            }

            // Transaction commits automatically if success
            res.status(201).json({
                ok: true,
                data: result.rows[0],
                message: 'Transacción registrada correctamente'
            });
        });

    } catch (error) {
        console.error('Error en createTransaccion:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/contabilidad/tesoreria/transacciones/:id
 * Elimina una transacción (solo admin)
 */
async function removeTransaccion(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const transaccionId = req.params.id;

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        await req.db.txWithRLS(async (tx) => {
            // Obtener transacción antes de eliminar
            const trans = await tx.query(`
                SELECT * FROM accounting_transaccion WHERE id = $1 AND id_empresa = $2
            `, [transaccionId, empresaId]);

            if (trans.rows.length === 0) {
                // Return explicitly to trigger error response outside if needed, or just throw
                // But since we are inside response handler, we can return response.
                // HOWEVER txWithRLS catches errors. We should throw and handle in catch?
                // Or just return JSON. Returning JSON here works if express handles it, but txWithRLS might commit.
                // We should throw an error to rollback, OR just return and allow commit if we didn't change anything.
                // But we want to return 404.
                // Best practice: throw to rollback (even if read-only so far) or just response.
                // We can't return response from inside tx callback easily if we want to stop execution.
                // We'll throw special error or just return.
                // If we return, we must ensure we don't try to query more.
                // Actually returning res.json(...) works fine, but we should ensure we don't execute proceeding code.
                return res.status(404).json({ ok: false, error: 'Transacción no encontrada' });
            }

            const t = trans.rows[0];

            // Eliminar transacción
            await tx.query('DELETE FROM accounting_transaccion WHERE id = $1', [transaccionId]);

            // Revertir saldo de cuenta
            if (t.id_cuenta) {
                const delta = (t.tipo === 'COBRO' || t.tipo === 'INGRESO_EFECTIVO') ? -t.importe : t.importe;
                await tx.query(`
                    UPDATE accounting_cuenta_tesoreria SET saldo_actual = saldo_actual + $2 WHERE id = $1
                `, [t.id_cuenta, delta]);
            }

            // Recalcular estado de factura
            if (t.id_factura) {
                const totalPagos = await tx.query(`
                    SELECT COALESCE(SUM(importe), 0) as total
                    FROM accounting_transaccion WHERE id_factura = $1 AND tipo IN ('COBRO', 'PAGO')
                `, [t.id_factura]);

                const totalFactura = await tx.query(`
                    SELECT total FROM contabilidad_factura WHERE id = $1
                `, [t.id_factura]);

                const pagado = parseFloat(totalPagos.rows[0].total);
                const total = parseFloat(totalFactura.rows[0]?.total || 0);

                let nuevoEstado = 'PENDIENTE';
                if (pagado >= total) nuevoEstado = 'PAGADA';
                else if (pagado > 0) nuevoEstado = 'PARCIAL';

                await tx.query(`
                    UPDATE contabilidad_factura SET total_pagado = $2, estado = $3 WHERE id = $1
                `, [t.id_factura, pagado, nuevoEstado]);
            }

            res.json({ ok: true, message: 'Transacción eliminada' });
        });

    } catch (error) {
        console.error('Error en removeTransaccion:', error);
        // If headers already sent (because of 404 inside), don't send again.
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: error.message });
        }
    }
}

// ===================================================================
// CASHFLOW
// ===================================================================

/**
 * GET /api/contabilidad/tesoreria/cashflow
 * Obtiene resumen de cashflow
 */
async function getCashflow(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa son obligatorios' });
        }

        const { fechaDesde, fechaHasta } = req.query;

        const now = new Date();
        const desde = fechaDesde || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const hasta = fechaHasta || now.toISOString().split('T')[0];

        // Resumen por tipo
        const resumen = await req.db.query(`
            SELECT 
                tipo,
                COUNT(*) as num_transacciones,
                SUM(importe) as total
            FROM accounting_transaccion
            WHERE id_empresa = $1 AND fecha BETWEEN $2 AND $3
            GROUP BY tipo
        `, [empresaId, desde, hasta]);

        // Calcular entradas y salidas
        let entradas = 0;
        let salidas = 0;

        resumen.rows.forEach(row => {
            if (row.tipo === 'COBRO' || row.tipo === 'INGRESO_EFECTIVO') {
                entradas += parseFloat(row.total || 0);
            } else if (row.tipo === 'PAGO' || row.tipo === 'RETIRO_EFECTIVO') {
                salidas += parseFloat(row.total || 0);
            }
        });

        // Saldos por cuenta
        const saldos = await req.db.query(`
            SELECT id, nombre, tipo, saldo_actual
            FROM accounting_cuenta_tesoreria
            WHERE id_empresa = $1 AND activo = true
        `, [empresaId]);

        const saldoTotal = saldos.rows.reduce((acc, c) => acc + parseFloat(c.saldo_actual || 0), 0);

        res.json({
            ok: true,
            data: {
                periodo: { desde, hasta },
                entradas,
                salidas,
                neto: entradas - salidas,
                saldo_total: saldoTotal,
                cuentas: saldos.rows,
                detalle_por_tipo: resumen.rows
            }
        });
    } catch (error) {
        console.error('Error en getCashflow:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    // Cuentas
    listCuentas,
    createCuenta,
    updateCuenta,
    // Transacciones
    listTransacciones,
    createTransaccion,
    removeTransaccion,
    // Cashflow
    getCashflow
};
