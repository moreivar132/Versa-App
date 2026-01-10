const express = require('express');
const router = express.Router();
const ordenPagoService = require('../services/ordenPagoService');
const ordenPagoRepository = require('../repositories/ordenPagoRepository');
const verifyJWT = require('../middleware/auth');
const pool = require('../db');

// Helper: Obtener caja abierta para una sucursal
async function getCajaAbierta(idSucursal) {
    if (!idSucursal) return null;
    const result = await pool.query(
        `SELECT id FROM caja WHERE id_sucursal = $1 AND estado = 'ABIERTA' ORDER BY created_at DESC LIMIT 1`,
        [idSucursal]
    );
    if (result.rows.length > 0) return result.rows[0].id;

    // Crear caja si no existe
    const insertResult = await pool.query(
        `INSERT INTO caja (id_sucursal, nombre, estado, created_at, updated_at)
         VALUES ($1, 'Caja Principal', 'ABIERTA', NOW(), NOW()) RETURNING id`,
        [idSucursal]
    );
    return insertResult.rows[0].id;
}

// Helper: Obtener sucursal de una orden
async function getSucursalOrden(idOrden) {
    const result = await pool.query('SELECT id_sucursal FROM orden WHERE id = $1', [idOrden]);
    return result.rows[0]?.id_sucursal || null;
}

// POST /api/ordenpago - Registrar un nuevo pago
router.post('/', verifyJWT, async (req, res) => {
    try {
        const { idOrden, idMedioPago, importe, referencia, idCaja } = req.body;
        const userId = req.user?.id;

        if (!idOrden || !idMedioPago || !importe) {
            return res.status(400).json({
                success: false,
                mensaje: 'Faltan campos requeridos: idOrden, idMedioPago, importe'
            });
        }

        // SIEMPRE resolver id_caja desde la sucursal de la orden (ignorar idCaja del frontend)
        let cajaId = null;
        const sucursalOrden = await getSucursalOrden(idOrden);
        console.log('[ordenPago] Orden:', idOrden, '-> Sucursal:', sucursalOrden);

        if (sucursalOrden) {
            cajaId = await getCajaAbierta(sucursalOrden);
            console.log('[ordenPago] Caja obtenida:', cajaId);
        } else if (req.user.id_sucursal) {
            cajaId = await getCajaAbierta(req.user.id_sucursal);
            console.log('[ordenPago] Caja de usuario:', cajaId);
        }

        // Mapear a lo que espera el servicio
        const datosPago = {
            medioPago: idMedioPago,
            importe: importe,
            referencia: referencia || null,
            idCaja: cajaId,
            createdBy: userId
        };

        const resultado = await ordenPagoService.registrarPago(parseInt(idOrden), datosPago);

        res.status(201).json({
            success: true,
            ...resultado
        });
    } catch (error) {
        console.error('Error en ruta ordenpago:', error);
        const status = error.status || 500;
        const mensaje = error.message || 'Error interno del servidor';
        res.status(status).json({ success: false, mensaje });
    }
});

