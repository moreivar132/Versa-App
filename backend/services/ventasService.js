const pool = require('../db');

class VentasService {
    /**
     * Crea una nueva venta
     */
    async createVenta(data, userContext) {
        const { id_tenant, id_usuario } = userContext;
        const {
            idSucursal,
            idCliente,
            idCaja,
            observaciones,
            lineas,
            pagos
        } = data;

        // Validaciones básicas
        if (!idSucursal || !idCliente) {
            throw new Error('Faltan campos obligatorios (Sucursal, Cliente)');
        }
        if (!lineas || lineas.length === 0) {
            throw new Error('La venta debe tener al menos un producto');
        }

        // Procesar líneas y calcular totales
        const lineasProcesadas = [];
        let totalBruto = 0;
        let totalDescuento = 0;
        let totalIva = 0;

        for (const linea of lineas) {
            const cantidad = Number(linea.cantidad) || 0;
            const precio = Number(linea.precio) || 0;
            const descuentoPorcentaje = Number(linea.descuento) || 0;
            const ivaPorcentaje = Number(linea.iva) || 0;

            if (cantidad <= 0) throw new Error(`Cantidad inválida en ${linea.descripcion}`);
            if (precio < 0) throw new Error(`Precio inválido en ${linea.descripcion}`);

            const subtotalSinDescuento = cantidad * precio;
            const montoDescuento = subtotalSinDescuento * (descuentoPorcentaje / 100);
            const subtotal = subtotalSinDescuento - montoDescuento;
            const montoIva = subtotal * (ivaPorcentaje / 100);

            lineasProcesadas.push({
                idProducto: linea.idProducto || null,
                descripcion: linea.descripcion || linea.nombre || 'Producto',
                cantidad,
                precio,
                descuento: descuentoPorcentaje,
                ivaPorcentaje,
                ivaMonto: montoIva,
                subtotal
            });

            totalBruto += subtotal;
            totalDescuento += montoDescuento;
            totalIva += montoIva;
        }

        const totalNeto = totalBruto + totalIva;

        // Transacción
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Crear cabecera de venta
            const ventaResult = await client.query(`
                INSERT INTO venta (
                    id_tenant, id_sucursal, id_cliente, id_caja,
                    total_bruto, total_descuento, total_iva, total_neto,
                    observaciones, created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
                RETURNING id
            `, [
                id_tenant, idSucursal, idCliente, idCaja || null,
                totalBruto, totalDescuento, totalIva, totalNeto,
                observaciones || '', id_usuario
            ]);

            const idVenta = ventaResult.rows[0].id;

            // Insertar líneas
            for (const linea of lineasProcesadas) {
                await client.query(`
                    INSERT INTO ventalinea (
                        id_venta, id_producto, descripcion, cantidad,
                        precio, descuento, iva_porcentaje, iva_monto, subtotal
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    idVenta, linea.idProducto, linea.descripcion, linea.cantidad,
                    linea.precio, linea.descuento, linea.ivaPorcentaje, linea.ivaMonto, linea.subtotal
                ]);

                // Descontar stock si es un producto real
                if (linea.idProducto) {
                    await client.query(`
                        UPDATE producto 
                        SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
                        WHERE id = $2
                    `, [linea.cantidad, linea.idProducto]);

                    // Registrar movimiento de inventario
                    const almacenResult = await client.query(
                        'SELECT id FROM almacen WHERE id_sucursal = $1 LIMIT 1',
                        [idSucursal]
                    );
                    const idAlmacen = almacenResult.rows[0]?.id;

                    if (idAlmacen) {
                        await client.query(`
                            INSERT INTO movimientoinventario 
                            (id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_at, created_by)
                            VALUES ($1, $2, 'SALIDA', $3, 'VENTA', $4, NOW(), $5)
                        `, [linea.idProducto, idAlmacen, linea.cantidad, idVenta, id_usuario]);
                    }
                }
            }

            // Insertar pagos
            if (pagos && pagos.length > 0) {
                for (const pago of pagos) {
                    // Buscar medio de pago por código o ID
                    let medioPagoId = pago.idMedioPago;
                    if (!medioPagoId && pago.codigoMedioPago) {
                        const mpResult = await client.query(
                            'SELECT id FROM mediopago WHERE codigo = $1',
                            [pago.codigoMedioPago]
                        );
                        medioPagoId = mpResult.rows[0]?.id;
                    }

                    if (!medioPagoId) {
                        throw new Error(`Medio de pago ${pago.codigoMedioPago || pago.idMedioPago} no encontrado`);
                    }

                    await client.query(`
                        INSERT INTO ventapago (
                            id_venta, id_medio_pago, id_caja, importe, referencia, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        idVenta, medioPagoId, pago.idCaja || idCaja || null,
                        pago.importe, pago.referencia || '', id_usuario
                    ]);

                    // Registrar movimiento de caja si hay caja asociada
                    const cajaId = pago.idCaja || idCaja;
                    if (cajaId) {
                        await client.query(`
                            INSERT INTO cajamovimiento 
                            (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, origen_id, created_at, created_by)
                            VALUES ($1, $2, 'INGRESO', $3, NOW(), 'VENTA', $4, NOW(), $5)
                        `, [cajaId, id_usuario, pago.importe, idVenta, id_usuario]);
                    }
                }
            }

