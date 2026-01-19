const ordenPagoRepository = require('../repositories/ordenPagoRepository');
const { getTenantDb } = require('../src/core/db/tenant-db');

class OrdenPagoService {
    /**
     * Registra un pago para una orden específica.
     * @param {object} ctx - Contexto de la request
     * @param {number} idOrden - ID de la orden
     * @param {object} datosPago - Datos del pago (medioPago, importe, referencia, idCaja, createdBy)
     * @returns {Promise<object>} - El registro de pago creado y resumen actualizado
     */
    async registrarPago(ctx, idOrden, datosPago) {
        const ordenesRepository = require('../repositories/ordenesRepository');
        const db = getTenantDb(ctx);
        const { medioPago, importe, referencia, idCaja, createdBy } = datosPago;

        // 1. Validar inputs básicos
        if (!idOrden) throw { status: 400, message: 'El ID de la orden es requerido.' };
        if (importe === undefined || importe === null || importe === '') throw { status: 400, message: 'El importe es requerido.' };

        const importeNumerico = parseFloat(importe);
        if (isNaN(importeNumerico) || importeNumerico <= 0) throw { status: 400, message: 'El importe debe ser un número mayor a 0.' };
        if (!medioPago) throw { status: 400, message: 'El medio de pago es requerido.' };

        return db.txWithRLS(async (tx) => {
            // 2. Validar que la orden existe Y obtener sucursal
            const orden = await ordenPagoRepository.obtenerDatosOrden(tx, idOrden);
            if (!orden) throw { status: 404, message: `La orden con ID ${idOrden} no existe.` };

            // 3. Resolver medio de pago
            const medioPagoEntidad = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(tx, medioPago);
            if (!medioPagoEntidad) throw { status: 404, message: `El medio de pago '${medioPago}' no existe.` };

            // 4. Resolver Caja
            let idCajaFinal = idCaja;
            if (idCajaFinal) {
                const cajaExiste = await ordenPagoRepository.existeCaja(tx, idCajaFinal);
                if (!cajaExiste) throw { status: 400, message: `La caja con ID ${idCajaFinal} no existe.` };
            } else {
                // Auto-detectar caja abierta
                const cajaAbierta = await ordenesRepository.getOpenCaja(tx, orden.id_sucursal);
                if (cajaAbierta) {
                    idCajaFinal = cajaAbierta.id;
                } else {
                    const nuevaCaja = await ordenesRepository.createOpenCaja(tx, orden.id_sucursal, createdBy || ctx.userId);
                    idCajaFinal = nuevaCaja.id;
                }
            }

            // 5. Preparar datos
            const nuevoPago = {
                id_orden: idOrden,
                id_medio_pago: medioPagoEntidad.id,
                importe: importeNumerico,
                referencia: referencia || null,
                id_caja: idCajaFinal,
                created_by: createdBy || ctx.userId
            };

            // 6. Insertar pago
            const pagoCreado = await ordenPagoRepository.insertarPagoOrden(tx, nuevoPago);

            // 7. Registrar movimiento de caja para pagos reales (excepto cuenta corriente)
            const codigoMedio = (medioPagoEntidad.codigo || '').toUpperCase();
            const mediosSinCaja = ['CUENTA_CORRIENTE'];

            if (!mediosSinCaja.includes(codigoMedio) && idCajaFinal) {
                await tx.query(`
                    INSERT INTO cajamovimiento 
                    (id_caja, id_usuario, tipo, monto, origen_tipo, origen_id, fecha, created_at, created_by)
                    VALUES ($1, $2, 'INGRESO', $3, 'ORDEN_PAGO', $4, NOW(), NOW(), $2)
                `, [idCajaFinal, createdBy || ctx.userId, importeNumerico, idOrden]);
            }

            return { pago: pagoCreado };
        });
    }
}

module.exports = new OrdenPagoService();
