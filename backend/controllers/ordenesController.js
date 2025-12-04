const ordenesService = require('../services/ordenesService');

class OrdenesController {
    async createOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };

            const result = await ordenesService.createOrden(req.body, userContext);
            res.status(201).json({ ok: true, ...result });
        } catch (error) {
            console.error('Error creando orden:', error);
            if (error.message.includes('Faltan campos') || error.message.includes('inválido') || error.message.includes('incluir')) {
                res.status(400).json({ ok: false, error: error.message });
            } else if (error.message.includes('no encontrado') || error.message.includes('no pertenece')) {
                res.status(404).json({ ok: false, error: error.message });
            } else {
                res.status(500).json({ ok: false, error: `Error interno al crear la orden: ${error.message}` });
            }
        }
    }

    async getOrdenes(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };

            // Filtros opcionales desde query params
            const filtros = {
                estado: req.query.estado,
                estadoPago: req.query.estadoPago,
                busqueda: req.query.busqueda,
                fechaDesde: req.query.fechaDesde,
                fechaHasta: req.query.fechaHasta,
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            };

            const result = await ordenesService.getOrdenes(filtros, userContext);
            res.status(200).json({ ok: true, ...result });
        } catch (error) {
            console.error('Error obteniendo órdenes:', error);
            res.status(500).json({ ok: false, error: `Error al obtener órdenes: ${error.message}` });
        }
    }
}

module.exports = new OrdenesController();
