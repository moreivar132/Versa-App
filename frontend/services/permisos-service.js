// ============================================================================
// PERMISOS SERVICE - Servicios para gestión de permisos
// ============================================================================
// IMPORTANTE: La tabla 'permiso' EXISTE en la base de datos
// pero NO HAY endpoints implementados en el backend aún.
// Este servicio está preparado para cuando se implementen.

import apiClient from './api-client.js';

/**
 * Obtener todos los permisos
 * Endpoint: GET /api/admin/permisos
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function getPermisos() {
    try {
        const response = await apiClient.get('/api/admin/permisos');
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn('Endpoint de permisos no implementado aún');
            return [];
        }
        throw error;
    }
}

/**
 * Crear un nuevo permiso
 * Endpoint: POST /api/admin/permisos
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function createPermiso(permisoData) {
    try {
        const response = await apiClient.post('/api/admin/permisos', permisoData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Creación de permisos no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Actualizar un permiso
 * Endpoint: PUT /api/admin/permisos/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function updatePermiso(permisoId, permisoData) {
    try {
        const response = await apiClient.put(`/api/admin/permisos/${permisoId}`, permisoData);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Edición de permisos no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Eliminar un permiso
 * Endpoint: DELETE /api/admin/permisos/:id
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function deletePermiso(permisoId) {
    try {
        const response = await apiClient.delete(`/api/admin/permisos/${permisoId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Eliminación de permisos no disponible aún. Requiere implementación en backend.');
        }
        throw error;
    }
}

/**
 * Obtener permisos efectivos de un usuario (heredados de sus roles)
 * Endpoint: GET /api/admin/users/:id/permisos
 * NOTA: Este endpoint NO EXISTE aún en el backend
 */
export async function getUserPermissions(userId) {
    try {
        const response = await apiClient.get(`/api/admin/users/${userId}/permisos`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn('Endpoint de permisos de usuario no implementado aún');
            return [];
        }
        throw error;
    }
}

export default {
    getPermisos,
    createPermiso,
    updatePermiso,
    deletePermiso,
    getUserPermissions
};
