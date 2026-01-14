/**
 * Ventas Controller
 * Maneja requests HTTP y delega lógica al service.
 * NO hay lógica de negocio ni SQL aquí.
 */

const ventasService = require('../application/ventas.service');
const ventaPDFService = require('../../../../services/ventaPDFService');
const { ValidationError } = require('../../../core/http/middlewares/error-handler');

/**
 * Construye contexto desde request
 * @param {Object} req - Express request
 * @returns {Object} ctx
 */
function buildContext(req) {
    return {
        tenantId: req.context?.tenantId || req.user?.id_tenant,
        userId: req.context?.userId || req.user?.id,
        requestId: req.requestId || req.context?.requestId
    };
}

/**
 * POST /api/ventas - Crear nueva venta
 */
async function create(req, res, next) {
    try {
        const ctx = buildContext(req);
        const result = await ventasService.createVenta(req.body, ctx);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/ventas - Listar ventas con filtros
 */
async function list(req, res, next) {
    try {
        const ctx = buildContext(req);
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

        const result = await ventasService.getVentas(filtros, ctx);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/ventas/:id - Obtener venta por ID
 */
async function getById(req, res, next) {
    try {
        const ctx = buildContext(req);
        const result = await ventasService.getVentaById(req.params.id, ctx);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/ventas/:id/pdf - Generar documento HTML de venta
 */
async function getPdf(req, res, next) {
    try {
        const idVenta = parseInt(req.params.id);
        const tenantId = req.user?.id_tenant || req.context?.tenantId;

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
}

/**
 * POST /api/ventas/:id/anular - Anular venta
 */
async function anular(req, res, next) {
    try {
        const ctx = buildContext(req);
        const result = await ventasService.anularVenta(req.params.id, ctx);
        res.json(result);
    } catch (error) {
        console.error('Error al anular venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * PUT /api/ventas/:id - Actualizar venta
 */
async function update(req, res, next) {
    try {
        const ctx = buildContext(req);
        const result = await ventasService.updateVenta(req.params.id, req.body, ctx);
        res.json(result);
    } catch (error) {
        console.error('Error al actualizar venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/ventas/:id - Eliminar venta
 */
async function remove(req, res, next) {
    try {
        const ctx = buildContext(req);
        const result = await ventasService.deleteVenta(req.params.id, ctx);
        res.json(result);
    } catch (error) {
        console.error('Error al eliminar venta:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    create,
    list,
    getById,
    getPdf,
    anular,
    update,
    remove
};
