/**
 * Egresos Routes (FinSaaS)
 * Rutas para gestión de facturas de gasto con OCR/IA
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/egresos.controller');
const { authenticate } = require('../../../../../middleware/auth');
const { getTenantDb } = require('../../../../../src/core/db/tenant-db');

// Rutas protegidas (requieren autenticación)
router.use(authenticate);

// Inject Tenant DB
router.use((req, res, next) => {
    try {
        req.db = getTenantDb(req.user);
        next();
    } catch (err) {
        console.error('Error injecting Tenant DB:', err);
        res.status(500).json({ error: 'Database context error' });
    }
});

router.post('/egresos/intakes', controller.createIntake);
router.get('/egresos/intakes/:id', controller.getIntake);
router.post('/egresos', controller.createGasto);
router.get('/egresos', controller.listGastos);

// Callback de Make (sin auth normal, usa HMAC signature)
router.post('/intakes/:id/ocr-result', controller.ocrResultCallback);

module.exports = router;
