/**
 * Clientes Controller
 * 
 * Controladores HTTP para el módulo de clientes.
 * Maneja req/res y delega a services.
 */

const clientesService = require('../application/clientes.service');
const logger = require('../../../core/logging/logger');

/**
 * POST /api/clientes - Crear cliente
 */
async function crearCliente(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const cliente = await clientesService.crearCliente(ctx, req.body);

        logger.info({ requestId: ctx.requestId, clienteId: cliente.id }, 'Cliente creado');

        res.status(201).json({
            ok: true,
            message: 'Cliente creado exitosamente',
            cliente
        });
    } catch (error) {
        logger.error({ error: error.message, requestId: req.requestId }, 'Error al crear cliente');
        res.status(error.statusCode || 500).json({
            ok: false,
            error: error.message || 'Error interno del servidor al crear el cliente.'
        });
    }
}

/**
 * GET /api/clientes - Listar últimos clientes
 */
async function listarClientes(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const clientes = await clientesService.obtenerUltimos(ctx, 3);
        res.json(clientes);
    } catch (error) {
        logger.error({ error: error.message }, 'Error al obtener clientes');
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
}

/**
 * GET /api/clientes/count - Contar clientes
 */
async function contarClientes(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const count = await clientesService.contarClientes(ctx);
        res.json({ count });
    } catch (error) {
        logger.error({ error: error.message }, 'Error al contar clientes');
        res.status(500).json({ error: 'Error al contar clientes' });
    }
}

/**
 * PUT /api/clientes/:id - Actualizar cliente
 */
async function actualizarCliente(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const cliente = await clientesService.actualizarCliente(ctx, req.params.id, req.body);

        res.json({
            ok: true,
            message: 'Cliente actualizado exitosamente',
            cliente
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error al actualizar cliente');
        res.status(error.statusCode || 500).json({
            ok: false,
            error: error.message || 'Error interno del servidor al actualizar el cliente.'
        });
    }
}

/**
 * GET /api/clientes/search - Buscar clientes
 */
async function buscarClientes(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const clientes = await clientesService.buscarClientes(ctx, req.query.q);
        res.json(clientes);
    } catch (error) {
        logger.error({ error: error.message }, 'Error en búsqueda de clientes');
        res.status(error.statusCode || 500).json({ error: error.message || 'Error al buscar clientes' });
    }
}

/**
 * GET /api/clientes/:id - Obtener cliente por ID
 */
async function obtenerCliente(req, res) {
    try {
        const ctx = {
            tenantId: req.context?.tenantId || req.user?.id_tenant,
            userId: req.user?.id,
            requestId: req.requestId,
            isSuperAdmin: req.user?.is_super_admin
        };

        const cliente = await clientesService.obtenerPorId(ctx, req.params.id);
        res.json(cliente);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
}

module.exports = {
    crearCliente,
    listarClientes,
    contarClientes,
    actualizarCliente,
    buscarClientes,
    obtenerCliente
};
