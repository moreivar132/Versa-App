const pool = require('../db');
const { getTenantDb } = require('../src/core/db/tenant-db');
const ordenesRepository = require('../repositories/ordenesRepository');

// Helper to build tenant context from userContext
function buildCtx(userContext) {
    return {
        tenantId: userContext.id_tenant,
        userId: userContext.id_usuario || userContext.id,
        requestId: userContext.requestId
    };
}

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
        // 1. Validaciones básicas de campos obligatorios
        const esVentaProducto = codigoTipoOrden === 'VENTA_PRODUCTO';

        if (!idSucursal || !idCliente) {
            throw new Error('Faltan campos obligatorios (Sucursal, Cliente)');
        }

        if (!esVentaProducto && (!idVehiculo || !idMecanico)) {
            throw new Error('Faltan campos obligatorios (Vehículo, Mecánico) para órdenes de servicio');
        }
        if (!lineas || lineas.length === 0) {
            throw new Error('La orden debe tener al menos una línea');
        }

        // 2. Validaciones de Entidades (Existencia y Pertenencia)
        // Super admins pueden saltarse las validaciones de tenant
        const { is_super_admin } = userContext;
        console.log('Validando entidades - id_tenant:', id_tenant, 'idSucursal:', idSucursal, 'idCliente:', idCliente, 'is_super_admin:', is_super_admin);

        if (is_super_admin) {
            // Para super admins, solo validamos existencia, no pertenencia a tenant
            console.log('Super Admin detectado - saltando validaciones de tenant');

            // Verificar solo existencia de sucursal
            const sucursalExiste = await ordenesRepository.checkSucursalExists(idSucursal);
            if (!sucursalExiste) throw new Error('Sucursal no existe');

            // Verificar solo existencia de cliente
            console.log('Verificando existencia de cliente - idCliente:', idCliente);
            const clienteExiste = await ordenesRepository.checkClienteExists(idCliente);
            console.log('Resultado checkClienteExists:', clienteExiste);
            if (!clienteExiste) throw new Error(`Cliente no existe (idCliente: ${idCliente})`);

            // Verificar solo existencia de vehículo y mecánico
            if (!esVentaProducto) {
                const vehiculoExiste = await ordenesRepository.checkVehiculoExists(idVehiculo);
                if (!vehiculoExiste) throw new Error('Vehículo no existe');

                const mecanicoExiste = await ordenesRepository.checkMecanicoExists(idMecanico);
                if (!mecanicoExiste) throw new Error('Mecánico no existe');
            }
        } else {
            // Para usuarios normales, validamos existencia Y pertenencia al tenant
            const sucursalValida = await ordenesRepository.checkSucursal(idSucursal, id_tenant);
            if (!sucursalValida) throw new Error('Sucursal no válida o no pertenece al tenant');

            console.log('Verificando cliente - idCliente:', idCliente, 'id_tenant:', id_tenant);
            const clienteValido = await ordenesRepository.checkCliente(idCliente, id_tenant);
            console.log('Resultado checkCliente:', clienteValido);
            if (!clienteValido) throw new Error(`Cliente no válido o no pertenece al tenant (idCliente: ${idCliente}, id_tenant: ${id_tenant})`);

            const vehiculoValido = esVentaProducto ? true : await ordenesRepository.checkVehiculo(idVehiculo, id_tenant);
            if (!esVentaProducto && !vehiculoValido) throw new Error('Vehículo no válido o no pertenece al tenant');

            const mecanicoValido = esVentaProducto ? true : await ordenesRepository.checkMecanico(idMecanico, id_tenant);
            if (!esVentaProducto && !mecanicoValido) throw new Error('Mecánico no válido o no pertenece al tenant');
        }

        // 3. Lookup TipoOrden - Try both codigo and id
        let tipoOrden = await ordenesRepository.getTipoOrdenByCodigoOrId({
            codigo: codigoTipoOrden,
            id: idTipoOrden
        });

        if (!tipoOrden && esVentaProducto) {
            tipoOrden = await ordenesRepository.createTipoOrden('VENTA_PRODUCTO', 'Venta de Producto');
        }

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
                    idMedioPago: medio.id,
                    codigoMedioPago: medio.codigo // Guardar código para verificar si es efectivo
                });
            }
        }

        // 6. Transacción
        const db = getTenantDb(buildCtx(userContext));
        return await db.txWithRLS(async (tx) => {
            // 0. Resolver Almacén (Para movimientos de inventario)
            const idAlmacen = await ordenesRepository.ensureAlmacenPrincipal(idSucursal, tx);

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

            const nuevaOrden = await ordenesRepository.createOrden(tx, ordenData);
            const idOrden = nuevaOrden.id;

            // Insertar Líneas
            let totalBruto = 0;
            let totalIva = 0;

            for (const linea of lineasProcesadas) {
                await ordenesRepository.createOrdenLinea(tx, {
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
                    await ordenesRepository.decreaseProductoStock(tx, linea.idProducto, linea.cantidad);

                    // Registrar Movimiento de Inventario (SALIDA por ORDEN)
                    await ordenesRepository.createMovimientoInventario(tx, {
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
            let idCajaActual = null;
            if (pagosProcesados.length > 0) {
                const cajaAbierta = await ordenesRepository.getOpenCaja(tx, idSucursal);
                if (cajaAbierta) {
                    idCajaActual = cajaAbierta.id;
                } else {
                    const nuevaCaja = await ordenesRepository.createOpenCaja(tx, idSucursal, id_usuario);
                    idCajaActual = nuevaCaja.id;
                }
            }

            for (const pago of pagosProcesados) {
                // SIEMPRE usar la caja de la sucursal de la orden (ignorar idCaja del frontend)
                const idCajaFinal = idCajaActual;

                const pagoCreado = await ordenesRepository.createOrdenPago(tx, {
                    id_orden: idOrden,
                    id_medio_pago: pago.idMedioPago,
                    importe: pago.importe,
                    referencia: pago.referencia,
                    id_caja: idCajaFinal,
                    created_by: id_usuario
                });

                // Registrar movimiento de caja para pagos reales (excepto cuenta corriente)
                const codigoMedio = (pago.codigoMedioPago || '').toUpperCase();
                const mediosSinCaja = ['CUENTA_CORRIENTE'];
                console.log(`[createOrden] Pago ${pago.importe}€ - Medio: ${codigoMedio} - Caja: ${idCajaFinal}`);

                if (!mediosSinCaja.includes(codigoMedio) && idCajaFinal) {
                    await ordenesRepository.createCajaMovimiento(tx, {
                        id_caja: idCajaFinal,
                        id_usuario: id_usuario,
                        tipo: 'INGRESO',
                        monto: pago.importe,
                        origen_tipo: 'ORDEN_PAGO',
                        origen_id: idOrden,
                        created_by: id_usuario
                    });
                    console.log(`[createOrden] Movimiento de caja creado: ${pago.importe}€ en caja ${idCajaFinal}`);
                }
            }

            // Actualizar Totales en Orden
            await ordenesRepository.updateOrdenTotales(tx, idOrden, {
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalNeto
            });

            return {
                id: idOrden,
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalNeto,
                lineas: lineasProcesadas.length,
                pagos: pagosProcesados.length
            };
        });
    }

    /**
     * Obtiene lista de órdenes con estado de pago calculado
     */
    async getOrdenes(filtros, userContext) {
        const { id_tenant } = userContext;
        const { estado, estadoPago, busqueda, fechaDesde, fechaHasta, idMecanico, idSucursal, idCliente, idVehiculo, limit, offset } = filtros;

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
                COALESCE((SELECT SUM(ol_s.subtotal) FROM ordenlinea ol_s WHERE ol_s.id_orden = o.id AND ol_s.tipo_item = 'SERVICIO'), 0) as total_servicios_bruto,
                COALESCE((SELECT SUM(ol_s.subtotal * (1 + COALESCE(ol_s.iva, 0)/100.0)) FROM ordenlinea ol_s WHERE ol_s.id_orden = o.id AND ol_s.tipo_item = 'SERVICIO'), 0) as total_servicios_neto,
                COALESCE((SELECT SUM(ol_p.subtotal) FROM ordenlinea ol_p WHERE ol_p.id_orden = o.id AND ol_p.tipo_item <> 'SERVICIO'), 0) as total_productos_bruto,
                COALESCE((SELECT SUM(ol_p.subtotal * (1 + COALESCE(ol_p.iva, 0)/100.0)) FROM ordenlinea ol_p WHERE ol_p.id_orden = o.id AND ol_p.tipo_item <> 'SERVICIO'), 0) as total_productos_neto,
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
                 ORDER BY op2.created_at DESC LIMIT 1) as ultimo_medio_pago,
                o.en_cuenta_corriente
            FROM orden o
            JOIN clientefinal c ON o.id_cliente = c.id
            JOIN vehiculo v ON o.id_vehiculo = v.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            LEFT JOIN tipoorden to_field ON o.id_tipo_orden = to_field.id
            LEFT JOIN ordenpago op ON o.id = op.id_orden
            JOIN sucursal s ON o.id_sucursal = s.id
            WHERE s.id_tenant = $1
        `;

        const values = [id_tenant];
        let paramIndex = 2;

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

        // Filtro por mecánico
        if (idMecanico) {
            query += ` AND o.id_mecanico = $${paramIndex}`;
            values.push(idMecanico);
            paramIndex++;
        }

        // Filtro por sucursal
        if (idSucursal) {
            query += ` AND o.id_sucursal = $${paramIndex}`;
            values.push(idSucursal);
            paramIndex++;
        }

        // Filtro por Cliente - IMPORTANTE: Validar que sea un número válido
        if (idCliente !== null && idCliente !== undefined && !isNaN(idCliente) && idCliente > 0) {
            query += ` AND o.id_cliente = $${paramIndex}`;
            values.push(parseInt(idCliente));
            paramIndex++;
        }

        // Filtro por Vehículo
        if (idVehiculo) {
            query += ` AND o.id_vehiculo = $${paramIndex}`;
            values.push(idVehiculo);
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

        const db = getTenantDb(buildCtx(userContext));
        const result = await db.query(query, values);

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

        const countResult = await db.query(countQuery, countValues);

        return {
            ordenes: result.rows,
            total: parseInt(countResult.rows[0]?.total || 0),
            limit,
            offset
        };
    }

    /**
     * Obtiene una orden específica con sus líneas y pagos
     */
    async getOrdenById(idOrden, userContext) {
        const { id_tenant } = userContext;

        // Query para obtener la cabecera de la orden
        const ordenQuery = `
            SELECT 
                o.id,
                o.id_sucursal,
                o.id_cliente,
                o.id_vehiculo,
                o.id_usuario,
                o.id_mecanico,
                o.id_tipo_orden,
                o.id_estado_orden,
                o.km,
                o.concepto,
                o.descripcion,
                o.comentario_interno,
                o.total_bruto,
                o.total_iva,
                o.total_neto,
                o.created_at as fecha_ingreso,
                c.nombre as cliente_nombre,
                c.documento as cliente_documento,
                c.telefono as cliente_telefono,
                v.marca as vehiculo_marca,
                v.modelo as vehiculo_modelo,
                v.matricula as vehiculo_matricula,
                eo.id as estado_id,
                eo.codigo as estado_codigo,
                eo.nombre as estado_nombre,
                to_field.id as tipo_orden_id,
                to_field.codigo as tipo_orden_codigo,
                to_field.nombre as tipo_orden_nombre,
                s.nombre as sucursal_nombre,
                u.nombre as mecanico_nombre
            FROM orden o
            JOIN clientefinal c ON o.id_cliente = c.id
            JOIN vehiculo v ON o.id_vehiculo = v.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            LEFT JOIN tipoorden to_field ON o.id_tipo_orden = to_field.id
            LEFT JOIN sucursal s ON o.id_sucursal = s.id
            LEFT JOIN usuario u ON o.id_mecanico = u.id
            WHERE o.id = $1 AND s.id_tenant = $2
        `;

        const db = getTenantDb(buildCtx(userContext));
        const ordenResult = await db.query(ordenQuery, [idOrden, id_tenant]);

        if (ordenResult.rows.length === 0) {
            throw new Error('Orden no encontrada');
        }

        const orden = ordenResult.rows[0];

        // Query para obtener las líneas de la orden
        const lineasQuery = `
            SELECT 
                ol.id,
                ol.id_producto,
                ol.id_impuesto,
                ol.tipo_item,
                ol.descripcion,
                ol.cantidad,
                ol.precio,
                ol.descuento,
                ol.iva,
                ol.subtotal,
                p.nombre as producto_nombre,
                p.codigo_barras as producto_codigo,
                -- Si hay impuesto registrado, usar su porcentaje. Si no, calcular del monto/subtotal
                COALESCE(
                    i.porcentaje,
                    CASE WHEN ol.subtotal > 0 THEN ROUND((ol.iva / ol.subtotal) * 100, 2)
                         ELSE 0
                    END
                ) as impuesto_porcentaje,
                i.nombre as impuesto_nombre
            FROM ordenlinea ol
            LEFT JOIN producto p ON ol.id_producto = p.id
            LEFT JOIN impuesto i ON ol.id_impuesto = i.id
            WHERE ol.id_orden = $1
            ORDER BY ol.id ASC
        `;

        const lineasResult = await db.query(lineasQuery, [idOrden]);

        // Query para obtener los pagos de la orden
        const pagosQuery = `
            SELECT 
                op.id,
                op.id_medio_pago,
                op.importe,
                op.referencia,
                op.created_at as fecha_pago,
                mp.codigo as medio_pago_codigo,
                mp.nombre as medio_pago_nombre
            FROM ordenpago op
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_orden = $1
            ORDER BY op.created_at ASC
        `;

        const pagosResult = await db.query(pagosQuery, [idOrden]);

        return {
            orden: orden,
            lineas: lineasResult.rows,
            pagos: pagosResult.rows
        };
    }

    /**
     * Actualiza una orden existente (cabecera + líneas)
     */
    async updateOrden(idOrden, data, userContext) {
        const { id_tenant, id_usuario } = userContext;
        const {
            idSucursal,
            idCliente,
            idVehiculo,
            idMecanico,
            idTipoOrden,
            codigoTipoOrden,
            idEstadoOrden,
            codigoEstadoOrden,
            km,
            concepto,
            descripcion,
            comentarioInterno,
            lineas,
            pagos, // Pagos nuevos a agregar
            pagosEliminados // IDs de pagos a eliminar
        } = data;

        // Verificar que la orden existe y pertenece al tenant
        const db = getTenantDb(buildCtx(userContext));
        const ordenExistente = await db.query(`
            SELECT o.id FROM orden o 
            JOIN sucursal s ON o.id_sucursal = s.id 
            WHERE o.id = $1 AND s.id_tenant = $2
        `, [idOrden, id_tenant]);
        if (ordenExistente.rows.length === 0) {
            throw new Error('Orden no encontrada');
        }

        const kmNumber = km !== undefined && km !== null && km !== '' ? Number(km) : 0;
        if (Number.isNaN(kmNumber) || kmNumber < 0) {
            throw new Error('Kilometraje inválido');
        }

        // Lookup TipoOrden si se proporciona
        let tipoOrdenId = null;
        if (idTipoOrden || codigoTipoOrden) {
            const tipoOrden = await ordenesRepository.getTipoOrdenByCodigoOrId({
                codigo: codigoTipoOrden,
                id: idTipoOrden
            });
            if (!tipoOrden) throw new Error('Tipo de orden no encontrado');
            tipoOrdenId = tipoOrden.id;
        }

        // Lookup EstadoOrden si se proporciona
        let estadoOrdenId = null;
        if (idEstadoOrden || codigoEstadoOrden) {
            const estadoOrden = await ordenesRepository.getEstadoOrdenByCodigoOrId({
                codigo: codigoEstadoOrden,
                id: idEstadoOrden
            });
            if (!estadoOrden) throw new Error('Estado de orden no encontrado');
            estadoOrdenId = estadoOrden.id;
        }

        // Procesar líneas si se proporcionan
        const lineasProcesadas = [];
        if (lineas && lineas.length > 0) {
            const normalizarTipoItem = (tipo) => {
                const raw = (tipo || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
                if (raw === 'SERVICIO' || raw === 'MANO_OBRA') return 'SERVICIO';
                return 'PRODUCTO';
            };

            for (const linea of lineas) {
                let producto = null;
                if (linea.idProducto) {
                    producto = await ordenesRepository.getProductoById(linea.idProducto, id_tenant);
                    if (!producto) throw new Error(`Producto ID ${linea.idProducto} no encontrado`);
                }

                const tipoItemNormalizado = normalizarTipoItem(linea.tipoItem || linea.tipo_item);

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
                } else if (linea.iva !== undefined) {
                    impuestoPorcentaje = Number(linea.iva);
                }

                const cantidad = Number(linea.cantidad);
                const precio = Number(linea.precio);
                const descuento = Number(linea.descuento) || 0;

                if (cantidad <= 0) throw new Error(`Cantidad inválida en ${linea.descripcion}`);
                if (precio < 0) throw new Error(`Precio inválido en ${linea.descripcion}`);

                const subtotal = (cantidad * precio) - descuento;
                const montoIva = subtotal * (impuestoPorcentaje / 100);
                const totalLinea = subtotal + montoIva;

                lineasProcesadas.push({
                    id: linea.id || null, // ID existente o null para nueva línea
                    idProducto: linea.idProducto,
                    idImpuesto: impuestoId,
                    ivaPorcentaje: impuestoPorcentaje,
                    tipoItem: tipoItemNormalizado,
                    cantidad,
                    precio,
                    descuento,
                    subtotal,
                    montoIva,
                    totalLinea,
                    descripcion: linea.descripcion || (producto ? producto.nombre : 'Item sin descripción')
                });
            }
        }

        // Transacción
        // Transacción
        // const db = getTenantDb(buildCtx(userContext)); // Removed duplicate declaration
        return await db.txWithRLS(async (tx) => {
            // Actualizar cabecera de la orden
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (idSucursal) {
                updateFields.push(`id_sucursal = $${paramIndex++}`);
                updateValues.push(idSucursal);
            }
            if (idCliente) {
                updateFields.push(`id_cliente = $${paramIndex++}`);
                updateValues.push(idCliente);
            }
            if (idVehiculo) {
                updateFields.push(`id_vehiculo = $${paramIndex++}`);
                updateValues.push(idVehiculo);
            }
            if (idMecanico) {
                updateFields.push(`id_mecanico = $${paramIndex++}`);
                updateValues.push(idMecanico);
            }
            if (tipoOrdenId) {
                updateFields.push(`id_tipo_orden = $${paramIndex++}`);
                updateValues.push(tipoOrdenId);
            }
            if (estadoOrdenId) {
                updateFields.push(`id_estado_orden = $${paramIndex++}`);
                updateValues.push(estadoOrdenId);
            }
            if (km !== undefined) {
                updateFields.push(`km = $${paramIndex++}`);
                updateValues.push(kmNumber);
            }
            if (concepto !== undefined) {
                updateFields.push(`concepto = $${paramIndex++}`);
                updateValues.push(concepto);
            }
            if (descripcion !== undefined) {
                updateFields.push(`descripcion = $${paramIndex++}`);
                updateValues.push(descripcion);
            }
            if (comentarioInterno !== undefined) {
                updateFields.push(`comentario_interno = $${paramIndex++}`);
                updateValues.push(comentarioInterno);
            }

            updateFields.push(`updated_at = NOW()`);
            updateFields.push(`updated_by = $${paramIndex++}`);
            updateValues.push(id_usuario);

            if (updateFields.length > 2) { // Al menos algún campo además de updated_at y updated_by
                updateValues.push(idOrden);
                const updateQuery = `
                    UPDATE orden 
                    SET ${updateFields.join(', ')}
                    WHERE id = $${paramIndex}
                `;
                await tx.query(updateQuery, updateValues);
            }

            // Si hay líneas, procesarlas
            let totalBruto = 0;
            let totalIva = 0;

            if (lineasProcesadas.length > 0) {
                // Obtener líneas actuales
                const lineasActualesResult = await tx.query(
                    'SELECT id, id_producto, cantidad FROM ordenlinea WHERE id_orden = $1',
                    [idOrden]
                );
                const lineasActualesMap = new Map(lineasActualesResult.rows.map(l => [l.id, l]));

                // Obtener almacén para movimientos de inventario
                const almacenResult = await tx.query(
                    'SELECT id FROM almacen WHERE id_sucursal = (SELECT id_sucursal FROM orden WHERE id = $1) LIMIT 1',
                    [idOrden]
                );
                const idAlmacen = almacenResult.rows[0]?.id;

                // IDs de líneas que vienen en el request
                const lineasIdsEnRequest = lineasProcesadas.filter(l => l.id).map(l => l.id);

                // Eliminar líneas que ya no están
                for (const [lineaId, lineaActual] of lineasActualesMap) {
                    if (!lineasIdsEnRequest.includes(lineaId)) {
                        // Devolver stock si era un producto
                        if (lineaActual.id_producto) {
                            await tx.query(
                                'UPDATE producto SET stock = COALESCE(stock, 0) + $1 WHERE id = $2',
                                [lineaActual.cantidad, lineaActual.id_producto]
                            );
                            // Registrar movimiento de entrada (devolución)
                            if (idAlmacen) {
                                await ordenesRepository.createMovimientoInventario(tx, {
                                    id_producto: lineaActual.id_producto,
                                    id_almacen: idAlmacen,
                                    tipo: 'ENTRADA',
                                    cantidad: lineaActual.cantidad,
                                    origen_tipo: 'ORDEN_EDICION',
                                    origen_id: idOrden,
                                    created_by: id_usuario
                                });
                            }
                        }
                        // Eliminar la línea
                        await tx.query('DELETE FROM ordenlinea WHERE id = $1', [lineaId]);
                    }
                }

                // Procesar cada línea (crear nuevas o actualizar existentes)
                for (const linea of lineasProcesadas) {
                    const esServicio = linea.tipoItem === 'SERVICIO';

                    if (linea.id && lineasActualesMap.has(linea.id)) {
                        // Actualizar línea existente
                        const lineaAnterior = lineasActualesMap.get(linea.id);

                        // Ajustar stock si cambió la cantidad y es producto
                        if (linea.idProducto && !esServicio) {
                            const diferenciaCantidad = linea.cantidad - lineaAnterior.cantidad;
                            if (diferenciaCantidad !== 0) {
                                if (diferenciaCantidad > 0) {
                                    // Más cantidad = más salida
                                    await ordenesRepository.decreaseProductoStock(tx, linea.idProducto, diferenciaCantidad);
                                    if (idAlmacen) {
                                        await ordenesRepository.createMovimientoInventario(tx, {
                                            id_producto: linea.idProducto,
                                            id_almacen: idAlmacen,
                                            tipo: 'SALIDA',
                                            cantidad: diferenciaCantidad,
                                            origen_tipo: 'ORDEN_EDICION',
                                            origen_id: idOrden,
                                            created_by: id_usuario
                                        });
                                    }
                                } else {
                                    // Menos cantidad = devolvemos stock
                                    await tx.query(
                                        'UPDATE producto SET stock = COALESCE(stock, 0) + $1 WHERE id = $2',
                                        [Math.abs(diferenciaCantidad), linea.idProducto]
                                    );
                                    if (idAlmacen) {
                                        await ordenesRepository.createMovimientoInventario(tx, {
                                            id_producto: linea.idProducto,
                                            id_almacen: idAlmacen,
                                            tipo: 'ENTRADA',
                                            cantidad: Math.abs(diferenciaCantidad),
                                            origen_tipo: 'ORDEN_EDICION',
                                            origen_id: idOrden,
                                            created_by: id_usuario
                                        });
                                    }
                                }
                            }
                        }

                        // Actualizar la línea
                        await tx.query(`
                            UPDATE ordenlinea SET
                                id_producto = $1,
                                id_impuesto = $2,
                                tipo_item = $3,
                                descripcion = $4,
                                cantidad = $5,
                                precio = $6,
                                descuento = $7,
                                iva = $8,
                                subtotal = $9,
                                updated_at = NOW()
                            WHERE id = $10
                        `, [
                            linea.idProducto,
                            linea.idImpuesto,
                            linea.tipoItem,
                            linea.descripcion,
                            linea.cantidad,
                            linea.precio,
                            linea.descuento,
                            linea.montoIva,
                            linea.subtotal,
                            linea.id
                        ]);
                    } else {
                        // Crear nueva línea
                        await ordenesRepository.createOrdenLinea(tx, {
                            id_orden: idOrden,
                            id_producto: linea.idProducto,
                            id_impuesto: linea.idImpuesto,
                            tipo_item: linea.tipoItem,
                            descripcion: linea.descripcion,
                            cantidad: linea.cantidad,
                            precio: linea.precio,
                            descuento: linea.descuento,
                            iva: linea.montoIva,
                            subtotal: linea.subtotal
                        });

                        // Descontar stock si es producto nuevo
                        if (linea.idProducto && !esServicio) {
                            await ordenesRepository.decreaseProductoStock(tx, linea.idProducto, linea.cantidad);
                            if (idAlmacen) {
                                await ordenesRepository.createMovimientoInventario(tx, {
                                    id_producto: linea.idProducto,
                                    id_almacen: idAlmacen,
                                    tipo: 'SALIDA',
                                    cantidad: linea.cantidad,
                                    origen_tipo: 'ORDEN_EDICION',
                                    origen_id: idOrden,
                                    created_by: id_usuario
                                });
                            }
                        }
                    }

                    totalBruto += linea.subtotal;
                    totalIva += linea.montoIva;
                }

                // Actualizar totales
                const totalNeto = totalBruto + totalIva;
                await ordenesRepository.updateOrdenTotales(tx, idOrden, {
                    total_bruto: totalBruto,
                    total_iva: totalIva,
                    total_neto: totalNeto
                });
            }

            // Procesar pagos eliminados (si se envían)
            if (pagosEliminados && pagosEliminados.length > 0) {
                console.log(`[updateOrden] Eliminando ${pagosEliminados.length} pagos:`, pagosEliminados);
                for (const idPago of pagosEliminados) {
                    // Primero eliminar movimientos de caja asociados
                    await tx.query(`
                        DELETE FROM cajamovimiento 
                        WHERE origen_tipo = 'ORDEN_PAGO' AND origen_id = $1
                    `, [idOrden]);

                    // Luego eliminar el pago
                    await tx.query('DELETE FROM ordenpago WHERE id = $1 AND id_orden = $2', [idPago, idOrden]);
                    console.log(`[updateOrden] Pago ${idPago} y sus movimientos de caja eliminados`);
                }
            }

            // Procesar nuevos pagos (si se envían)
            let pagosProcesados = 0;
            console.log(`[updateOrden] Pagos recibidos: ${pagos ? pagos.length : 0}`, pagos);
            if (pagos && pagos.length > 0) {
                // Validar que el total a pagar no exceda el total de la orden
                const ordenInfo = await tx.query(
                    'SELECT total_neto FROM orden WHERE id = $1',
                    [idOrden]
                );
                const totalOrden = parseFloat(ordenInfo.rows[0]?.total_neto) || 0;

                const pagosExistentes = await tx.query(
                    'SELECT COALESCE(SUM(importe), 0) as total_pagado FROM ordenpago WHERE id_orden = $1',
                    [idOrden]
                );
                const totalPagadoActual = parseFloat(pagosExistentes.rows[0]?.total_pagado) || 0;

                const nuevoTotalPago = pagos.reduce((sum, p) => sum + (parseFloat(p.importe) || 0), 0);
                const totalFinal = totalPagadoActual + nuevoTotalPago;

                console.log(`[updateOrden] Validación: Total orden=${totalOrden}, Pagado=${totalPagadoActual}, Nuevo=${nuevoTotalPago}, Final=${totalFinal}`);

                if (totalFinal > totalOrden + 0.01) { // Tolerancia de 1 céntimo
                    throw new Error(`El total de pagos (${totalFinal.toFixed(2)}€) excede el total de la orden (${totalOrden.toFixed(2)}€)`);
                }

                // Obtener o crear caja abierta
                let idCajaActual = null;
                const sucursalId = idSucursal || (await tx.query('SELECT id_sucursal FROM orden WHERE id = $1', [idOrden])).rows[0]?.id_sucursal;

                if (sucursalId) {
                    const cajaAbierta = await ordenesRepository.getOpenCaja(tx, sucursalId);
                    if (cajaAbierta) {
                        idCajaActual = cajaAbierta.id;
                    } else {
                        const nuevaCaja = await ordenesRepository.createOpenCaja(tx, sucursalId, id_usuario);
                        idCajaActual = nuevaCaja.id;
                    }
                }

                for (const pago of pagos) {
                    // Validar medio de pago
                    const medio = await ordenesRepository.getMedioPagoByCodigoOrId({
                        codigo: pago.codigoMedioPago,
                        id: pago.idMedioPago
                    });
                    if (!medio) {
                        console.warn(`Medio de pago ${pago.codigoMedioPago || pago.idMedioPago} no encontrado, omitiendo pago`);
                        continue;
                    }
                    // SIEMPRE usar la caja de la sucursal de la orden (ignorar idCaja del frontend)
                    const idCajaFinal = idCajaActual;

                    // Crear registro de pago
                    await ordenesRepository.createOrdenPago(tx, {
                        id_orden: idOrden,
                        id_medio_pago: medio.id,
                        importe: pago.importe,
                        referencia: pago.referencia,
                        id_caja: idCajaFinal,
                        created_by: id_usuario
                    });

                    // Registrar movimiento de caja para pagos reales (excepto cuenta corriente)
                    const codigoMedio = (medio.codigo || '').toUpperCase();
                    const mediosSinCaja = ['CUENTA_CORRIENTE'];
                    console.log(`[updateOrden] Pago ${pago.importe}€ - Medio: ${codigoMedio} - Caja: ${idCajaFinal}`);

                    if (!mediosSinCaja.includes(codigoMedio) && idCajaFinal) {
                        await ordenesRepository.createCajaMovimiento(tx, {
                            id_caja: idCajaFinal,
                            id_usuario: id_usuario,
                            tipo: 'INGRESO',
                            monto: pago.importe,
                            origen_tipo: 'ORDEN_PAGO',
                            origen_id: idOrden,
                            created_by: id_usuario
                        });
                        console.log(`[updateOrden] Movimiento de caja creado: ${pago.importe}€ en caja ${idCajaFinal}`);
                    }

                    pagosProcesados++;
                }
            }

            return {
                id: idOrden,
                message: 'Orden actualizada correctamente',
                total_bruto: totalBruto,
                total_iva: totalIva,
                total_neto: totalBruto + totalIva,
                lineas: lineasProcesadas.length,
                pagos: pagosProcesados
            };
        });
    }

    /**
     * Actualiza solo el estado de una orden (cambio rápido)
     */
    async updateEstadoOrden(idOrden, { idEstadoOrden, codigoEstado }, userContext) {
        const { id_usuario } = userContext;

        // Verificar que la orden existe
        const db = getTenantDb(buildCtx(userContext));
        const ordenExistente = await db.query('SELECT id FROM orden WHERE id = $1', [idOrden]);
        if (ordenExistente.rows.length === 0) {
            throw new Error('Orden no encontrada');
        }

        // Obtener el estado
        const estadoOrden = await ordenesRepository.getEstadoOrdenByCodigoOrId({
            codigo: codigoEstado,
            id: idEstadoOrden
        });

        if (!estadoOrden) {
            throw new Error('Estado de orden no encontrado');
        }

        // Actualizar estado
        // const db = getTenantDb(buildCtx(userContext)); // Removed duplicate declaration
        await db.query(`
            UPDATE orden 
            SET id_estado_orden = $1, updated_at = NOW(), updated_by = $2
            WHERE id = $3
        `, [estadoOrden.id, id_usuario, idOrden]);

        // Obtener datos del estado para retornar
        const estadoResult = await db.query(
            'SELECT id, codigo, nombre FROM estadoorden WHERE id = $1',
            [estadoOrden.id]
        );

        return {
            id: idOrden,
            estado: estadoResult.rows[0],
            message: 'Estado actualizado correctamente'
        };
    }

    /**
     * Obtiene todos los estados de orden disponibles
     */
    async getEstadosOrden(userContext) {
        const db = getTenantDb(buildCtx(userContext));
        const result = await db.query(
            'SELECT id, codigo, nombre, color, orden FROM estadoorden ORDER BY COALESCE(orden, id) ASC'
        );
        return result.rows;
    }

    /**
     * Actualiza un estado de orden (nombre, color, orden)
     */
    async updateEstadoOrdenConfig(idEstado, data, userContext) {
        const { nombre, color, orden } = data;
        const db = getTenantDb(buildCtx(userContext));

        const result = await db.query(`
            UPDATE estadoorden 
            SET nombre = COALESCE($1, nombre),
                color = COALESCE($2, color),
                orden = COALESCE($3, orden)
            WHERE id = $4
            RETURNING id, codigo, nombre, color, orden
        `, [nombre, color, orden, idEstado]);

        if (result.rows.length === 0) {
            throw new Error('Estado no encontrado');
        }

        return result.rows[0];
    }

    /**
     * Actualiza múltiples estados de orden a la vez
     */
    async updateEstadosOrdenBatch(estados, userContext) {
        const results = [];
        const db = getTenantDb(buildCtx(userContext));

        for (const estado of estados) {
            const result = await db.query(`
                UPDATE estadoorden 
                SET nombre = COALESCE($1, nombre),
                    color = COALESCE($2, color),
                    orden = COALESCE($3, orden)
                WHERE id = $4
                RETURNING id, codigo, nombre, color, orden
            `, [estado.nombre, estado.color, estado.orden, estado.id]);

            if (result.rows.length > 0) {
                results.push(result.rows[0]);
            }
        }
        return results;
    }
}

module.exports = new OrdenesService();
