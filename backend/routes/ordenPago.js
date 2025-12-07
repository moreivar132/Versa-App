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

module.exports = router;
