// ============================================================================
// API CLIENT - Cliente HTTP centralizado con interceptores
// ============================================================================
// Este archivo configura axios con interceptores para:
// - Añadir automáticamente el token JWT a todas las peticiones
// - Manejar errores 401 (sesión expirada -> redirigir a login)
// - Manejar errores 403 (sin permisos -> mostrar mensaje)
// - Logging de peticiones en desarrollo

import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
console.log('🔌 API Client conectando a:', API_BASE_URL);

// Crear instancia de Axios
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 segundos
});

// ============================================================================
// INTERCEPTOR DE REQUEST - Añadir token automáticamente
// ============================================================================
apiClient.interceptors.request.use(
    (config) => {
        // Obtener token del localStorage
        const sessionData = localStorage.getItem('versa_session_v1');
        if (sessionData) {
            try {
                const { token } = JSON.parse(sessionData);
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.warn('Error al parsear sesión:', error);
            }
        }

        // Log en desarrollo
        if (import.meta.env.DEV) {
            console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ============================================================================
// INTERCEPTOR DE RESPONSE - Manejar errores globalmente
// ============================================================================
apiClient.interceptors.response.use(
    (response) => {
        // Log en desarrollo
        if (import.meta.env.DEV) {
            console.log(`📥 ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
        }
        return response;
    },
    (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;

        // Log de error
        console.error(`❌ API Error [${status}]:`, message);

        // 401 - No autenticado -> Redirigir a login
        if (status === 401) {
            console.warn('Sesión expirada. Redirigiendo a login...');
            localStorage.removeItem('versa_session_v1');

            // Solo redirigir si no estamos ya en login
            if (!window.location.pathname.includes('login')) {
                window.location.href = '/login.html';
            }
        }

        // 403 - Sin permisos
        if (status === 403) {
            console.warn('Acceso denegado:', message);
            // El componente que hizo la llamada manejará el error
        }

        return Promise.reject(error);
    }
);

export default apiClient;
