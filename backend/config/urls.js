/**
 * VERSA - URL Configuration
 * Centraliza la configuración de URLs de la aplicación
 * 
 * Railway provee RAILWAY_PUBLIC_DOMAIN automáticamente
 * También puedes configurar APP_URL manualmente en las variables de entorno
 */

// Determinar la URL base de la aplicación
function getAppUrl() {
    // 1. Variable explícita tiene prioridad
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/$/, ''); // Quitar trailing slash
    }

    // 2. Railway provee el dominio automáticamente
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }

    // 3. Variables legacy para compatibilidad
    if (process.env.PUBLIC_BASE_URL) {
        return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
    }

    if (process.env.FRONTEND_BASE_URL) {
        return process.env.FRONTEND_BASE_URL.replace(/\/$/, '');
    }

    if (process.env.APP_PUBLIC_BASE_URL) {
        return process.env.APP_PUBLIC_BASE_URL.replace(/\/$/, '');
    }

    // 4. Fallback para desarrollo local
    return 'http://localhost:5173';
}

const APP_URL = getAppUrl();

module.exports = {
    APP_URL,
    getAppUrl
};
