const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const verifyJWT = require('../middleware/auth');

const ordenPagoController = require('../controllers/ordenPagoController');

// Obtener lista de estados de orden disponibles
router.get('/estados', verifyJWT, ordenesController.getEstadosOrden);

router.post('/', verifyJWT, ordenesController.createOrden);
router.get('/', verifyJWT, ordenesController.getOrdenes);

// Obtener una orden específica con sus líneas y pagos
router.get('/:id', verifyJWT, ordenesController.getOrdenById);

// Actualizar una orden existente
router.put('/:id', verifyJWT, ordenesController.updateOrden);

// Cambio rápido de estado
router.patch('/:id/estado', verifyJWT, ordenesController.updateEstadoOrden);

// Ruta para pagos de órdenes
router.post('/:id/pagos', verifyJWT, ordenPagoController.crearPago);

module.exports = router;
