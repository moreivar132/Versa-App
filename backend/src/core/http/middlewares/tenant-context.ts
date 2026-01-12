import { AsyncLocalStorage } from 'node:async_hooks';

export interface UserContext {
    id: string;
    id_tenant: string;
    roles: string[];
    permissions: string[];
}

export interface RequestContext {
    requestId: string;
    user?: UserContext;
    tenantId?: string;
}

export const contextStorage = new AsyncLocalStorage<RequestContext>();

export const getContext = (): RequestContext => {
    return contextStorage.getStore() || { requestId: 'unknown' };
};

/**
 * Middleware para inicializar el contexto de la petición.
 */
export const tenantContextMiddleware = (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);

    const initialContext: RequestContext = {
        requestId: requestId as string
    };

    contextStorage.run(initialContext, () => {
        // El tenantId suele venir del usuario autenticado o de un header en casos específicos
        const tenantId = req.headers['x-tenant-id'];
        if (tenantId) {
            const store = contextStorage.getStore();
            if (store) store.tenantId = tenantId as string;
        }

        next();
    });
};
