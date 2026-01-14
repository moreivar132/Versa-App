/**
 * Vehículos Service
 * 
 * Lógica de negocio para el módulo de vehículos.
 */

const vehiculosRepo = require('../infra/vehiculos.repo');

/**
 * Listar todos los vehículos del tenant
 */
async function listarVehiculos(ctx, options = {}) {
    return vehiculosRepo.findAll(ctx, options);
}

/**
 * Crear un nuevo vehículo
 */
async function crearVehiculo(ctx, data) {
    // Validaciones
    if (!data.id_sucursal || !data.matricula || !data.marca || !data.modelo) {
        const error = new Error('Sucursal, Matrícula, Marca y Modelo son obligatorios.');
        error.statusCode = 400;
        throw error;
    }

    return vehiculosRepo.create(ctx, data);
}

/**
 * Actualizar vehículo existente
 */
async function actualizarVehiculo(ctx, id, data) {
    const vehiculo = await vehiculosRepo.update(ctx, id, data);

    if (!vehiculo) {
        const error = new Error('Vehículo no encontrado');
        error.statusCode = 404;
        throw error;
    }

    return vehiculo;
}

/**
 * Buscar vehículos
 */
async function buscarVehiculos(ctx, options = {}) {
    const { q, id_cliente } = options;

    if (!q && !id_cliente) {
        const error = new Error('Parámetro de búsqueda requerido (q) o ID de cliente');
        error.statusCode = 400;
        throw error;
    }

    return vehiculosRepo.search(ctx, options);
}

/**
 * Obtener vehículo por ID
 */
async function obtenerPorId(ctx, id) {
    const vehiculo = await vehiculosRepo.findById(ctx, id);

    if (!vehiculo) {
        const error = new Error('Vehículo no encontrado');
        error.statusCode = 404;
        throw error;
    }

    return vehiculo;
}

module.exports = {
    listarVehiculos,
    crearVehiculo,
    actualizarVehiculo,
    buscarVehiculos,
    obtenerPorId
};
