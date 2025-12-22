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

            // ==========================================
            // CASO ESPECIAL: CUENTA CORRIENTE
            // ==========================================
            if (medioPagoEntidad.codigo === 'CUENTA_CORRIENTE') {
                // Obtener datos de orden y cliente (id_tenant viene de sucursal)
                const ordenData = await client.query(`
                    SELECT o.id_cliente, s.id_tenant, cf.documento, cf.nombre
                    FROM orden o
                    JOIN sucursal s ON o.id_sucursal = s.id
                    JOIN clientefinal cf ON o.id_cliente = cf.id
                    WHERE o.id = $1
                `, [idOrden]);

                if (ordenData.rows.length === 0) {
                    throw { status: 404, message: 'No se encontró la orden o el cliente.' };
                }

                const { id_cliente, id_tenant, documento, nombre } = ordenData.rows[0];

                // VALIDAR: Cliente debe tener documento
                if (!documento || documento.trim() === '') {
                    throw {
                        status: 400,
                        message: `El cliente "${nombre}" no tiene documento de identidad. Es obligatorio para usar cuenta corriente.`
                    };
                }

                // Obtener o crear cuenta corriente (con límite 100€)
                let cuenta = await client.query(`
                    SELECT id, saldo_actual, limite_credito FROM cuentacorriente
                    WHERE id_cliente = $1 AND id_tenant = $2
                `, [id_cliente, id_tenant]);

                let cuentaId, limiteCredito = 100, saldoActual = 0;

                if (cuenta.rows.length === 0) {
                    // Crear nueva cuenta con límite 100€
                    const nuevaCuenta = await client.query(`
                        INSERT INTO cuentacorriente (id_cliente, id_tenant, limite_credito, saldo_actual, created_by)
                        VALUES ($1, $2, 100, 0, $3) RETURNING id
                    `, [id_cliente, id_tenant, createdBy]);
                    cuentaId = nuevaCuenta.rows[0].id;
                } else {
                    cuentaId = cuenta.rows[0].id;
                    saldoActual = parseFloat(cuenta.rows[0].saldo_actual);
                    limiteCredito = parseFloat(cuenta.rows[0].limite_credito);
                }

                // VALIDAR: Límite de crédito
                const nuevoSaldo = saldoActual + importeNumerico;
                if (nuevoSaldo > limiteCredito) {
                    throw {
                        status: 400,
                        message: `Excede límite de crédito. Saldo actual: ${saldoActual.toFixed(2)}€, Límite: ${limiteCredito.toFixed(2)}€, Cargo: ${importeNumerico.toFixed(2)}€`
                    };
                }

                // Registrar CARGO en movimientocuenta
                await client.query(`
                    INSERT INTO movimientocuenta 
                    (id_cuenta_corriente, tipo_movimiento, importe, saldo_anterior, saldo_posterior, concepto, id_orden, fecha_movimiento, created_by)
                    VALUES ($1, 'CARGO', $2, $3, $4, $5, $6, current_date, $7)
                `, [cuentaId, importeNumerico, saldoActual, nuevoSaldo, `Orden #${idOrden}`, idOrden, createdBy]);

                // Marcar orden como cuenta corriente
                await client.query(`
                    UPDATE orden SET en_cuenta_corriente = true, id_cuenta_corriente = $1
                    WHERE id = $2
                `, [cuentaId, idOrden]);

                // También registrar en ordenpago para que cuente en el total pagado
                await client.query(`
                    INSERT INTO ordenpago (id_orden, id_medio_pago, importe, referencia, created_at, created_by)
                    VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [idOrden, medioPagoEntidad.id, importeNumerico, 'Cargo a cuenta corriente', createdBy]);

                await client.query('COMMIT');

                return {
                    pago: {
                        metodo: 'CUENTA_CORRIENTE',
                        importe: importeNumerico,
                        cargadoACuenta: true,
                        cuentaCorrienteId: cuentaId,
                        nuevoSaldo: nuevoSaldo
                    }
                };
            }
            // ==========================================
            // FIN CASO CUENTA CORRIENTE
            // ==========================================

            // 4. Resolver Caja (para otros métodos de pago)
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
