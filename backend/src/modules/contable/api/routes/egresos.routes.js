/**
 * Egresos Routes (FinSaaS)
 * Rutas para gestión de facturas de gasto con OCR/IA
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/egresos.controller');
const { authenticate } = require('../../../../../middleware/auth');

// Rutas protegidas (requieren autenticación)
router.post('/egresos/intakes', authenticate, controller.createIntake);
router.get('/egresos/intakes/:id', authenticate, controller.getIntake);
router.post('/egresos', authenticate, controller.createGasto);
router.get('/egresos', authenticate, controller.listGastos);

// Callback de Make (sin auth normal, usa HMAC signature)
router.post('/intakes/:id/ocr-result', controller.ocrResultCallback);

module.exports = router;
