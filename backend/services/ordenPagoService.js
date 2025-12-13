const ordenPagoRepository = require('../repositories/ordenPagoRepository');

class OrdenPagoService {
    /**
     * Registra un pago para una orden específica.
     * @param {number} idOrden - ID de la orden
     * @param {object} datosPago - Datos del pago (medioPago, importe, referencia, idCaja, createdBy)
     * @returns {Promise<object>} - El registro de pago creado y resumen actualizado
     */
    async registrarPago(idOrden, datosPago) {
        const ordenesRepository = require('../repositories/ordenesRepository');
        const pool = require('../db');
        const { medioPago, importe, referencia, idCaja, createdBy } = datosPago;

        // 1. Validar inputs básicos
        if (!idOrden) throw { status: 400, message: 'El ID de la orden es requerido.' };
        if (importe === undefined || importe === null || importe === '') throw { status: 400, message: 'El importe es requerido.' };

        const importeNumerico = parseFloat(importe);
        if (isNaN(importeNumerico) || importeNumerico <= 0) throw { status: 400, message: 'El importe debe ser un número mayor a 0.' };
        if (!medioPago) throw { status: 400, message: 'El medio de pago es requerido.' };

        // 2. Validar que la orden existe Y obtener sucursal
        const orden = await ordenPagoRepository.obtenerDatosOrden(idOrden);
        if (!orden) throw { status: 404, message: `La orden con ID ${idOrden} no existe.` };

        // 3. Resolver medio de pago
        const medioPagoEntidad = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(medioPago);
        if (!medioPagoEntidad) throw { status: 404, message: `El medio de pago '${medioPago}' no existe.` };

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 4. Resolver Caja
            let idCajaFinal = idCaja;
            if (idCajaFinal) {
                const cajaExiste = await ordenPagoRepository.existeCaja(idCajaFinal);
                if (!cajaExiste) throw { status: 400, message: `La caja con ID ${idCajaFinal} no existe.` };
            } else {
                // Auto-detectar caja abierta
                const cajaAbierta = await ordenesRepository.getOpenCaja(client, orden.id_sucursal);
                if (cajaAbierta) {
                    idCajaFinal = cajaAbierta.id;
                } else {
                    const nuevaCaja = await ordenesRepository.createOpenCaja(client, orden.id_sucursal, createdBy);
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
                created_by: createdBy || null
            };

            // 6. Insertar pago
            const pagoCreado = await ordenPagoRepository.insertarPagoOrden(nuevoPago, client);



            await client.query('COMMIT');
            return { pago: pagoCreado };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}


module.exports = new OrdenPagoService();
