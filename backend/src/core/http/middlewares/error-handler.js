/**
 * Error Handler Middleware
 * Centraliza el manejo de errores y normaliza las respuestas.
 * 
 * INTEGRACIÓN FUTURA:
 * En index.js, añadir AL FINAL (después de todas las rutas):
 *   const { errorHandler, notFoundHandler } = require('./src/core/http/middlewares/error-handler');
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */

const logger = require('../../logging/logger');

/**
 * Clase base para errores de aplicación
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Errores comunes pre-definidos
 */
class NotFoundError extends AppError {
    constructor(resource = 'Recurso') {
        super(`${resource} no encontrado`, 404, 'NOT_FOUND');
    }
}

class ValidationError extends AppError {
    constructor(details) {
        super('Error de validación', 400, 'VALIDATION_ERROR', details);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'No autorizado') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Acceso denegado') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * Middleware para rutas no encontradas
 */
function notFoundHandler(req, res, next) {
    next(new NotFoundError(`Ruta ${req.method} ${req.path}`));
}

/**
 * Middleware central de manejo de errores
 */
function errorHandler(err, req, res, next) {
    // Log del error
    const requestId = req.requestId || 'no-request-id';

    if (err.isOperational) {
        logger.warn({
            requestId,
            error: err.message,
            code: err.code,
            path: req.path,
            method: req.method
        });
    } else {
        logger.error({
            requestId,
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method
        });
    }

    // Determinar status code
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    // Respuesta normalizada
    const response = {
        ok: false,
        error: err.message || 'Error interno del servidor',
        code,
        requestId
    };

    // Solo incluir details en desarrollo o si es un error operacional
    if (err.details) {
        response.details = err.details;
    }

    // En producción, no exponer detalles de errores internos
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        response.error = 'Error interno del servidor';
        delete response.details;
    }

    res.status(statusCode).json(response);
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    notFoundHandler,
    errorHandler
};
