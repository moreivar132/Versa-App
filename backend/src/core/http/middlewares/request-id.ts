/**
 * Middleware para asignar un Request ID único si no existe.
 * Útil para trazabilidad en logs distribuídos.
 */
export const requestIdMiddleware = (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
};
