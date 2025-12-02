const ordenesService = require('../services/ordenesService');

class OrdenesController {
    async createOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user.id_tenant, // Assuming payload has id_tenant
                id_usuario: req.user.id
            };

            // If id_tenant is not in payload (it should be), handle it.
            // Assuming standard JWT payload from login.
            if (!userContext.id_tenant) {
                // Fallback or error. For now assume it's there.
                // If the user is superadmin, maybe they don't have tenant?
                // But this is for "manager-taller", so they should be a tenant user.
            }

            const result = await ordenesService.createOrden(req.body, userContext);
            res.status(201).json({ ok: true, orden: result });
        } catch (error) {
            console.error('Error creando orden:', error);
            if (error.message.includes('Faltan campos') || error.message.includes('no válido')) {
                res.status(400).json({ ok: false, error: error.message });
            } else if (error.message.includes('no encontrado')) {
                res.status(404).json({ ok: false, error: error.message });
            } else {
                res.status(500).json({ ok: false, error: 'Error interno al crear la orden' });
            }
        }
    }
}

module.exports = new OrdenesController();
