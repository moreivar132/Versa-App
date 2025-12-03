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
        for (const linea of lineas) {
            // Validar producto SOLO si se proporcionó un ID
            let producto = null;
            if (linea.idProducto) {
                producto = await ordenesRepository.getProductoById(linea.idProducto, id_tenant);
                if (!producto) throw new Error(`Producto ID ${linea.idProducto} no encontrado o no pertenece al tenant`);
            }

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

            // Cálculos
            const subtotal = (cantidad * precio) - descuento;
            const montoIva = subtotal * (impuestoPorcentaje / 100);
            const totalLinea = subtotal + montoIva;

            lineasProcesadas.push({
                ...linea,
                idImpuesto: impuestoId,
                ivaPorcentaje: impuestoPorcentaje,
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

                totalBruto += linea.subtotal;
                totalIva += linea.montoIva;
            }

            const totalNeto = totalBruto + totalIva;

            // Insertar Pagos
            for (const pago of pagosProcesados) {
                await ordenesRepository.createOrdenPago(client, {
                    id_orden: idOrden,
                    id_medio_pago: pago.idMedioPago,
                    importe: pago.importe,
                    referencia: pago.referencia,
                    id_caja: pago.idCaja,
                    created_by: id_usuario
                });
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
}

module.exports = new OrdenesService();
