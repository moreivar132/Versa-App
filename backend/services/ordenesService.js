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
            idTipoOrden,
            km,
            concepto,
            descripcion,
            comentarioInterno,
            lineas
        } = data;

        // 1. Validaciones básicas
        if (!idSucursal || !idCliente || !idVehiculo || !idMecanico || !idTipoOrden || !lineas || lineas.length === 0) {
            throw new Error('Faltan campos obligatorios');
        }

        // 2. Validaciones de pertenencia
        const sucursalValida = await ordenesRepository.checkSucursal(idSucursal, id_tenant);
        if (!sucursalValida) throw new Error('Sucursal no válida o no pertenece al tenant');

        const clienteValido = await ordenesRepository.checkCliente(idCliente, id_tenant);
        if (!clienteValido) throw new Error('Cliente no válido o no pertenece al tenant');

        const vehiculoValido = await ordenesRepository.checkVehiculo(idVehiculo, id_tenant);
        if (!vehiculoValido) throw new Error('Vehículo no válido o no pertenece al tenant');

        const mecanicoValido = await ordenesRepository.checkMecanico(idMecanico, id_tenant);
        if (!mecanicoValido) throw new Error('Mecánico no válido o no pertenece al tenant');

        const tipoOrdenValido = await ordenesRepository.checkTipoOrden(idTipoOrden);
        if (!tipoOrdenValido) throw new Error('Tipo de orden no válido');

        for (const linea of lineas) {
            if (linea.idProducto) {
                const productoValido = await ordenesRepository.checkProducto(linea.idProducto, id_tenant);
                if (!productoValido) throw new Error(`Producto ${linea.idProducto} no válido o no pertenece al tenant`);
            }
            if (linea.cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0');
            if (linea.precio < 0) throw new Error('El precio no puede ser negativo');
        }

        // 3. Obtener estado inicial
        const estadoAbierta = await ordenesRepository.getEstadoAbierta();
        if (!estadoAbierta) throw new Error('Estado ABIERTA no encontrado en la base de datos');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 4. Crear Orden
            const ordenData = {
                id_tenant,
                id_sucursal: idSucursal,
                id_cliente: idCliente,
                id_vehiculo: idVehiculo,
                id_mecanico: idMecanico,
                id_tipoorden: idTipoOrden,
                id_estadoorden: estadoAbierta.id,
                km: km || 0,
                concepto,
                descripcion: descripcion || '',
                comentario_interno: comentarioInterno || '',
                creado_por: id_usuario
            };

            const nuevaOrden = await ordenesRepository.createOrden(client, ordenData);
            const idOrden = nuevaOrden.id;

            // 5. Procesar Líneas
            let totalBrutoOrden = 0;
            let totalIvaOrden = 0;

            const lineasCreadas = [];

            for (const linea of lineas) {
                const cantidad = parseFloat(linea.cantidad);
                const precio = parseFloat(linea.precio);
                const descuento = parseFloat(linea.descuento) || 0; // Descuento en % o monto? Asumiremos monto por ahora o %?
                // El user dijo "descuento" en el payload. En el frontend hay un descuento global en %.
                // Pero en las líneas también hay descuento.
                // Asumiremos que el descuento de línea es un monto unitario o total?
                // El user dijo: "Guardar cantidad, precio, descuento, iva, total_bruto_linea, total_iva_linea, total_neto_linea."
                // Vamos a asumir que 'descuento' es un monto total de descuento para esa línea, o unitario?
                // Normalmente es unitario o porcentaje.
                // Dado el frontend, parece que el descuento es global. Pero el payload tiene "descuento" en cada línea.
                // Voy a asumir que el descuento en la línea es MONTO TOTAL de descuento para esa línea.

                // Calculos:
                // Base = precio * cantidad
                // Neto Linea = Base - Descuento
                // IVA Linea = Neto Linea * (iva / 100)
                // Total Linea = Neto Linea + IVA Linea

                // Wait, "total_bruto" usually means base. "total_neto" usually means final.
                // User said:
                // total_bruto = suma de base de todas las líneas
                // total_iva = suma del IVA de todas las líneas
                // total_neto = total_bruto + total_iva - descuentos (según modelo)

                // Let's stick to:
                // Linea:
                // Bruto = precio * cantidad
                // Descuento = linea.descuento (asumido monto)
                // Base Imponible = Bruto - Descuento
                // IVA = Base Imponible * (linea.iva / 100)
                // Neto (Final) = Base Imponible + IVA

                const brutoLinea = precio * cantidad;
                const descuentoLinea = parseFloat(linea.descuento) || 0;
                const baseImponible = brutoLinea - descuentoLinea;
                const ivaPorcentaje = parseFloat(linea.iva) || 0;
                const ivaLinea = baseImponible * (ivaPorcentaje / 100);
                const netoLinea = baseImponible + ivaLinea;

                await ordenesRepository.createOrdenLinea(client, {
                    id_orden: idOrden,
                    id_producto: linea.idProducto,
                    descripcion: linea.descripcion,
                    cantidad,
                    precio,
                    descuento: descuentoLinea,
                    iva: ivaPorcentaje,
                    total_bruto_linea: brutoLinea,
                    total_iva_linea: ivaLinea,
                    total_neto_linea: netoLinea
                });

                totalBrutoOrden += brutoLinea; // O baseImponible? "total_bruto = suma de base de todas las líneas". I'll use brutoLinea (pre-discount) or baseImponible? Usually Bruto is pre-discount.
                // User said: "total_neto = total_bruto + total_iva - descuentos".
                // So: Total Neto = (Sum Bruto) + (Sum IVA) - (Sum Descuentos).
                // Yes.
                totalIvaOrden += ivaLinea;
                // We need to sum discounts too if we want to follow that formula exactly, or just sum netos.
                // Let's calculate final totals based on the formula.
            }

            // Calculate Order Totals
            // I need the sum of discounts to apply the formula strictly, or just sum the line netos?
            // "total_neto = total_bruto + total_iva - descuentos"
            // Let's sum discounts from lines.
            const totalDescuentos = lineas.reduce((acc, l) => acc + (parseFloat(l.descuento) || 0), 0);

            const totalNetoOrden = totalBrutoOrden + totalIvaOrden - totalDescuentos;

            await ordenesRepository.updateOrdenTotales(client, idOrden, {
                total_bruto: totalBrutoOrden,
                total_iva: totalIvaOrden,
                total_neto: totalNetoOrden
            });

            await client.query('COMMIT');

            return {
                id: idOrden,
                total_bruto: totalBrutoOrden,
                total_iva: totalIvaOrden,
                total_neto: totalNetoOrden,
                lineas: lineas.length
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
