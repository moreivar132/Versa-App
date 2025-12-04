const ordenPagoRepository = require('../repositories/ordenPagoRepository');

class OrdenPagoService {
    /**
     * Registra un pago para una orden específica.
     * @param {number} idOrden - ID de la orden
     * @param {object} datosPago - Datos del pago (medioPago, importe, referencia, idCaja, createdBy)
     * @returns {Promise<object>} - El registro de pago creado y resumen actualizado
     */
    async registrarPago(idOrden, datosPago) {
        const { medioPago, importe, referencia, idCaja, createdBy } = datosPago;

        // 1. Validar inputs básicos
        if (!idOrden) {
            throw { status: 400, message: 'El ID de la orden es requerido.' };
        }
        if (importe === undefined || importe === null || importe === '') {
            throw { status: 400, message: 'El importe es requerido.' };
        }

        const importeNumerico = parseFloat(importe);
        if (isNaN(importeNumerico) || importeNumerico <= 0) {
            throw { status: 400, message: 'El importe debe ser un número mayor a 0.' };
        }

        if (!medioPago) {
            throw { status: 400, message: 'El medio de pago es requerido.' };
        }

        // 2. Validar que la orden existe
        const ordenExiste = await ordenPagoRepository.existeOrden(idOrden);
        if (!ordenExiste) {
            throw { status: 404, message: `La orden con ID ${idOrden} no existe.` };
        }

        // 3. Resolver medio de pago (ID o Código)
        const medioPagoEntidad = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(medioPago);
        if (!medioPagoEntidad) {
            throw { status: 404, message: `El medio de pago '${medioPago}' no existe.` };
        }

        // 4. Validar caja si se proporciona
        if (idCaja) {
            const cajaExiste = await ordenPagoRepository.existeCaja(idCaja);
            if (!cajaExiste) {
                throw { status: 400, message: `La caja con ID ${idCaja} no existe.` };
            }
        }

        // 5. Preparar datos para inserción
        const nuevoPago = {
            id_orden: idOrden,
            id_medio_pago: medioPagoEntidad.id,
            importe: importeNumerico,
            referencia: referencia || null,
            id_caja: idCaja || null,
            created_by: createdBy || null
        };

        // 6. Insertar pago
        const pagoCreado = await ordenPagoRepository.insertarPagoOrden(nuevoPago);

        return {
            pago: pagoCreado
        };
    }
}

module.exports = new OrdenPagoService();
