/**
 * Module Service Template
 * Contiene la lógica de negocio del módulo.
 * 
 * RESPONSABILIDADES:
 * - Implementar reglas de negocio
 * - Orquestar llamadas a repositorios
 * - Manejar transacciones cuando sea necesario
 * - Emitir eventos (futuro)
 * - NO acceder directamente a la DB
 */

const repo = require('./module.repo');
const { NotFoundError, ForbiddenError } = require('../../core/http/middlewares/error-handler');
const logger = require('../../core/logging/logger');

/**
 * Listar recursos
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {number} params.limit
 * @param {number} params.offset
 * @param {Object} params.filters
 */
async function list({ tenantId, userId, limit, offset, filters }) {
    const [data, total] = await Promise.all([
        repo.findMany({ tenantId, limit, offset, filters }),
        repo.count({ tenantId, filters })
    ]);

    return { data, total };
}

/**
 * Obtener por ID
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {number} params.id
 */
async function getById({ tenantId, userId, id }) {
    const item = await repo.findById({ tenantId, id });

    if (!item) {
        throw new NotFoundError('Recurso');
    }

    return item;
}

/**
 * Crear
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {Object} params.data
 */
async function create({ tenantId, userId, data }) {
    // Aquí puedes añadir validaciones de negocio
    // Ejemplo: verificar que no exista duplicado

    const created = await repo.create({
        tenantId,
        data: {
            ...data,
            created_by: userId
        }
    });

    logger.info({ tenantId, userId, resourceId: created.id }, 'Recurso creado');

    return created;
}

/**
 * Actualizar
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {number} params.id
 * @param {Object} params.data
 */
async function update({ tenantId, userId, id, data }) {
    // Verificar que existe
    const existing = await repo.findById({ tenantId, id });
    if (!existing) {
        throw new NotFoundError('Recurso');
    }

    // Aquí puedes añadir validaciones de negocio
    // Ejemplo: verificar permisos específicos sobre el recurso

    const updated = await repo.update({
        tenantId,
        id,
        data: {
            ...data,
            updated_by: userId,
            updated_at: new Date()
        }
    });

    logger.info({ tenantId, userId, resourceId: id }, 'Recurso actualizado');

    return updated;
}

/**
 * Eliminar
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {number} params.id
 */
async function remove({ tenantId, userId, id }) {
    // Verificar que existe
    const existing = await repo.findById({ tenantId, id });
    if (!existing) {
        throw new NotFoundError('Recurso');
    }

    // Aquí puedes añadir validaciones de negocio
    // Ejemplo: verificar que no tenga dependencias

    await repo.delete({ tenantId, id });

    logger.info({ tenantId, userId, resourceId: id }, 'Recurso eliminado');

    return { id };
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove
};
