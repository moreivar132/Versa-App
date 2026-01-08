const express = require('express');
const router = express.Router();
const ventasService = require('../services/ventasService');
const ventaPDFService = require('../services/ventaPDFService');
const verifyJWT = require('../middleware/auth');

/**
 * POST /api/ventas - Crear una nueva venta
 */
router.post('/', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant,
            id_usuario: req.user.id
        };

        const result = await ventasService.createVenta(req.body, userContext);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * GET /api/ventas - Obtener lista de ventas con filtros
 */
router.get('/', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant
        };

        const filtros = {
            idSucursal: req.query.idSucursal,
            idCliente: req.query.idCliente,
            fechaDesde: req.query.fechaDesde,
            fechaHasta: req.query.fechaHasta,
            estado: req.query.estado,
            busqueda: req.query.busqueda,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await ventasService.getVentas(filtros, userContext);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * GET /api/ventas/:id/pdf - Obtener documento HTML de la venta
 * IMPORTANTE: Esta ruta debe ir ANTES de /:id para evitar conflictos
 */
router.get('/:id/pdf', verifyJWT, async (req, res) => {
    try {
        const idVenta = parseInt(req.params.id);
        const tenantId = req.user.id_tenant;

        if (!idVenta || isNaN(idVenta)) {
            return res.status(400).json({ ok: false, error: 'ID de venta inválido' });
        }

        const html = await ventaPDFService.generarDocumentoVenta(idVenta, tenantId);

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="venta_${idVenta}.html"`);
        res.send(html);

    } catch (error) {
        console.error('Error generando documento de venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * GET /api/ventas/:id - Obtener una venta por ID
 */
router.get('/:id', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant
        };

        const result = await ventasService.getVentaById(req.params.id, userContext);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * POST /api/ventas/:id/anular - Anular una venta
 */
router.post('/:id/anular', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant,
            id_usuario: req.user.id
        };

        const result = await ventasService.anularVenta(req.params.id, userContext);
        res.json(result);
    } catch (error) {
        console.error('Error al anular venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * PUT /api/ventas/:id - Actualizar una venta existente
 */
router.put('/:id', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant,
            id_usuario: req.user.id
        };

        const result = await ventasService.updateVenta(req.params.id, req.body, userContext);
        res.json(result);
    } catch (error) {
        console.error('Error al actualizar venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * DELETE /api/ventas/:id - Eliminar una venta
 */
router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        const userContext = {
            id_tenant: req.user.id_tenant,
            id_usuario: req.user.id
        };

        const result = await ventasService.deleteVenta(req.params.id, userContext);
        res.json(result);
    } catch (error) {
        console.error('Error al eliminar venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
