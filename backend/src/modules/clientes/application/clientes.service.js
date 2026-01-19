/**
 * Clientes Service
 * 
 * Lógica de negocio para el módulo de clientes.
 */

const clientesRepo = require('../infra/clientes.repo');

/**
 * Crear un nuevo cliente
 * @param {Object} ctx - Contexto (tenantId, userId, requestId)
 * @param {Object} data - Datos del cliente
 */
async function crearCliente(ctx, data) {
    // Validar campos obligatorios
    if (!data.nombre || !data.documento || !data.telefono) {
        const error = new Error('Nombre, Documento y Teléfono son obligatorios.');
        error.statusCode = 400;
        throw error;
    }

    // Verificar duplicado
    const existente = await clientesRepo.findByDocumento(ctx, data.documento);
    if (existente) {
        const error = new Error('Ya existe un cliente con este documento en su organización.');
        error.statusCode = 400;
        throw error;
    }

    // Crear cliente
    return clientesRepo.create(ctx, data);
}

/**
 * Obtener últimos clientes
 */
async function obtenerUltimos(ctx, limit = 3) {
    return clientesRepo.findLatest(ctx, limit);
}

/**
 * Contar clientes del tenant
 */
async function contarClientes(ctx) {
    return clientesRepo.count(ctx);
}

/**
 * Actualizar cliente existente
 */
async function actualizarCliente(ctx, id, data) {
    // Validar campos obligatorios
    if (!data.nombre || !data.documento || !data.telefono) {
        const error = new Error('Nombre, Documento y Teléfono son obligatorios.');
        error.statusCode = 400;
        throw error;
    }

    // Verificar que existe y pertenece al tenant
    const cliente = await clientesRepo.findById(ctx, id);
    if (!cliente) {
        const error = new Error('Cliente no encontrado o no autorizado.');
        error.statusCode = 404;
        throw error;
    }

    return clientesRepo.update(ctx, id, data);
}

/**
 * Buscar clientes por término
 */
async function buscarClientes(ctx, query, limit = 10) {
    if (!query) {
        const error = new Error('Parámetro de búsqueda requerido');
        error.statusCode = 400;
        throw error;
    }

    return clientesRepo.search(ctx, query, limit);
}

/**
 * Obtener cliente por ID
 */
async function obtenerPorId(ctx, id) {
    const cliente = await clientesRepo.findById(ctx, id);
    if (!cliente) {
        const error = new Error('Cliente no encontrado');
        error.statusCode = 404;
        throw error;
    }
    return cliente;
}

module.exports = {
    crearCliente,
    obtenerUltimos,
    contarClientes,
    actualizarCliente,
    buscarClientes,
    obtenerPorId
};
