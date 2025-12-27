/**
 * VERSA - PASO 5: Portal Cliente
 * Servicio frontend para el portal cliente
 */

const API_BASE_URL = '';

// Key for localStorage
const TOKEN_KEY = 'versa_customer_token';
const CUSTOMER_KEY = 'versa_customer';

// =============================================
// TOKEN MANAGEMENT
// =============================================

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
}

export function getStoredCustomer() {
    const data = localStorage.getItem(CUSTOMER_KEY);
    return data ? JSON.parse(data) : null;
}

export function setStoredCustomer(customer) {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

export function isLoggedIn() {
    return !!getToken();
}

// =============================================
// API HELPERS
// =============================================

async function apiCall(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    let data;
    const text = await response.text();

    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error('Error parsing JSON response:', text.substring(0, 200));
        throw new Error(`Error del servidor: Respuesta inválida (${response.status})`);
    }

    if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && (data.code === 'TOKEN_EXPIRED' || data.error?.includes('jwt') || data.error?.includes('token'))) {
            console.warn('Token expired or invalid in apiCall');
            removeToken();
            // Don't redirect immediately if checking session to avoid loops, just throw
            // window.location.href = '/cliente-login.html?expired=1';
            throw new Error('Sesión expirada');
        }
        throw new Error(data.error || data.message || `Error en la solicitud (${response.status})`);
    }

    return data;
}

// =============================================
// AUTH API
// =============================================

/**
 * Registrar nuevo cliente
 */
export async function register(data) {
    const result = await apiCall('/api/cliente/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.ok && result.token) {
        setToken(result.token);
        setStoredCustomer(result.customer);
    }

    return result;
}

/**
 * Login de cliente
 */
export async function login(email, password) {
    const result = await apiCall('/api/cliente/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (result.ok && result.token) {
        setToken(result.token);
        setStoredCustomer(result.customer);
    }

    return result;
}

/**
 * Solicitar reset de password
 */
export async function forgotPassword(email) {
    return apiCall('/api/cliente/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
}

/**
 * Reset password con token
 */
export async function resetPassword(token, password, confirmPassword) {
    return apiCall('/api/cliente/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword })
    });
}

/**
 * Logout
 */
export function logout() {
    removeToken();
    window.location.href = '/cliente-login.html';
}

// =============================================
// PROFILE API
// =============================================

/**
 * Obtener perfil del cliente
 */
export async function getProfile() {
    return apiCall('/api/cliente/me');
}

/**
 * Actualizar perfil
 */
export async function updateProfile(data) {
    return apiCall('/api/cliente/me', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

// =============================================
// CITAS API
// =============================================

/**
 * Obtener citas del cliente
 * @param {string} scope - 'all', 'upcoming', 'past'
 */
export async function getCitas(scope = 'all') {
    return apiCall(`/api/cliente/citas?scope=${scope}`);
}

/**
 * Obtener disponibilidad para reprogramar
 */
export async function getDisponibilidadCita(idCita, fecha) {
    return apiCall(`/api/cliente/citas/${idCita}/disponibilidad?fecha=${fecha}`);
}

/**
 * Cancelar cita
 */
export async function cancelarCita(idCita) {
    return apiCall(`/api/cliente/citas/${idCita}/cancelar`, {
        method: 'POST'
    });
}

/**
 * Reprogramar cita
 */
export async function reprogramarCita(idCita, fecha, hora) {
    return apiCall(`/api/cliente/citas/${idCita}/reprogramar`, {
        method: 'POST',
        body: JSON.stringify({ fecha, hora })
    });
}

// =============================================
// RESEÑAS API
// =============================================

/**
 * Crear reseña
 * @param {number} idCita - ID de la cita
 * @param {number} puntuacion - Puntuación 1-5
 * @param {string} comentario - Comentario opcional
 * @param {string[]} fotos - Array de URLs de fotos
 */
export async function createResena(idCita, puntuacion, comentario, fotos = []) {
    return apiCall(`/api/cliente/citas/${idCita}/resena`, {
        method: 'POST',
        body: JSON.stringify({ puntuacion, comentario, fotos })
    });
}

/**
 * Obtener reseña de una cita
 */
export async function getResena(idCita) {
    return apiCall(`/api/cliente/citas/${idCita}/resena`);
}

/**
 * Actualizar reseña
 */
export async function updateResena(idCita, data) {
    return apiCall(`/api/cliente/citas/${idCita}/resena`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

/**
 * Eliminar reseña
 */
export async function deleteResena(idCita) {
    return apiCall(`/api/cliente/citas/${idCita}/resena`, {
        method: 'DELETE'
    });
}

// =============================================
// PAGOS API
// =============================================

/**
 * Obtener pagos del cliente
 */
export async function getPagos() {
    return apiCall('/api/cliente/pagos');
}

/**
 * Obtener todas las reseñas del cliente
 */
export async function getMisResenas() {
    return apiCall('/api/cliente/resenas');
}

// =============================================
// GUARD
// =============================================

/**
 * Check if user is authenticated, redirect if not
 */
export function requireAuth() {
    if (!isLoggedIn()) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/cliente-login.html?redirect=${encodeURIComponent(currentPath)}`;
        return false;
    }
    return true;
}

/**
 * Redirect if already logged in
 */
export function redirectIfLoggedIn(destination = '/cliente-dashboard.html') {
    if (isLoggedIn()) {
        window.location.href = destination;
        return true;
    }
    return false;
}

// =============================================
// PORTAL API (NUEVOS ENDPOINTS)
// =============================================

/**
 * Obtener datos del cliente + sus vehículos
 * GET /api/portal/me
 */
export async function getClienteConVehiculos() {
    return apiCall('/api/portal/me');
}

/**
 * Crear cita con validación completa
 * POST /api/portal/citas
 * 
 * @param {object} data - Datos de la cita
 * @param {number} data.id_sucursal - ID de la sucursal (obligatorio)
 * @param {string} data.fecha_hora - Fecha y hora ISO (obligatorio)
 * @param {number} data.id_servicio - ID del servicio (obligatorio)
 * @param {number} [data.id_vehiculo] - ID del vehículo existente (opcional)
 * @param {object} [data.vehiculo_data] - Datos para crear vehículo (obligatorio si no hay id_vehiculo)
 * @param {string} [data.notas] - Notas adicionales (opcional)
 */
export async function crearCitaPortal(data) {
    return apiCall('/api/portal/citas', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// =============================================
// NOTIFICACIONES
// =============================================

/**
 * Obtener notificaciones del cliente
 * GET /api/portal/notificaciones
 */
export async function getNotificaciones(soloNoLeidas = false, limit = 20) {
    return apiCall(`/api/portal/notificaciones?no_leidas=${soloNoLeidas}&limit=${limit}`);
}

/**
 * Contar notificaciones no leídas
 * GET /api/portal/notificaciones/count
 */
export async function contarNotificacionesNoLeidas() {
    return apiCall('/api/portal/notificaciones/count');
}

/**
 * Marcar notificación como leída
 * PUT /api/portal/notificaciones/:id
 */
export async function marcarNotificacionLeida(id) {
    return apiCall(`/api/portal/notificaciones/${id}`, {
        method: 'PUT'
    });
}

/**
 * Marcar todas las notificaciones como leídas
 * PUT /api/portal/notificaciones/marcar-todas
 */
export async function marcarTodasNotificacionesLeidas() {
    return apiCall('/api/portal/notificaciones/marcar-todas', {
        method: 'PUT'
    });
}
