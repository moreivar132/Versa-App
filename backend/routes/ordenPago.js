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

// GET /api/ordenpago/estadisticas/semanal - Obtener pagos por día de la semana actual
router.get('/estadisticas/semanal', verifyJWT, async (req, res) => {
    try {

        // Calcular inicio de la semana (lunes) en hora local
        const hoy = new Date();
        const diaSemana = hoy.getDay(); // 0 = domingo
        const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diasDesdeLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Formato YYYY-MM-DD para evitar problemas de timezone
        const fechaInicio = inicioSemana.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD

        // Consulta que usa DATE para comparar solo la parte de fecha
        const query = `
            SELECT 
                EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid') as dia_semana,
                COALESCE(SUM(op.importe), 0) as total_dia
            FROM ordenpago op
            WHERE DATE(op.created_at AT TIME ZONE 'Europe/Madrid') >= $1::date
            GROUP BY EXTRACT(ISODOW FROM op.created_at AT TIME ZONE 'Europe/Madrid')
            ORDER BY dia_semana
        `;

        console.log('[estadisticas/semanal] Desde:', fechaInicio);
        const result = await pool.query(query, [fechaInicio]);
        console.log('[estadisticas/semanal] Resultado:', result.rows);

        // Inicializar array con 7 días (lunes=0 a domingo=6)
        const pagosPorDia = [0, 0, 0, 0, 0, 0, 0];

        result.rows.forEach(row => {
            // ISODOW: 1=lunes, 7=domingo -> convertir a índice 0-6
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
        console.error('[estadisticas/semanal] Error:', error.message, error.stack);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

module.exports = router;
