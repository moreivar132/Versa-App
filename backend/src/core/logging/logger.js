/**
 * Logger Service
 * Logger estructurado con soporte para requestId y contexto.
 * 
 * USO:
 *   const logger = require('./src/core/logging/logger');
 *   logger.info({ requestId, userId }, 'Mensaje');
 *   logger.error({ requestId, error: err.message }, 'Falló X');
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Formatea el log entry como JSON estructurado
 */
function formatLog(level, context, message) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
    };
    return JSON.stringify(entry);
}

/**
 * Logger principal
 */
const logger = {
    debug(context, message) {
        if (currentLevel <= LOG_LEVELS.debug) {
            console.debug(formatLog('debug', typeof context === 'string' ? { message: context } : context, message));
        }
    },

    info(context, message) {
        if (currentLevel <= LOG_LEVELS.info) {
            console.info(formatLog('info', typeof context === 'string' ? { message: context } : context, message));
        }
    },

    warn(context, message) {
        if (currentLevel <= LOG_LEVELS.warn) {
            console.warn(formatLog('warn', typeof context === 'string' ? { message: context } : context, message));
        }
    },

    error(context, message) {
        if (currentLevel <= LOG_LEVELS.error) {
            console.error(formatLog('error', typeof context === 'string' ? { message: context } : context, message));
        }
    },

    /**
     * Crea un child logger con contexto pre-fijado
     * @param {Object} baseContext - Contexto base (ej: { requestId, userId })
     */
    child(baseContext) {
        return {
            debug: (ctx, msg) => logger.debug({ ...baseContext, ...ctx }, msg),
            info: (ctx, msg) => logger.info({ ...baseContext, ...ctx }, msg),
            warn: (ctx, msg) => logger.warn({ ...baseContext, ...ctx }, msg),
            error: (ctx, msg) => logger.error({ ...baseContext, ...ctx }, msg)
        };
    }
};

module.exports = logger;
