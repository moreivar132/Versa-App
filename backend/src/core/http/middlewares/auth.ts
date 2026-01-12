import { getContext } from './tenant-context';

/**
 * Middleware de Autenticación Base.
 * En una implementación real, verificaría el JWT y cargaría el usuario en el contexto.
 */
export const authMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        // Para el esqueleto, permitimos continuar o lanzamos 401
        // Dependiendo de la ruta, pero aquí solo preparamos la estructura
        return next();
    }

    // Simulación de decodificación de token y carga en contexto
    const ctx = getContext();
    ctx.user = {
        id: 'user_dev_123',
        id_tenant: req.headers['x-tenant-id'] || 'tenant_default',
        roles: ['admin'],
        permissions: ['*']
    };
    ctx.tenantId = ctx.user.id_tenant;

    next();
};
