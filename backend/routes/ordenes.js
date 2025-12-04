const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const verifyJWT = require('../middleware/auth');

const ordenPagoController = require('../controllers/ordenPagoController');

router.post('/', verifyJWT, ordenesController.createOrden);
router.get('/', verifyJWT, ordenesController.getOrdenes);

// Ruta para pagos de órdenes
router.post('/:id/pagos', verifyJWT, ordenPagoController.crearPago);

module.exports = router;
