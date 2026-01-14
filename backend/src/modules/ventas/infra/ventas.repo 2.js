/**
 * Ventas Repository
 * Capa de persistencia para el módulo de ventas.
 * TODA query SQL vive aquí. NO hay SQL en routes ni services.
 * 
 * @see docs/TENANT_DB.md para uso del wrapper TenantSafe
 */

const { getTenantDb } = require('../../../core/db/tenant-db');

/**
 * @typedef {Object} VentaContext
 * @property {number} tenantId
 * @property {number} userId
 * @property {string} [requestId]
 */

/**
 * Repositorio de Ventas
 */
class VentasRepo {
    /**
     * Listar ventas con filtros
     * @param {Object} filtros
     * @param {VentaContext} ctx
     */
    async findAll(filtros, ctx) {
        const db = getTenantDb(ctx);
        const { idSucursal, idCliente, fechaDesde, fechaHasta, estado, busqueda, limit = 50, offset = 0 } = filtros;

        let query = `
            SELECT 
                v.id,
                v.fecha,
                v.total_bruto,
                v.total_iva,
                v.total_neto,
                v.estado,
                v.observaciones,
                c.nombre as cliente_nombre,
                c.telefono as cliente_telefono,
                s.nombre as sucursal_nombre,
                COALESCE(SUM(vp.importe), 0) as total_pagado
            FROM venta v
            JOIN clientefinal c ON v.id_cliente = c.id
            JOIN sucursal s ON v.id_sucursal = s.id
            LEFT JOIN ventapago vp ON v.id = vp.id_venta
            WHERE v.id_tenant = $1
        `;

        const values = [ctx.tenantId];
        let paramIndex = 2;

        if (idSucursal) {
            query += ` AND v.id_sucursal = $${paramIndex++}`;
            values.push(idSucursal);
        }
        if (idCliente) {
            query += ` AND v.id_cliente = $${paramIndex++}`;
            values.push(idCliente);
        }
        if (fechaDesde) {
            query += ` AND v.fecha >= $${paramIndex++}`;
            values.push(fechaDesde);
        }
        if (fechaHasta) {
            query += ` AND v.fecha <= $${paramIndex++}`;
            values.push(fechaHasta);
        }
        if (estado) {
            query += ` AND v.estado = $${paramIndex++}`;
            values.push(estado);
        }
        if (busqueda) {
            query += ` AND (c.nombre ILIKE $${paramIndex} OR CAST(v.id AS TEXT) ILIKE $${paramIndex})`;
            values.push(`%${busqueda}%`);
            paramIndex++;
        }

        query += ` GROUP BY v.id, c.nombre, c.telefono, s.nombre`;
        query += ` ORDER BY v.fecha DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        values.push(limit, offset);

        const result = await db.query(query, values);
        return result.rows;
    }

    /**
     * Contar total de ventas para paginación
     * @param {VentaContext} ctx
     */
    async countAll(ctx) {
        const db = getTenantDb(ctx);
        const result = await db.query(
            'SELECT COUNT(*) as total FROM venta WHERE id_tenant = $1',
            [ctx.tenantId]
        );
        return parseInt(result.rows[0]?.total || 0);
    }

    /**
     * Obtener venta por ID con datos relacionados
     * @param {number} id
     * @param {VentaContext} ctx
     */
    async findById(id, ctx) {
        const db = getTenantDb(ctx);

        const ventaQuery = `
            SELECT 
                v.*,
                c.nombre as cliente_nombre,
                c.documento as cliente_documento,
                c.telefono as cliente_telefono,
                s.nombre as sucursal_nombre
            FROM venta v
            JOIN clientefinal c ON v.id_cliente = c.id
            JOIN sucursal s ON v.id_sucursal = s.id
            WHERE v.id = $1 AND v.id_tenant = $2
        `;
        const result = await db.query(ventaQuery, [id, ctx.tenantId]);
        return result.rows[0] || null;
    }

    /**
     * Obtener líneas de una venta
     * @param {number} idVenta
     * @param {VentaContext} ctx
     */
    async findLineas(idVenta, ctx) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT vl.*, p.nombre as producto_nombre, p.codigo_barras
            FROM ventalinea vl
            LEFT JOIN producto p ON vl.id_producto = p.id
            WHERE vl.id_venta = $1
        `, [idVenta]);
        return result.rows;
    }

    /**
     * Obtener pagos de una venta
     * @param {number} idVenta
     * @param {VentaContext} ctx
     */
    async findPagos(idVenta, ctx) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT vp.*, mp.nombre as medio_pago_nombre, mp.codigo as medio_pago_codigo
            FROM ventapago vp
            JOIN mediopago mp ON vp.id_medio_pago = mp.id
            WHERE vp.id_venta = $1
        `, [idVenta]);
        return result.rows;
    }

    /**
     * Crear venta con transacción
     * @param {Object} data - Datos de la venta
     * @param {Array} lineas - Líneas procesadas
     * @param {VentaContext} ctx
     */
    async create(data, lineas, ctx) {
        const db = getTenantDb(ctx);

        return db.tx(async (trxDb) => {
            // Insertar cabecera
            const ventaResult = await trxDb.query(`
                INSERT INTO venta (
                    id_tenant, id_sucursal, id_cliente, id_caja,
                    total_bruto, total_descuento, total_iva, total_neto,
                    observaciones, created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
                RETURNING id
            `, [
                ctx.tenantId, data.idSucursal, data.idCliente, data.idCaja || null,
                data.totalBruto, data.totalDescuento, data.totalIva, data.totalNeto,
                data.observaciones || '', ctx.userId
            ]);

            const idVenta = ventaResult.rows[0].id;

            // Insertar líneas
            for (const linea of lineas) {
                await trxDb.query(`
                    INSERT INTO ventalinea (
                        id_venta, id_producto, descripcion, cantidad,
                        precio, descuento, iva_porcentaje, iva_monto, subtotal
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    idVenta, linea.idProducto, linea.descripcion, linea.cantidad,
                    linea.precio, linea.descuento, linea.ivaPorcentaje, linea.ivaMonto, linea.subtotal
                ]);

                // Descontar stock
                if (linea.idProducto) {
                    await trxDb.query(`
                        UPDATE producto 
                        SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
                        WHERE id = $2
                    `, [linea.cantidad, linea.idProducto]);

                    // Movimiento de inventario
                    const almacenResult = await trxDb.query(
                        'SELECT id FROM almacen WHERE id_sucursal = $1 LIMIT 1',
                        [data.idSucursal]
                    );
                    const idAlmacen = almacenResult.rows[0]?.id;

                    if (idAlmacen) {
                        await trxDb.query(`
                            INSERT INTO movimientoinventario 
                            (id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_at, created_by)
                            VALUES ($1, $2, 'SALIDA', $3, 'VENTA', $4, NOW(), $5)
                        `, [linea.idProducto, idAlmacen, linea.cantidad, idVenta, ctx.userId]);
                    }
                }
            }

            return idVenta;
        });
    }

    /**
     * Insertar un pago para una venta
     * @param {number} idVenta
     * @param {Object} pago
     * @param {VentaContext} ctx
     * @param {Object} [trxDb] - DB en transacción (opcional)
     */
    async insertPago(idVenta, pago, ctx, trxDb = null) {
        const db = trxDb || getTenantDb(ctx);

        // Buscar medio de pago
        let medioPagoId = pago.idMedioPago;
        if (!medioPagoId && pago.codigoMedioPago) {
            const mpResult = await db.query(
                'SELECT id FROM mediopago WHERE UPPER(codigo) = UPPER($1)',
                [pago.codigoMedioPago]
            );
            medioPagoId = mpResult.rows[0]?.id;

            // Auto-seed si no existe
            if (!medioPagoId) {
                const nombreMap = {
                    'EFECTIVO': 'Efectivo',
                    'TARJETA': 'Tarjeta',
                    'TRANSFERENCIA': 'Transferencia'
                };
                const nombre = nombreMap[pago.codigoMedioPago.toUpperCase()] || pago.codigoMedioPago;
                const insertResult = await db.query(
                    'INSERT INTO mediopago (nombre, codigo) VALUES ($1, $2) RETURNING id',
                    [nombre, pago.codigoMedioPago.toUpperCase()]
                );
                medioPagoId = insertResult.rows[0].id;
            }
        }

        if (!medioPagoId) {
            throw new Error(`Medio de pago ${pago.codigoMedioPago || pago.idMedioPago} no encontrado`);
        }

        await db.query(`
            INSERT INTO ventapago (
                id_venta, id_medio_pago, id_caja, importe, referencia, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [idVenta, medioPagoId, pago.idCaja || null, pago.importe, pago.referencia || '', ctx.userId]);

        return medioPagoId;
    }

    /**
     * Registrar movimiento de caja
     * @param {number} idCaja
     * @param {number} monto
     * @param {number} idVenta
     * @param {VentaContext} ctx
     * @param {Object} [trxDb]
     */
    async insertMovimientoCaja(idCaja, monto, idVenta, ctx, trxDb = null) {
        const db = trxDb || getTenantDb(ctx);
        await db.query(`
            INSERT INTO cajamovimiento 
            (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, origen_id, created_at, created_by)
            VALUES ($1, $2, 'INGRESO', $3, NOW(), 'VENTA', $4, NOW(), $5)
        `, [idCaja, ctx.userId, monto, idVenta, ctx.userId]);
    }

    /**
     * Actualizar estado de venta
     * @param {number} id
     * @param {string} estado
     * @param {VentaContext} ctx
     */
    async updateEstado(id, estado, ctx) {
        const db = getTenantDb(ctx);
        await db.query(`
            UPDATE venta 
            SET estado = $1, updated_at = NOW(), updated_by = $2
            WHERE id = $3 AND id_tenant = $4
        `, [estado, ctx.userId, id, ctx.tenantId]);
    }

    /**
     * Revertir stock de líneas de una venta
     * @param {number} idVenta
     * @param {VentaContext} ctx
     * @param {Object} [trxDb]
     */
    async revertirStock(idVenta, ctx, trxDb = null) {
        const db = trxDb || getTenantDb(ctx);
        const lineas = await db.query(
            'SELECT id_producto, cantidad FROM ventalinea WHERE id_venta = $1',
            [idVenta]
        );

        for (const linea of lineas.rows) {
            if (linea.id_producto) {
                await db.query(`
                    UPDATE producto 
                    SET stock = COALESCE(stock, 0) + $1, updated_at = NOW()
                    WHERE id = $2
                `, [linea.cantidad, linea.id_producto]);
            }
        }
    }

    /**
     * Eliminar líneas de una venta
     */
    async deleteLineas(idVenta, trxDb) {
        await trxDb.query('DELETE FROM ventalinea WHERE id_venta = $1', [idVenta]);
    }

    /**
     * Eliminar pagos de una venta
     */
    async deletePagos(idVenta, trxDb) {
        await trxDb.query('DELETE FROM ventapago WHERE id_venta = $1', [idVenta]);
    }

    /**
     * Eliminar venta (cabecera)
     */
    async delete(idVenta, trxDb) {
        await trxDb.query('DELETE FROM venta WHERE id = $1', [idVenta]);
    }
}

module.exports = new VentasRepo();
