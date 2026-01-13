/**
 * Request ID Middleware
 * Genera un ID único para cada request para trazabilidad en logs.
 * 
 * INTEGRACIÓN FUTURA:
 * En index.js, añadir ANTES de las rutas:
 *   const { requestIdMiddleware } = require('./src/core/http/middlewares/request-id');
 *   app.use(requestIdMiddleware);
 */

const crypto = require('crypto');

/**
 * Genera un request ID único
 * @returns {string} UUID v4
 */
function generateRequestId() {
    return crypto.randomUUID();
}

/**
 * Middleware que inyecta un requestId en cada request
 * Lo almacena en req.requestId, req.context.requestId y en el header X-Request-ID
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || generateRequestId();

    // Inicializar req.context si no existe
    if (!req.context) {
        req.context = {};
    }

    // Disponible en ambos lugares para compatibilidad
    req.requestId = requestId;
    req.context.requestId = requestId;

    res.setHeader('X-Request-ID', requestId);

    next();
}

module.exports = {
    requestIdMiddleware,
    generateRequestId
};
