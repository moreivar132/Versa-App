const ordenPagoRepository = require('../repositories/ordenPagoRepository');

class OrdenPagoService {
    /**
     * Registra un pago para una orden específica.
     * @param {number} idOrden - ID de la orden
     * @param {object} datosPago - Datos del pago (medioPago, importe, referencia, idCaja, createdBy)
     * @returns {Promise<object>} - El registro de pago creado
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
        if (!medioPago) {
            throw { status: 400, message: 'El medio de pago es requerido.' };
        }

        // 2. Validar que la orden existe
        const ordenExiste = await ordenPagoRepository.existeOrden(idOrden);
        if (!ordenExiste) {
            throw { status: 400, message: `La orden con ID ${idOrden} no existe.` };
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
            importe: importe,
            referencia: referencia || null,
            id_caja: idCaja || null,
            created_by: createdBy || null
        };

        // 6. Insertar pago
        // Nota: No se requiere transacción compleja aquí ya que es una sola inserción
        // y no estamos tocando otras tablas como orden o inventario.
        const pagoCreado = await ordenPagoRepository.insertarPagoOrden(nuevoPago);

        return pagoCreado;
    }
}

module.exports = new OrdenPagoService();
