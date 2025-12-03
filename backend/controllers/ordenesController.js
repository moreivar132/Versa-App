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
                res.status(500).json({ ok: false, error: 'Error interno al crear la orden' });
            }
        }
    }
}

module.exports = new OrdenesController();
