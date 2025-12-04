const express = require('express');
const router = express.Router();
const ordenPagoService = require('../services/ordenPagoService');
const ordenPagoRepository = require('../repositories/ordenPagoRepository');
const verifyJWT = require('../middleware/auth');

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

        // Mapear a lo que espera el servicio
        const datosPago = {
            medioPago: idMedioPago,  // El servicio espera 'medioPago'
            importe: importe,
            referencia: referencia || null,
            idCaja: idCaja || null,
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
