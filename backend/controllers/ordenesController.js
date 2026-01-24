const ordenesService = require('../services/ordenesService');
const auditService = require('../src/core/logging/audit-service');
const { AUDIT_ACTIONS } = auditService;

class OrdenesController {
    async createOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id,
                is_super_admin: req.user?.is_super_admin || false
            };

            const result = await ordenesService.createOrden(req.body, userContext);

            // Audit Log
            auditService.register(req, AUDIT_ACTIONS.ORDEN_CREATE, {
                entityType: 'ORDEN',
                entityId: result.id,
                after: result
            });

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
                idMecanico: req.query.idMecanico ? parseInt(req.query.idMecanico) : null,
                idSucursal: req.query.idSucursal ? parseInt(req.query.idSucursal) : null,
                idCliente: req.query.idCliente ? parseInt(req.query.idCliente) : null,
                idVehiculo: req.query.idVehiculo ? parseInt(req.query.idVehiculo) : null,
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

    /**
     * Obtener una orden específica con sus líneas y pagos
     */
    async getOrdenById(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };
            const idOrden = parseInt(req.params.id);

            if (!idOrden || isNaN(idOrden)) {
                return res.status(400).json({ ok: false, error: 'ID de orden inválido' });
            }

            const result = await ordenesService.getOrdenById(idOrden, userContext);
            res.status(200).json({ ok: true, ...result });
        } catch (error) {
            console.error('Error obteniendo orden:', error);
            if (error.message.includes('no encontrada')) {
                res.status(404).json({ ok: false, error: error.message });
            } else {
                res.status(500).json({ ok: false, error: `Error al obtener la orden: ${error.message}` });
            }
        }
    }

    /**
     * Actualizar una orden existente (cabecera + líneas)
     */
    async updateOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };
            const idOrden = parseInt(req.params.id);

            if (!idOrden || isNaN(idOrden)) {
                return res.status(400).json({ ok: false, error: 'ID de orden inválido' });
            }

            // Get old data for audit before update
            const oldOrden = await ordenesService.getOrdenById(idOrden, userContext);
            const result = await ordenesService.updateOrden(idOrden, req.body, userContext);

            // Audit Log
            auditService.register(req, AUDIT_ACTIONS.ORDEN_UPDATE, {
                entityType: 'ORDEN',
                entityId: idOrden,
                before: oldOrden,
                after: result
            });

            res.status(200).json({ ok: true, ...result });
        } catch (error) {
            console.error('Error actualizando orden:', error);
            if (error.message.includes('no encontrada')) {
                res.status(404).json({ ok: false, error: error.message });
            } else if (error.message.includes('Faltan campos') || error.message.includes('inválido')) {
                res.status(400).json({ ok: false, error: error.message });
            } else {
                res.status(500).json({ ok: false, error: `Error al actualizar la orden: ${error.message}` });
            }
        }
    }

    /**
     * Cambio rápido de estado de una orden
     */
    async updateEstadoOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };
            const idOrden = parseInt(req.params.id);
            const { idEstadoOrden, codigoEstado } = req.body;

            if (!idOrden || isNaN(idOrden)) {
                return res.status(400).json({ ok: false, error: 'ID de orden inválido' });
            }

            if (!idEstadoOrden && !codigoEstado) {
                return res.status(400).json({ ok: false, error: 'Debe proporcionar idEstadoOrden o codigoEstado' });
            }

            // Get old data for audit
            const oldOrden = await ordenesService.getOrdenById(idOrden, userContext);
            const result = await ordenesService.updateEstadoOrden(idOrden, { idEstadoOrden, codigoEstado }, userContext);

            // Audit Log
            auditService.register(req, AUDIT_ACTIONS.ORDEN_STATUS_CHANGE, {
                entityType: 'ORDEN',
                entityId: idOrden,
                before: { estado: oldOrden.id_estado_orden || oldOrden.estado_codigo },
                after: { estado: idEstadoOrden || codigoEstado, result }
            });

            res.status(200).json({ ok: true, ...result });
        } catch (error) {
            console.error('Error actualizando estado de orden:', error);
            if (error.message.includes('no encontrada') || error.message.includes('no encontrado')) {
                res.status(404).json({ ok: false, error: error.message });
            } else {
                res.status(500).json({ ok: false, error: `Error al actualizar el estado: ${error.message}` });
            }
        }
    }

    /**
     * Obtener lista de estados de orden disponibles
     */
    async getEstadosOrden(req, res) {
        try {
            const userContext = {
                id_tenant: req.user?.id_tenant,
                id_usuario: req.user?.id
            };
            const result = await ordenesService.getEstadosOrden(userContext);
            res.status(200).json({ ok: true, estados: result });
        } catch (error) {
            console.error('Error obteniendo estados de orden:', error);
            res.status(500).json({ ok: false, error: `Error al obtener estados: ${error.message}` });
        }
    }
}

module.exports = new OrdenesController();
