/**
 * Vehículos Controller
 */

const vehiculosService = require('../application/vehiculos.service');
const logger = require('../../../core/logging/logger');

/**
 * GET /api/vehiculos - Listar vehículos
 */
async function listarVehiculos(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const vehiculos = await vehiculosService.listarVehiculos(ctx, {
            idSucursal: req.query.idSucursal
        });
        res.json(vehiculos);
    } catch (error) {
        logger.error({ error: error.message }, 'Error al obtener vehículos');
        res.status(500).json({ error: 'Error al obtener vehículos' });
    }
}

/**
 * POST /api/vehiculos - Crear vehículo
 */
async function crearVehiculo(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const vehiculo = await vehiculosService.crearVehiculo(ctx, req.body);
        res.status(201).json(vehiculo);
    } catch (error) {
        logger.error({ error: error.message }, 'Error al crear vehículo');
        res.status(error.statusCode || 500).json({ error: error.message || 'Error al crear vehículo' });
    }
}

/**
 * PUT /api/vehiculos/:id - Actualizar vehículo
 */
async function actualizarVehiculo(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const vehiculo = await vehiculosService.actualizarVehiculo(ctx, req.params.id, req.body);
        res.json(vehiculo);
    } catch (error) {
        logger.error({ error: error.message }, 'Error al actualizar vehículo');
        res.status(error.statusCode || 500).json({ error: error.message || 'Error al actualizar vehículo' });
    }
}

/**
 * GET /api/vehiculos/search - Buscar vehículos
 */
async function buscarVehiculos(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const vehiculos = await vehiculosService.buscarVehiculos(ctx, {
            q: req.query.q,
            id_cliente: req.query.id_cliente
        });
        res.json(vehiculos);
    } catch (error) {
        logger.error({ error: error.message }, 'Error en búsqueda de vehículos');
        res.status(error.statusCode || 500).json({ error: error.message || 'Error al buscar vehículos' });
    }
}

/**
 * GET /api/vehiculos/:id - Obtener vehículo por ID
 */
async function obtenerVehiculo(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const vehiculo = await vehiculosService.obtenerPorId(ctx, req.params.id);
        res.json(vehiculo);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
}

module.exports = {
    listarVehiculos,
    crearVehiculo,
    actualizarVehiculo,
    buscarVehiculos,
    obtenerVehiculo
};
