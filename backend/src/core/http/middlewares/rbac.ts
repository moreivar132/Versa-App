import { getContext } from './tenant-context';

/**
 * Middleware de RBAC (Role Based Access Control).
 * @param requiredPermissions Lista de permisos necesarios.
 */
export const rbacMiddleware = (requiredPermissions: string[]) => {
    return (req: any, res: any, next: any) => {
        const ctx = getContext();

        if (!ctx.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const hasPermission = requiredPermissions.every(p =>
            ctx.user?.permissions.includes(p) || ctx.user?.permissions.includes('*')
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }

        next();
    };
};
