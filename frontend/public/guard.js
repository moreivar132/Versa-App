/**
 * guard.js - Protección de autenticación para páginas del Manager
 * 
 * Este script se ejecuta inmediatamente al cargar cualquier página protegida.
 * Realiza una verificación de dos fases:
 * 1. Verificación rápida (síncrona): ¿Existe sesión en localStorage?
 * 2. Verificación completa (asíncrona): ¿El token es válido en el servidor?
 * 
 * Incluir al inicio del <head> de cada página protegida:
 * <script src="/guard.js"></script>
 */
(function () {
    'use strict';

    const SESSION_KEY = 'versa_session_v1';
    const LOGIN_PAGE = 'login.html';

    // Páginas públicas que no requieren autenticación
    const PUBLIC_PAGES = [
        'login.html',
        'cita-previa.html',
        'portal-cliente.html',
        'cliente-login.html'
    ];

    // Verificar si estamos en una página pública
    const currentPath = window.location.pathname;
    const isPublicPage = PUBLIC_PAGES.some(page => currentPath.includes(page));

    if (isPublicPage) {
        return; // No aplicar guard en páginas públicas
    }

    /**
     * Redirige al login limpiando la sesión
     */
    function redirectToLogin() {
        console.warn('⛔ Acceso denegado: Redirigiendo a login...');
        localStorage.removeItem(SESSION_KEY);
        window.location.replace(LOGIN_PAGE);
    }

    /**
     * Fase 1: Verificación síncrona rápida
     * Bloquea inmediatamente si no hay sesión en localStorage
     */
    function checkLocalSession() {
        const session = localStorage.getItem(SESSION_KEY);

        if (!session) {
            redirectToLogin();
            return null;
        }

        try {
            const parsed = JSON.parse(session);
            if (!parsed?.token) {
                throw new Error('Token no encontrado');
            }
            return parsed;
        } catch (error) {
            console.error('Sesión inválida:', error);
            redirectToLogin();
            return null;
        }
    }

    /**
     * Fase 2: Verificación asíncrona con el servidor
     * Valida que el token sea auténtico y no haya expirado
     */
    async function validateTokenWithServer(session) {
        try {
            // Determinar la URL del API
            const apiBaseUrl = window.VITE_API_URL || '';

            const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token inválido: ${response.status}`);
            }

            // Actualizar datos del usuario en la sesión
            const userData = await response.json();
            const updatedSession = {
                token: session.token,
                user: userData
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));

            // Emitir evento para que la página sepa que la autenticación está completa
            window.dispatchEvent(new CustomEvent('authValidated', {
                detail: { user: userData }
            }));

            return true;

        } catch (error) {
            console.error('Validación de token fallida:', error);
            redirectToLogin();
            return false;
        }
    }

    // Ejecutar Fase 1 inmediatamente (bloquea si no hay sesión)
    const session = checkLocalSession();

    if (session) {
        // Ejecutar Fase 2 en segundo plano (valida con servidor)
        validateTokenWithServer(session);
    }

    // Manejar logout global con delegación de eventos
    window.addEventListener('click', (event) => {
        const logoutLink = event.target.closest('[data-logout]') ||
            event.target.closest('#logoutBtn') ||
            event.target.closest('#btnLogout') ||
            event.target.closest('#logout-btn');

        if (logoutLink) {
            event.preventDefault();
            localStorage.removeItem(SESSION_KEY);
            window.location.replace(LOGIN_PAGE);
        }
    });

})();