// GET /api/ordenpago/orden/:idOrden - Obtener pagos de una orden
router.get('/orden/:idOrden', verifyJWT, async (req, res) => {
    try {
        const { idOrden } = req.params;

        const pagos = await ordenPagoRepository.obtenerPagosPorOrden(parseInt(idOrden));

        res.json({ success: true, pagos });
    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// DELETE /api/ordenpago/:idPago - Eliminar un pago
router.delete('/:idPago', verifyJWT, async (req, res) => {
    try {
        const { idPago } = req.params;

        if (!idPago) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de pago requerido'
            });
        }

        const pagoEliminado = await ordenPagoRepository.eliminarPago(parseInt(idPago));

        if (!pagoEliminado) {
            return res.status(404).json({
                success: false,
                mensaje: 'Pago no encontrado'
            });
        }

        res.json({
            success: true,
            mensaje: 'Pago eliminado correctamente',
            pago: pagoEliminado
        });
    } catch (error) {
        console.error('Error eliminando pago:', error);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// GET /api/ordenpago/estadisticas/semanal - Obtener pagos por día de la semana actual
router.get('/estadisticas/semanal', verifyJWT, async (req, res) => {
    try {
        const { sucursal } = req.query; // Parámetro opcional de sucursal

        // Calcular inicio de la semana (lunes) en hora local
        const hoy = new Date();
        const diaSemana = hoy.getDay(); // 0 = domingo
        const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diasDesdeLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Formato YYYY-MM-DD para evitar problemas de timezone
        const fechaInicio = inicioSemana.toLocaleDateString('en-CA');

        // Consulta base con JOIN a orden para filtrar por sucursal
        let query;
        let params;

        if (sucursal && sucursal !== 'all') {
            // Filtrar por sucursal específica
            query = `
                SELECT 
                    EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid') as dia_semana,
                    COALESCE(SUM(op.importe), 0) as total_dia
                FROM ordenpago op
                JOIN orden o ON op.id_orden = o.id
                WHERE DATE(op.created_at AT TIME ZONE 'Europe/Madrid') >= $1::date
                  AND o.id_sucursal = $2
                GROUP BY EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid')
                ORDER BY dia_semana
            `;
            params = [fechaInicio, parseInt(sucursal)];
        } else {
            // Sin filtro de sucursal
            query = `
                SELECT 
                    EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid') as dia_semana,
                    COALESCE(SUM(op.importe), 0) as total_dia
                FROM ordenpago op
                WHERE DATE(op.created_at AT TIME ZONE 'Europe/Madrid') >= $1::date
                GROUP BY EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid')
                ORDER BY dia_semana
            `;
            params = [fechaInicio];
        }

        console.log('[estadisticas/semanal] Desde:', fechaInicio, 'Sucursal:', sucursal || 'todas');
        const result = await pool.query(query, params);

        // Inicializar array con 7 días (lunes=0 a domingo=6)
        const pagosPorDia = [0, 0, 0, 0, 0, 0, 0];

        result.rows.forEach(row => {
            const idx = parseInt(row.dia_semana) - 1;
            if (idx >= 0 && idx <= 6) {
                pagosPorDia[idx] = parseFloat(row.total_dia) || 0;
            }
        });

        const totalSemanal = pagosPorDia.reduce((a, b) => a + b, 0);

        res.json({
            success: true,
            pagosPorDia,
            totalSemanal,
            inicioSemana: inicioSemana.toISOString()
        });
    } catch (error) {
        console.error('[estadisticas/semanal] Error:', error.message);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// GET /api/ordenpago/estadisticas/ticket-medio - Ticket Medio Mensual
router.get('/estadisticas/ticket-medio', verifyJWT, async (req, res) => {
    try {
        const { sucursal } = req.query;

        // Calcular fechas del mes actual
        const hoy = new Date();
        const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        // Calcular fechas del mes anterior
        const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);

        // Nombres de meses para mostrar
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mesActualNombre = meses[hoy.getMonth()];
        const mesAnteriorNombre = meses[hoy.getMonth() - 1 < 0 ? 11 : hoy.getMonth() - 1];

        // Query base para ticket medio
        // Buscar órdenes con estado 'ENTREGADA' o 'CERRADA' (según la nomenclatura del sistema)
        // Usamos updated_at como fecha de cierre cuando el estado cambió a ENTREGADA
        const buildQuery = (fechaInicio, fechaFin, params, paramStart) => {
            let query = `
                SELECT 
                    COALESCE(SUM(o.total_neto), 0) as facturacion_total,
                    COUNT(o.id) as ordenes_cerradas
                FROM orden o
                JOIN estadoorden eo ON o.id_estado_orden = eo.id
                WHERE o.total_neto > 0
                  AND UPPER(eo.codigo) IN ('ENTREGADA', 'CERRADA', 'COMPLETADA', 'FINALIZADA')
                  AND o.updated_at >= $${paramStart}
                  AND o.updated_at <= $${paramStart + 1}
            `;
            params.push(fechaInicio.toISOString(), fechaFin.toISOString());

            if (sucursal && sucursal !== 'all') {
                query += ` AND o.id_sucursal = $${paramStart + 2}`;
                params.push(parseInt(sucursal));
            }

            return query;
        };

        // Consulta mes actual
        const paramsActual = [];
        const queryActual = buildQuery(inicioMesActual, finMesActual, paramsActual, 1);
        const resultActual = await pool.query(queryActual, paramsActual);

        // Consulta mes anterior
        const paramsAnterior = [];
        const queryAnterior = buildQuery(inicioMesAnterior, finMesAnterior, paramsAnterior, 1);
        const resultAnterior = await pool.query(queryAnterior, paramsAnterior);

        // Calcular ticket medio
        const datosActual = resultActual.rows[0];
        const datosAnterior = resultAnterior.rows[0];

        const facturacionActual = parseFloat(datosActual.facturacion_total) || 0;
        const ordenesActuales = parseInt(datosActual.ordenes_cerradas) || 0;
        const ticketMedioActual = ordenesActuales > 0 ? facturacionActual / ordenesActuales : 0;

        const facturacionAnterior = parseFloat(datosAnterior.facturacion_total) || 0;
        const ordenesAnteriores = parseInt(datosAnterior.ordenes_cerradas) || 0;
        const ticketMedioAnterior = ordenesAnteriores > 0 ? facturacionAnterior / ordenesAnteriores : 0;

        // Calcular variación porcentual
        let variacionPorcentaje = 0;
        if (ticketMedioAnterior > 0) {
            variacionPorcentaje = ((ticketMedioActual - ticketMedioAnterior) / ticketMedioAnterior) * 100;
        } else if (ticketMedioActual > 0) {
            variacionPorcentaje = 100; // Si antes era 0 y ahora hay algo, es +100%
        }

        console.log('[ticket-medio] Mes actual:', mesActualNombre,
            '| Órdenes:', ordenesActuales,
            '| Facturación:', facturacionActual.toFixed(2),
            '| Ticket:', ticketMedioActual.toFixed(2));

        res.json({
            success: true,
            mesActual: {
                nombre: mesActualNombre,
                año: hoy.getFullYear(),
                ticketMedio: ticketMedioActual,
                ordenesCerradas: ordenesActuales,
                facturacionTotal: facturacionActual
            },
            mesAnterior: {
                nombre: mesAnteriorNombre,
                ticketMedio: ticketMedioAnterior,
                ordenesCerradas: ordenesAnteriores,
                facturacionTotal: facturacionAnterior
            },
            variacion: {
                porcentaje: variacionPorcentaje,
                tendencia: variacionPorcentaje >= 0 ? 'up' : 'down'
            }
        });
    } catch (error) {
        console.error('[estadisticas/ticket-medio] Error:', error.message);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// GET /api/ordenpago/estadisticas/ticket-medio/historico - Histórico últimos 12 meses
router.get('/estadisticas/ticket-medio/historico', verifyJWT, async (req, res) => {
    try {
        const { sucursal, meses = 12 } = req.query;

        const hoy = new Date();
        const numMeses = Math.min(parseInt(meses) || 12, 24);

        // Generar todos los meses del período (de más antiguo a más reciente)
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const todosMeses = [];
        for (let i = numMeses - 1; i >= 0; i--) {
            const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            todosMeses.push({
                fecha: fecha,
                mesKey: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`,
                mesNombre: `${mesesNombres[fecha.getMonth()]} ${fecha.getFullYear()}`
            });
        }

        // Construir query para obtener datos agrupados por mes
        let query = `
            SELECT 
                DATE_TRUNC('month', o.updated_at) as mes,
                COALESCE(SUM(o.total_neto), 0) as facturacion_total,
                COUNT(o.id) as ordenes_cerradas
            FROM orden o
            JOIN estadoorden eo ON o.id_estado_orden = eo.id
            WHERE o.total_neto > 0
              AND UPPER(eo.codigo) IN ('ENTREGADA', 'CERRADA', 'COMPLETADA', 'FINALIZADA')
              AND o.updated_at >= $1
        `;

        const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - numMeses + 1, 1);
        const params = [fechaInicio.toISOString()];

        if (sucursal && sucursal !== 'all') {
            query += ` AND o.id_sucursal = $2`;
            params.push(parseInt(sucursal));
        }

        query += ` GROUP BY DATE_TRUNC('month', o.updated_at) ORDER BY mes ASC`;

        const result = await pool.query(query, params);

        // Crear un mapa con los datos existentes
        const datosMap = new Map();
        result.rows.forEach(row => {
            const fecha = new Date(row.mes);
            const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            datosMap.set(mesKey, {
                facturacion: parseFloat(row.facturacion_total) || 0,
                ordenes: parseInt(row.ordenes_cerradas) || 0
            });
        });

        // Generar histórico completo (todos los meses, con datos o sin ellos)
        const historico = todosMeses.map(m => {
            const datos = datosMap.get(m.mesKey) || { facturacion: 0, ordenes: 0 };
            const ticketMedio = datos.ordenes > 0 ? datos.facturacion / datos.ordenes : 0;

            return {
                mes: m.mesNombre,
                mesKey: m.mesKey,
                ordenesCerradas: datos.ordenes,
                facturacionTotal: datos.facturacion,
                ticketMedio: ticketMedio
            };
        });

        res.json({
            success: true,
            historico
        });
    } catch (error) {
        console.error('[estadisticas/ticket-medio/historico] Error:', error.message);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

module.exports = router;
