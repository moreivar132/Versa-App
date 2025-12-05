const express = require('express');
const router = express.Router();
const ordenPagoRepository = require('../repositories/ordenPagoRepository');
const verifyJWT = require('../middleware/auth');

// GET /api/medio-pago - Obtener todos los medios de pago
router.get('/', verifyJWT, async (req, res) => {
    try {
        const mediosPago = await ordenPagoRepository.obtenerTodosMediosPago();
        res.json(mediosPago);
    } catch (error) {
        console.error('Error obteniendo medios de pago:', error);
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

module.exports = router;
