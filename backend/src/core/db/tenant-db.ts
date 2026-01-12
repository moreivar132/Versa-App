import { getContext } from '../http/middlewares/tenant-context';

/**
 * Utilidades para aislamiento de datos (Tenant Isolation).
 */

/**
 * Inyecta automáticamente el filtro de tenantId en una consulta.
 * @param queryBuilder Instancia de Knex query builder.
 */
export const withTenant = (queryBuilder: any) => {
    const ctx = getContext();

    if (!ctx.tenantId) {
        throw new Error('No se pudo determinar el tenantId en el contexto de la petición.');
    }

    return queryBuilder.where('id_tenant', ctx.tenantId);
};

/**
 * Ejecuta una operación asegurando que el tenant está presente.
 */
export const ensureTenant = <T>(fn: (tenantId: string) => T): T => {
    const ctx = getContext();
    if (!ctx.tenantId) {
        throw new Error('Operación prohibida: contexto de tenant no encontrado.');
    }
    return fn(ctx.tenantId);
};
