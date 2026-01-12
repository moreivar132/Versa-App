import { getContext } from './tenant-context';

/**
 * Manejador global de errores. 
 * Centraliza la respuesta y loguea el error con contexto.
 */
export const errorHandlerMiddleware = (err: any, req: any, res: any, next: any) => {
    const ctx = getContext();

    const statusCode = err.status || err.statusCode || 500;
    const errorResponse = {
        error: {
            message: err.message || 'Error interno del servidor',
            code: err.code || 'INTERNAL_ERROR',
            requestId: ctx.requestId
        }
    };

    // En una app real, aquí usaríamos el logger centralizado
    console.error(`[Error][${ctx.requestId}] ${err.message}`, {
        stack: err.stack,
        tenantId: ctx.tenantId,
        userId: ctx.user?.id
    });

    res.status(statusCode).json(errorResponse);
};
