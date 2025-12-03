const pool = require('../db');
const ordenesRepository = require('../repositories/ordenesRepository');

class OrdenesService {
    async createOrden(data, userContext) {
        const { id_tenant, id_usuario } = userContext || {};
        const {
            idSucursal,
            idCliente,
            idVehiculo,
            idUsuario,
            idMecanico,
            codigoTipoOrden,
            idTipoOrden,
            codigoEstadoOrden,
            idEstadoOrden,
            km,
            concepto,
            descripcion,
            comentarioInterno,
            lineas,
            pagos = []
        } = data;

        const creadorId = idUsuario || id_usuario;
        const kmNumber = km !== undefined && km !== null && km !== '' ? Number(km) : null;

        if (!idSucursal || !idCliente || !idVehiculo || !creadorId) {
            throw new Error('Faltan campos obligatorios para crear la orden');
        }

        if (!Array.isArray(lineas) || lineas.length === 0) {
            throw new Error('La orden debe incluir al menos una línea');
        }

        if (kmNumber !== null && (Number.isNaN(kmNumber) || kmNumber < 0)) {
            throw new Error('Kilometraje inválido');
        }

        if (!id_tenant) {
            throw new Error('Tenant no definido en el contexto del usuario');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const tipoOrden = await ordenesRepository.getTipoOrdenByCodigoOrId(
                { codigo: codigoTipoOrden, id: idTipoOrden },
                client
            );
            if (!tipoOrden) {
                throw new Error('Tipo de orden no encontrado');
            }

            const estadoOrden = await ordenesRepository.getEstadoOrdenByCodigoOrId(
                { codigo: codigoEstadoOrden, id: idEstadoOrden },
                client
            );
            if (!estadoOrden) {
                throw new Error('Estado de orden no encontrado');
            }

            const sucursalValida = await ordenesRepository.checkSucursal(idSucursal, id_tenant, client);
            if (!sucursalValida) {
                throw new Error('Sucursal no válida o no pertenece al tenant');
            }

            const clienteValido = await ordenesRepository.checkCliente(idCliente, id_tenant, client);
            if (!clienteValido) {
                throw new Error('Cliente no válido o no pertenece al tenant');
            }

            const vehiculoValido = await ordenesRepository.checkVehiculo(idVehiculo, id_tenant, client);
            if (!vehiculoValido) {
                throw new Error('Vehículo no válido o no pertenece al tenant');
            }

            if (idMecanico) {
                const mecanicoValido = await ordenesRepository.checkMecanico(idMecanico, id_tenant, client);
                if (!mecanicoValido) {
                    throw new Error('Mecánico no válido o no pertenece al tenant');
                }
            }

            let totalBrutoOrden = 0;
            let totalIvaOrden = 0;

            const lineasCalculadas = [];

            for (const linea of lineas) {
                const { idProducto, idImpuesto, tipoItem, descripcion: descLinea, cantidad, precio, descuento = 0 } = linea;

                if (!idProducto) {
                    throw new Error('Cada línea debe incluir un idProducto');
                }

                const cantidadNum = Number(cantidad);
                const precioNum = Number(precio);
                const descuentoNum = Number(descuento) || 0;

                if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
                    throw new Error('La cantidad debe ser un número mayor a 0');
                }

                if (Number.isNaN(precioNum) || precioNum < 0) {
                    throw new Error('El precio debe ser un número mayor o igual a 0');
                }

                if (descuentoNum < 0) {
                    throw new Error('El descuento no puede ser negativo');
                }

                const producto = await ordenesRepository.getProductoById(idProducto, id_tenant, client);
                if (!producto) {
                    throw new Error(`Producto ${idProducto} no encontrado o no pertenece al tenant`);
                }

                let impuesto = null;
                if (idImpuesto) {
                    impuesto = await ordenesRepository.getImpuestoById(idImpuesto, client);
                    if (!impuesto) {
                        throw new Error(`Impuesto ${idImpuesto} no encontrado`);
                    }
                } else if (producto.id_impuesto) {
                    impuesto = await ordenesRepository.getImpuestoById(producto.id_impuesto, client);
                }

                const porcentajeImpuesto = impuesto ? Number(impuesto.porcentaje) : 0;
                const subtotal = cantidadNum * precioNum - descuentoNum;

                if (subtotal < 0) {
                    throw new Error('El subtotal de una línea no puede ser negativo');
                }

                const iva = subtotal * (porcentajeImpuesto / 100);

                totalBrutoOrden += subtotal;
                totalIvaOrden += iva;

                lineasCalculadas.push({
                    id_producto: idProducto,
                    id_impuesto: impuesto ? impuesto.id : null,
                    tipo_item: tipoItem || null,
                    descripcion: descLinea || producto.nombre,
                    cantidad: cantidadNum,
                    precio: precioNum,
                    descuento: descuentoNum,
                    iva,
                    subtotal
                });
            }

            const totalNetoOrden = totalBrutoOrden + totalIvaOrden;

            const nuevaOrden = await ordenesRepository.createOrden(client, {
                id_sucursal: idSucursal,
                id_cliente: idCliente,
                id_vehiculo: idVehiculo,
                id_usuario: creadorId,
                id_mecanico: idMecanico || null,
                id_tipo_orden: tipoOrden.id,
                id_estado_orden: estadoOrden.id,
                km: kmNumber,
                concepto: concepto || '',
                descripcion: descripcion || '',
                comentario_interno: comentarioInterno || '',
                total_bruto: totalBrutoOrden,
                total_iva: totalIvaOrden,
                total_neto: totalNetoOrden,
                created_by: creadorId
            });

            const lineasInsertadas = [];
            for (const linea of lineasCalculadas) {
                const lineaCreada = await ordenesRepository.createOrdenLinea(client, {
                    ...linea,
                    id_orden: nuevaOrden.id
                });
                lineasInsertadas.push(lineaCreada);
            }

            const pagosInsertados = [];
            for (const pago of pagos) {
                if (!pago) continue;
                const { codigoMedioPago, idMedioPago, importe, referencia, idCaja } = pago;
                const medioPago = await ordenesRepository.getMedioPagoByCodigoOrId(
                    { codigo: codigoMedioPago, id: idMedioPago },
                    client
                );
                if (!medioPago) {
                    throw new Error('Medio de pago no encontrado');
                }

                const importeNum = Number(importe);
                if (Number.isNaN(importeNum) || importeNum <= 0) {
                    throw new Error('El importe del pago debe ser un número mayor a 0');
                }

                const pagoCreado = await ordenesRepository.createOrdenPago(client, {
                    id_orden: nuevaOrden.id,
                    id_medio_pago: medioPago.id,
                    importe: importeNum,
                    referencia: referencia || null,
                    id_caja: idCaja || null,
                    created_by: creadorId
                });
                pagosInsertados.push(pagoCreado);
            }

            await client.query('COMMIT');

            return {
                orden: nuevaOrden,
                lineas: lineasInsertadas,
                pagos: pagosInsertados
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
