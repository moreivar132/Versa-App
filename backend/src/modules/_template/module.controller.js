/**
 * Module Controller Template
 * Maneja las requests HTTP y delega la lógica al service.
 * 
 * RESPONSABILIDADES:
 * - Extraer datos del request (params, body, query)
 * - Validar input básico
 * - Llamar al service
 * - Formatear la respuesta
 * - NO contener lógica de negocio
 */

const service = require('./module.service');
const { validateId, validateRequired } = require('../../core/validation');
const logger = require('../../core/logging/logger');

/**
 * GET /
 * Listar recursos
 */
async function list(req, res, next) {
    try {
        const { id_tenant, id: userId } = req.user;
        const { limit = 50, offset = 0, ...filters } = req.query;

        const log = logger.child({ requestId: req.requestId, userId, action: 'list' });
        log.info({}, 'Listando recursos');

        const result = await service.list({
            tenantId: id_tenant,
            userId,
            limit: parseInt(limit),
            offset: parseInt(offset),
            filters
        });

        res.json({
            ok: true,
            data: result.data,
            total: result.total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /:id
 * Obtener por ID
 */
async function getById(req, res, next) {
    try {
        const { id_tenant, id: userId } = req.user;
        const id = validateId(req.params.id);

        const result = await service.getById({
            tenantId: id_tenant,
            userId,
            id
        });

        res.json({
            ok: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /
 * Crear
 */
async function create(req, res, next) {
    try {
        const { id_tenant, id: userId } = req.user;
        const data = req.body;

        // Validación básica (personalizar según el módulo)
        // validateRequired(data, ['nombre', 'campo_requerido']);

        const result = await service.create({
            tenantId: id_tenant,
            userId,
            data
        });

        res.status(201).json({
            ok: true,
            data: result,
            message: 'Recurso creado correctamente'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /:id
 * Actualizar
 */
async function update(req, res, next) {
    try {
        const { id_tenant, id: userId } = req.user;
        const id = validateId(req.params.id);
        const data = req.body;

        const result = await service.update({
            tenantId: id_tenant,
            userId,
            id,
            data
        });

        res.json({
            ok: true,
            data: result,
            message: 'Recurso actualizado correctamente'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * DELETE /:id
 * Eliminar
 */
async function remove(req, res, next) {
    try {
        const { id_tenant, id: userId } = req.user;
        const id = validateId(req.params.id);

        await service.remove({
            tenantId: id_tenant,
            userId,
            id
        });

        res.json({
            ok: true,
            message: 'Recurso eliminado correctamente'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove
};
