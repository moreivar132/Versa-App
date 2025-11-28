// ============================================================================
// USERS SERVICE - Servicios para gestión de usuarios
// ============================================================================
// Consume los endpoints de /api/admin/users
// Todos los endpoints requieren autenticación y permisos de Super Admin

import apiClient from './api-client.js';

/**
 * Obtener todos los usuarios
 * Endpoint: GET /api/admin/users
 * Response: Usuario[] (con roles y sucursales enriquecidos)
 */
export async function getUsers() {
    const response = await apiClient.get('/api/admin/users');
    return response.data;
}

/**
 * Crear un nuevo usuario
 * Endpoint: POST /api/admin/users
 * @param {Object} userData - Datos del usuario
 * @param {string} userData.nombre - Nombre completo
 * @param {string} userData.email - Email único
 * @param {string} userData.password - Contraseña
 * @param {number} userData.id_tenant - ID del tenant
 * @param {boolean} userData.is_super_admin - Si es super admin
 * @param {number} userData.porcentaje_mano_obra - Porcentaje (0-1), default 0.5
 */
export async function createUser(userData) {
    const response = await apiClient.post('/api/admin/users', userData);
    return response.data;
}

/**
 * Actualizar un usuario existente
 * Endpoint: PUT /api/admin/users/:id
 * NOTA: No permite cambiar password (requiere endpoint separado)
 */
export async function updateUser(userId, userData) {
    const response = await apiClient.put(`/api/admin/users/${userId}`, userData);
    return response.data;
}

/**
 * Eliminar un usuario
 * Endpoint: DELETE /api/admin/users/:id
 */
export async function deleteUser(userId) {
    const response = await apiClient.delete(`/api/admin/users/${userId}`);
    return response.data;
}

/**
 * Asignar roles a un usuario
 * Endpoint: POST /api/admin/users/:id/roles
 * @param {number} userId - ID del usuario
 * @param {number[]} roleIds - Array de IDs de roles
 */
export async function assignRolesToUser(userId, roleIds) {
    const response = await apiClient.post(`/api/admin/users/${userId}/roles`, {
        role_ids: roleIds
    });
    return response.data;
}

/**
 * Asignar sucursales a un usuario
 * Endpoint: POST /api/admin/users/:id/sucursales
 * @param {number} userId - ID del usuario
 * @param {number[]} sucursalIds - Array de IDs de sucursales
 */
export async function assignSucursalesToUser(userId, sucursalIds) {
    const response = await apiClient.post(`/api/admin/users/${userId}/sucursales`, {
        sucursal_ids: sucursalIds
    });
    return response.data;
}

export default {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    assignRolesToUser,
    assignSucursalesToUser
};
