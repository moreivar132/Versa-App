// ============================================================================
// TENANTS SERVICE - Servicios para gestión de tenants
// ============================================================================
// Consume los endpoints de /api/admin/tenants

import apiClient from './api-client.js';

/**
 * Obtener todos los tenants
 * Endpoint: GET /api/admin/tenants
 * Response: Tenant[] - Array de tenants { id, nombre }
 */
export async function getTenants() {
    const response = await apiClient.get('/api/admin/tenants');
    return response.data;
}

/**
 * Obtener un tenant por ID
 * Endpoint: GET /api/admin/tenants/:id
 * NOTA: Este endpoint NO EXISTE aún, pero podría implementarse
 */
export async function getTenantById(tenantId) {
    try {
        const response = await apiClient.get(`/api/admin/tenants/${tenantId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            // Fallback: buscar en la lista de todos los tenants
            const tenants = await getTenants();
            return tenants.find(t => t.id === tenantId) || null;
        }
        throw error;
    }
}

/**
 * Crear un nuevo tenant
 * Endpoint: POST /api/admin/tenants
 * @param {Object} tenantData - Datos del tenant
 * @param {string} tenantData.nombre - Nombre del tenant
 */
export async function createTenant(tenantData) {
    const response = await apiClient.post('/api/admin/tenants', tenantData);
    return response.data;
}

/**
 * Actualizar un tenant
 * Endpoint: PUT /api/admin/tenants/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function updateTenant(tenantId, tenantData) {
    try {
        const response = await apiClient.put(`/api/admin/tenants/${tenantId}`, tenantData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Edición de tenants no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Eliminar un tenant
 * Endpoint: DELETE /api/admin/tenants/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function deleteTenant(tenantId) {
    try {
        const response = await apiClient.delete(`/api/admin/tenants/${tenantId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Eliminación de tenants no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

export default {
    getTenants,
    getTenantById,
    createTenant,
    updateTenant,
    deleteTenant
};
