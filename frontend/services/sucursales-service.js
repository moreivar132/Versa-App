// ============================================================================
// SUCURSALES SERVICE - Servicios para gestión de sucursales
// ============================================================================
// Consume los endpoints de /api/admin/sucursales

import apiClient from './api-client.js';

/**
 * Obtener todas las sucursales
 * Endpoint: GET /api/admin/sucursales
 * Response: Sucursal[] - Array de sucursales { id, id_tenant, nombre }
 */
export async function getSucursales() {
    const response = await apiClient.get('/api/admin/sucursales');
    return response.data;
}

/**
 * Obtener sucursales filtradas por tenant
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<Sucursal[]>} Sucursales del tenant
 */
export async function getSucursalesByTenant(tenantId) {
    const allSucursales = await getSucursales();
    return allSucursales.filter(s => s.id_tenant === parseInt(tenantId));
}

/**
 * Crear una nueva sucursal
 * Endpoint: POST /api/admin/sucursales
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function createSucursal(sucursalData) {
    try {
        const response = await apiClient.post('/api/admin/sucursales', sucursalData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Creación de sucursales no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Actualizar una sucursal
 * Endpoint: PUT /api/admin/sucursales/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function updateSucursal(sucursalId, sucursalData) {
    try {
        const response = await apiClient.put(`/api/admin/sucursales/${sucursalId}`, sucursalData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Edición de sucursales no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Eliminar una sucursal
 * Endpoint: DELETE /api/admin/sucursales/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function deleteSucursal(sucursalId) {
    try {
        const response = await apiClient.delete(`/api/admin/sucursales/${sucursalId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Eliminación de sucursales no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

export default {
    getSucursales,
    getSucursalesByTenant,
    createSucursal,
    updateSucursal,
    deleteSucursal
};