            await client.query('COMMIT');

            return {
                ok: true,
                id: idVenta,
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalNeto,
                lineas: lineasProcesadas.length,
                pagos: pagos?.length || 0
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtiene lista de ventas con filtros
     */
    async getVentas(filtros, userContext) {
        const { id_tenant } = userContext;
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

        const values = [id_tenant];
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

        const result = await pool.query(query, values);

        // Contar total
        const countQuery = `
            SELECT COUNT(*) as total FROM venta v WHERE v.id_tenant = $1
        `;
        const countResult = await pool.query(countQuery, [id_tenant]);

        return {
            ventas: result.rows,
            total: parseInt(countResult.rows[0]?.total || 0),
            limit,
            offset
        };
    }

    /**
     * Obtiene una venta por ID con sus líneas y pagos
     */
    async getVentaById(idVenta, userContext) {
        const { id_tenant } = userContext;

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
        const ventaResult = await pool.query(ventaQuery, [idVenta, id_tenant]);

        if (ventaResult.rows.length === 0) {
            throw new Error('Venta no encontrada');
        }

        const lineasQuery = `
            SELECT vl.*, p.nombre as producto_nombre, p.codigo_barras
            FROM ventalinea vl
            LEFT JOIN producto p ON vl.id_producto = p.id
            WHERE vl.id_venta = $1
        `;
        const lineasResult = await pool.query(lineasQuery, [idVenta]);

        const pagosQuery = `
            SELECT vp.*, mp.nombre as medio_pago_nombre, mp.codigo as medio_pago_codigo
            FROM ventapago vp
            JOIN mediopago mp ON vp.id_medio_pago = mp.id
            WHERE vp.id_venta = $1
        `;
        const pagosResult = await pool.query(pagosQuery, [idVenta]);

        return {
            venta: ventaResult.rows[0],
            lineas: lineasResult.rows,
            pagos: pagosResult.rows
        };
    }

    /**
     * Anula una venta (devuelve stock)
     */
    async anularVenta(idVenta, userContext) {
        const { id_tenant, id_usuario } = userContext;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar que existe y pertenece al tenant
            const ventaResult = await client.query(
                'SELECT * FROM venta WHERE id = $1 AND id_tenant = $2',
                [idVenta, id_tenant]
            );

            if (ventaResult.rows.length === 0) {
                throw new Error('Venta no encontrada');
            }

            if (ventaResult.rows[0].estado === 'ANULADA') {
                throw new Error('La venta ya está anulada');
            }

            // Devolver stock
            const lineasResult = await client.query(
                'SELECT * FROM ventalinea WHERE id_venta = $1',
                [idVenta]
            );

            for (const linea of lineasResult.rows) {
                if (linea.id_producto) {
                    await client.query(`
                        UPDATE producto 
                        SET stock = COALESCE(stock, 0) + $1, updated_at = NOW()
                        WHERE id = $2
                    `, [linea.cantidad, linea.id_producto]);
                }
            }

            // Marcar como anulada
            await client.query(`
                UPDATE venta 
                SET estado = 'ANULADA', updated_at = NOW(), updated_by = $1
                WHERE id = $2
            `, [id_usuario, idVenta]);

            await client.query('COMMIT');

            return { ok: true, message: 'Venta anulada correctamente' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new VentasService();
