const pool = require('../db');
const ordenesRepository = require('../repositories/ordenesRepository');

class OrdenesService {
    async createOrden(data, userContext) {
        const { id_tenant, id_usuario } = userContext;
        const {
            idSucursal,
            idCliente,
            idVehiculo,
            idMecanico,
            // Flexible input for TipoOrden
            idTipoOrden,
            codigoTipoOrden,
            // Flexible input for EstadoOrden
            idEstadoOrden,
            codigoEstadoOrden,
            km,
            concepto,
            descripcion,
            comentarioInterno,
            lineas,
            pagos
        } = data;

        const kmNumber = km !== undefined && km !== null && km !== '' ? Number(km) : 0;
        if (Number.isNaN(kmNumber) || kmNumber < 0) {
            throw new Error('Kilometraje inválido');
        }

        // 1. Validaciones básicas de campos obligatorios
        if (!idSucursal || !idCliente || !idVehiculo || !idMecanico) {
            throw new Error('Faltan campos obligatorios (Sucursal, Cliente, Vehículo, Mecánico)');
        }
        if (!lineas || lineas.length === 0) {
            throw new Error('La orden debe tener al menos una línea');
        }

        // 2. Validaciones de Entidades (Existencia y Pertenencia)
        const sucursalValida = await ordenesRepository.checkSucursal(idSucursal, id_tenant);
        if (!sucursalValida) throw new Error('Sucursal no válida o no pertenece al tenant');

        const clienteValido = await ordenesRepository.checkCliente(idCliente, id_tenant);
        if (!clienteValido) throw new Error('Cliente no válido o no pertenece al tenant');

        const vehiculoValido = await ordenesRepository.checkVehiculo(idVehiculo, id_tenant);
        if (!vehiculoValido) throw new Error('Vehículo no válido o no pertenece al tenant');

        const mecanicoValido = await ordenesRepository.checkMecanico(idMecanico, id_tenant);
        if (!mecanicoValido) throw new Error('Mecánico no válido o no pertenece al tenant');

        // 3. Lookup TipoOrden - Try both codigo and id
        const tipoOrden = await ordenesRepository.getTipoOrdenByCodigoOrId({
            codigo: codigoTipoOrden,
            id: idTipoOrden
        });

        if (!tipoOrden) {
            throw new Error(`Tipo de orden no encontrado. Código: ${codigoTipoOrden}, ID: ${idTipoOrden}`);
        }

        // 4. Lookup EstadoOrden (Default to 'ABIERTA' if not provided)
        const estadoCodigo = codigoEstadoOrden || (idEstadoOrden ? null : 'ABIERTA');
        const estadoOrden = await ordenesRepository.getEstadoOrdenByCodigoOrId({
            codigo: estadoCodigo,
            id: idEstadoOrden
        });
        if (!estadoOrden) throw new Error('Estado de orden no encontrado');

        // 5. Validar Productos y Calcular Líneas PREVIO a la transacción (Fail fast)
        // También validamos Medios de Pago si existen
        const lineasProcesadas = [];
        console.log('Procesando líneas para orden:', JSON.stringify(lineas)); // DEBUG LOG
        const normalizarTipoItem = (tipo) => {
            const raw = (tipo || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
            if (raw === 'SERVICIO' || raw === 'MANO_OBRA') return 'SERVICIO';
            return 'PRODUCTO';
        };

        for (const linea of lineas) {
            // Validar producto SOLO si se proporcionó un ID
            let producto = null;
            if (linea.idProducto) {
                producto = await ordenesRepository.getProductoById(linea.idProducto, id_tenant);
                if (!producto) throw new Error(`Producto ID ${linea.idProducto} no encontrado o no pertenece al tenant`);
            }

            const tipoItemNormalizado = normalizarTipoItem(linea.tipoItem || linea.tipo_item);
            const esServicio = tipoItemNormalizado === 'SERVICIO';

            // Determinar Impuesto: Si viene en linea, usarlo. Si no, del producto (si existe).
            let impuestoId = linea.idImpuesto;
            let impuestoPorcentaje = 0;

            if (impuestoId) {
                const imp = await ordenesRepository.getImpuestoById(impuestoId);
                if (!imp) throw new Error(`Impuesto ID ${impuestoId} no encontrado`);
                impuestoPorcentaje = Number(imp.porcentaje);
            } else if (producto && producto.id_impuesto) {
                impuestoId = producto.id_impuesto;
                const imp = await ordenesRepository.getImpuestoById(impuestoId);
                if (imp) impuestoPorcentaje = Number(imp.porcentaje);
            } else {
                // Si el producto no tiene impuesto y no se envió, asumimos 0 o error?
                // Asumimos 0 si no hay info.
                // O podríamos usar el iva enviado manualmente en el frontend (linea.iva)
                if (linea.iva !== undefined) {
                    impuestoPorcentaje = Number(linea.iva);
                }
            }

            const cantidad = Number(linea.cantidad);
            const precio = Number(linea.precio);
            const descuento = Number(linea.descuento) || 0;

            const productoNombre = producto ? producto.nombre : 'Producto desconocido';
            if (cantidad <= 0) throw new Error(`Cantidad inválida en ${linea.descripcion || productoNombre}`);
            if (precio < 0) throw new Error(`Precio inválido en ${linea.descripcion || productoNombre}`);

            if (producto && !esServicio) {
                const stockDisponible = Number(producto.stock) || 0;
                if (stockDisponible < cantidad) {
                    throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${stockDisponible}, solicitado: ${cantidad}`);
                }
            }

            // Cálculos
            const subtotal = (cantidad * precio) - descuento;
            const montoIva = subtotal * (impuestoPorcentaje / 100);
            const totalLinea = subtotal + montoIva;

            lineasProcesadas.push({
                ...linea,
                idImpuesto: impuestoId,
                ivaPorcentaje: impuestoPorcentaje,
                tipoItem: tipoItemNormalizado,
                cantidad,
                precio,
                descuento,
                subtotal, // Base imponible
                montoIva,
                totalLinea,
                descripcion: linea.descripcion || (producto ? producto.nombre : 'Item sin descripción')
            });
        }

        const pagosProcesados = [];
        if (pagos && pagos.length > 0) {
            for (const pago of pagos) {
                const medio = await ordenesRepository.getMedioPagoByCodigoOrId({
                    codigo: pago.codigoMedioPago,
                    id: pago.idMedioPago
                });
                if (!medio) throw new Error(`Medio de pago ${pago.codigoMedioPago || pago.idMedioPago} no encontrado`);

                pagosProcesados.push({
                    ...pago,
                    idMedioPago: medio.id
                });
            }
        }

        // 6. Transacción
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 0. Resolver Almacén (Para movimientos de inventario)
            const idAlmacen = await ordenesRepository.ensureAlmacenPrincipal(idSucursal, client);

            // Crear Cabecera Orden
            const ordenData = {
                id_sucursal: idSucursal,
                id_cliente: idCliente,
                id_vehiculo: idVehiculo,
                id_usuario: id_usuario, // Usuario del contexto (quien hace la petición)
                id_mecanico: idMecanico, // Mecánico asignado
                id_tipo_orden: tipoOrden.id,
                id_estado_orden: estadoOrden.id,
                km: kmNumber,
                concepto,
                descripcion: descripcion || '',
                comentario_interno: comentarioInterno || '',
                created_by: id_usuario
            };

            const nuevaOrden = await ordenesRepository.createOrden(client, ordenData);
            const idOrden = nuevaOrden.id;

            // Insertar Líneas
            let totalBruto = 0;
            let totalIva = 0;

            for (const linea of lineasProcesadas) {
                await ordenesRepository.createOrdenLinea(client, {
                    id_orden: idOrden,
                    id_producto: linea.idProducto,
                    id_impuesto: linea.idImpuesto,
                    tipo_item: linea.tipoItem || 'PRODUCTO',
                    descripcion: linea.descripcion,
                    cantidad: linea.cantidad,
                    precio: linea.precio,
                    descuento: linea.descuento,
                    iva: linea.montoIva, // Guardamos el MONTO del IVA
                    subtotal: linea.subtotal // Base imponible
                });

                // Actualizar stock SOLO si es un producto y NO es un servicio
                const esServicio = normalizarTipoItem(linea.tipoItem) === 'SERVICIO';

                if (linea.idProducto && !esServicio) {
                    await ordenesRepository.decreaseProductoStock(client, linea.idProducto, linea.cantidad);

                    // Registrar Movimiento de Inventario (SALIDA por ORDEN)
                    await ordenesRepository.createMovimientoInventario(client, {
                        id_producto: linea.idProducto,
                        id_almacen: idAlmacen,
                        tipo: 'SALIDA',
                        cantidad: linea.cantidad,
                        origen_tipo: 'ORDEN',
                        origen_id: idOrden,
                        created_by: id_usuario
                    });
                }

                totalBruto += linea.subtotal;
                totalIva += linea.montoIva;
            }

            const totalNeto = totalBruto + totalIva;

            // Insertar Pagos y Movimientos de Caja
            for (const pago of pagosProcesados) {
                const pagoCreado = await ordenesRepository.createOrdenPago(client, {
                    id_orden: idOrden,
                    id_medio_pago: pago.idMedioPago,
                    importe: pago.importe,
                    referencia: pago.referencia,
                    id_caja: pago.idCaja,
                    created_by: id_usuario
                });

                // Crear movimiento de caja (INGRESO por pago de orden)
                if (pago.idCaja) {
                    await ordenesRepository.createCajaMovimiento(client, {
                        id_caja: pago.idCaja,
                        id_usuario: id_usuario,
                        tipo: 'INGRESO',
                        monto: pago.importe,
                        origen_tipo: 'ORDEN',
                        origen_id: idOrden,
                        created_by: id_usuario
                    });
                }
            }

            // Actualizar Totales en Orden
            await ordenesRepository.updateOrdenTotales(client, idOrden, {
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalNeto
            });

            await client.query('COMMIT');

            return {
                id: idOrden,
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalNeto,
                lineas: lineasProcesadas.length,
                pagos: pagosProcesados.length
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtiene lista de órdenes con estado de pago calculado
     */
    async getOrdenes(filtros, userContext) {
        const { id_tenant } = userContext;
        const { estado, estadoPago, busqueda, fechaDesde, fechaHasta, limit, offset } = filtros;

        // Query principal con estado de pago calculado
        let query = `
            SELECT 
                o.id,
                o.created_at as fecha_ingreso,
                o.km,
                o.descripcion,
                o.total_bruto,
                o.total_iva,
                o.total_neto,
                c.nombre as cliente_nombre,
                c.telefono as cliente_telefono,
                v.marca as vehiculo_marca,
                v.modelo as vehiculo_modelo,
                v.matricula as vehiculo_matricula,
                eo.codigo as estado_codigo,
                eo.nombre as estado_nombre,
                to_field.codigo as tipo_orden_codigo,
                to_field.nombre as tipo_orden_nombre,
                COALESCE(SUM(op.importe), 0) as total_pagado,
                CASE 
                    WHEN COALESCE(SUM(op.importe), 0) = 0 THEN 'PENDIENTE'
                    WHEN COALESCE(SUM(op.importe), 0) < o.total_neto THEN 'PARCIAL'
                    ELSE 'PAGADO'
                END as estado_pago,
                (SELECT mp.nombre FROM ordenpago op2 
                 JOIN mediopago mp ON op2.id_medio_pago = mp.id 
                 WHERE op2.id_orden = o.id 
                 ORDER BY op2.created_at DESC LIMIT 1) as ultimo_medio_pago
            FROM orden o
            JOIN clientefinal c ON o.id_cliente = c.id
            JOIN vehiculo v ON o.id_vehiculo = v.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            LEFT JOIN tipoorden to_field ON o.id_tipo_orden = to_field.id
            LEFT JOIN ordenpago op ON o.id = op.id_orden
            WHERE 1=1
        `;

        const values = [];
        let paramIndex = 1;

        // Filtro por estado de orden
        if (estado) {
            query += ` AND UPPER(eo.codigo) = UPPER($${paramIndex})`;
            values.push(estado);
            paramIndex++;
        }

        // Filtro por búsqueda (cliente, matrícula, id)
        if (busqueda) {
            query += ` AND (
                c.nombre ILIKE $${paramIndex} OR 
                v.matricula ILIKE $${paramIndex} OR 
                CAST(o.id AS TEXT) ILIKE $${paramIndex}
            )`;
            values.push(`%${busqueda}%`);
            paramIndex++;
        }

        // Filtro por fechas
        if (fechaDesde) {
            query += ` AND o.created_at >= $${paramIndex}`;
            values.push(fechaDesde);
            paramIndex++;
        }
        if (fechaHasta) {
            query += ` AND o.created_at <= $${paramIndex}`;
            values.push(fechaHasta);
            paramIndex++;
        }

        // Agrupar por orden
        query += ` GROUP BY o.id, c.nombre, c.telefono, v.marca, v.modelo, v.matricula, 
                   eo.codigo, eo.nombre, to_field.codigo, to_field.nombre`;

        // Filtro por estado de pago (después del GROUP BY, en HAVING)
        if (estadoPago) {
            query += ` HAVING CASE 
                WHEN COALESCE(SUM(op.importe), 0) = 0 THEN 'PENDIENTE'
                WHEN COALESCE(SUM(op.importe), 0) < o.total_neto THEN 'PARCIAL'
                ELSE 'PAGADO'
            END = UPPER($${paramIndex})`;
            values.push(estadoPago.toUpperCase());
            paramIndex++;
        }

        // Ordenar y paginar
        query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Obtener total para paginación (sin LIMIT)
        let countQuery = `
            SELECT COUNT(DISTINCT o.id) as total
            FROM orden o
            JOIN clientefinal c ON o.id_cliente = c.id
            JOIN vehiculo v ON o.id_vehiculo = v.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            WHERE 1=1
        `;
        const countValues = [];

        if (estado) {
            countQuery += ` AND UPPER(eo.codigo) = UPPER($${countValues.length + 1})`;
            countValues.push(estado);
        }
        if (busqueda) {
            countQuery += ` AND (c.nombre ILIKE $${countValues.length + 1} OR v.matricula ILIKE $${countValues.length + 1})`;
            countValues.push(`%${busqueda}%`);
        }

        const countResult = await pool.query(countQuery, countValues);

        return {
            ordenes: result.rows,
            total: parseInt(countResult.rows[0]?.total || 0),
            limit,
            offset
        };
    }
}

module.exports = new OrdenesService();
