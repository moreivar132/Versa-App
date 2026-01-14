/**
 * Ventas Service
 * Lógica de negocio del módulo de ventas.
 * NO hay SQL aquí - toda persistencia vía ventasRepo.
 */

const ventasRepo = require('../infra/ventas.repo');
const incomeService = require('../../../../services/incomeService');

/**
 * Procesar líneas de venta y calcular totales
 * @param {Array} lineas - Líneas crudas de la request
 * @returns {Object} { lineasProcesadas, totalBruto, totalDescuento, totalIva, totalNeto }
 */
function procesarLineas(lineas) {
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

    return {
        lineasProcesadas,
        totalBruto,
        totalDescuento,
        totalIva,
        totalNeto: totalBruto + totalIva
    };
}

class VentasService {
    /**
     * Crear nueva venta
     * @param {Object} data - Datos de la venta
     * @param {Object} ctx - Contexto { tenantId, userId, requestId }
     */
    async createVenta(data, ctx) {
        const { idSucursal, idCliente, idCaja, observaciones, lineas, pagos } = data;

        // Validaciones de negocio
        if (!idSucursal || !idCliente) {
            throw new Error('Faltan campos obligatorios (Sucursal, Cliente)');
        }
        if (!lineas || lineas.length === 0) {
            throw new Error('La venta debe tener al menos un producto');
        }

        // Procesar líneas y calcular totales
        const { lineasProcesadas, totalBruto, totalDescuento, totalIva, totalNeto } = procesarLineas(lineas);

        // Crear venta en repo (transacción)
        const ventaData = {
            idSucursal,
            idCliente,
            idCaja,
            observaciones,
            totalBruto,
            totalDescuento,
            totalIva,
            totalNeto
        };

        const idVenta = await ventasRepo.create(ventaData, lineasProcesadas, ctx);

        // Procesar pagos
        if (pagos && pagos.length > 0) {
            for (const pago of pagos) {
                const pagoConCaja = { ...pago, idCaja: pago.idCaja || idCaja };
                await ventasRepo.insertPago(idVenta, pagoConCaja, ctx);

                // Movimiento de caja
                const cajaId = pago.idCaja || idCaja;
                if (cajaId) {
                    await ventasRepo.insertMovimientoCaja(cajaId, pago.importe, idVenta, ctx);
                }

                // Emitir income_event para ledger central
                try {
                    await incomeService.createIncomeEvent({
                        idTenant: ctx.tenantId,
                        idSucursal: idSucursal,
                        origen: 'crm',
                        originType: 'venta',
                        originId: idVenta,
                        idCliente: idCliente,
                        amount: pago.importe,
                        currency: 'EUR',
                        status: 'paid',
                        provider: pago.codigoMedioPago === 'CASH' ? 'cash' : 'card',
                        reference: `venta:${idVenta}:pago:${Date.now()}`,
                        description: `Pago venta #${idVenta}`,
                        metadata: { medio_pago: pago.codigoMedioPago }
                    });
                } catch (incomeError) {
                    console.error('[VentasService] Error creando income_event:', incomeError.message);
                }
            }
        }

        return {
            ok: true,
            id: idVenta,
            total_bruto: totalBruto,
            total_iva: totalIva,
            total_neto: totalNeto,
            lineas: lineasProcesadas.length,
            pagos: pagos?.length || 0
        };
    }

    /**
     * Listar ventas con filtros
     */
    async getVentas(filtros, ctx) {
        const ventas = await ventasRepo.findAll(filtros, ctx);
        const total = await ventasRepo.countAll(ctx);

        return {
            ventas,
            total,
            limit: filtros.limit || 50,
            offset: filtros.offset || 0
        };
    }

    /**
     * Obtener venta por ID con líneas y pagos
     */
    async getVentaById(id, ctx) {
        const venta = await ventasRepo.findById(id, ctx);
        if (!venta) {
            throw new Error('Venta no encontrada');
        }

        const lineas = await ventasRepo.findLineas(id, ctx);
        const pagos = await ventasRepo.findPagos(id, ctx);

        return { venta, lineas, pagos };
    }

    /**
     * Anular venta (revierte stock)
     */
    async anularVenta(id, ctx) {
        const venta = await ventasRepo.findById(id, ctx);
        if (!venta) {
            throw new Error('Venta no encontrada');
        }
        if (venta.estado === 'ANULADA') {
            throw new Error('La venta ya está anulada');
        }

        // Revertir stock
        await ventasRepo.revertirStock(id, ctx);

        // Actualizar estado
        await ventasRepo.updateEstado(id, 'ANULADA', ctx);

        return { ok: true, message: 'Venta anulada correctamente' };
    }

    /**
     * Actualizar venta existente
     */
    async updateVenta(id, data, ctx) {
        const venta = await ventasRepo.findById(id, ctx);
        if (!venta) {
            throw new Error('Venta no encontrada');
        }
        if (venta.estado === 'ANULADA') {
            throw new Error('No se puede editar una venta anulada');
        }

        // Este método requiere transacción compleja - delegamos al repo original
        // Por ahora, reutilizamos el service legacy para update
        const legacyService = require('../../../../services/ventasService');
        return legacyService.updateVenta(id, data, {
            id_tenant: ctx.tenantId,
            id_usuario: ctx.userId
        });
    }

    /**
     * Eliminar venta
     */
    async deleteVenta(id, ctx) {
        const venta = await ventasRepo.findById(id, ctx);
        if (!venta) {
            throw new Error('Venta no encontrada');
        }

        // Este método requiere transacción compleja - delegamos al repo original
        const legacyService = require('../../../../services/ventasService');
        return legacyService.deleteVenta(id, {
            id_tenant: ctx.tenantId,
            id_usuario: ctx.userId
        });
    }
}

module.exports = new VentasService();
