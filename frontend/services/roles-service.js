// ============================================================================
// ROLES SERVICE - Servicios para gestión de roles
// ============================================================================
// Consume los endpoints de /api/admin/roles

import apiClient from './api-client.js';

/**
 * Obtener todos los roles
 * Endpoint: GET /api/admin/roles
 * Response: Rol[] - Array de roles { id, nombre }
 */
export async function getRoles() {
    const response = await apiClient.get('/api/admin/roles');
    return response.data;
}

/**
 * Obtener permisos de un rol
 * Endpoint: GET /api/admin/roles/:id/permisos
 * NOTA: Este endpoint NO EXISTE aún en el backend
 * Retorna array vacío hasta que se implemente
 */
export async function getRolePermissions(roleId) {
    try {
        const response = await apiClient.get(`/api/admin/roles/${roleId}/permisos`);
        return response.data;
    } catch (error) {
        // Si el endpoint no existe (404), retornar array vacío
        if (error.response?.status === 404) {
            console.warn('Endpoint de permisos no implementado aún');
            return [];
        }
        throw error;
    }
}

/**
 * Asignar permisos a un rol
 * Endpoint: POST /api/admin/roles/:id/permisos
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function assignPermissionsToRole(roleId, permisoIds) {
    try {
        const response = await apiClient.post(`/api/admin/roles/${roleId}/permisos`, {
            permiso_ids: permisoIds
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Funcionalidad de permisos no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Crear un nuevo rol
 * Endpoint: POST /api/admin/roles
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function createRole(roleData) {
    try {
        const response = await apiClient.post('/api/admin/roles', roleData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Creación de roles no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Actualizar un rol
 * Endpoint: PUT /api/admin/roles/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function updateRole(roleId, roleData) {
    try {
        const response = await apiClient.put(`/api/admin/roles/${roleId}`, roleData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Edición de roles no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Eliminar un rol
 * Endpoint: DELETE /api/admin/roles/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function deleteRole(roleId) {
    try {
        const response = await apiClient.delete(`/api/admin/roles/${roleId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Eliminación de roles no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

export default {
    getRoles,
    getRolePermissions,
    assignPermissionsToRole,
    createRole,
    updateRole,
    deleteRole
};
