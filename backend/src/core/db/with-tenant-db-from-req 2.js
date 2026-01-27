/**
 * Utility to wrap legacy database calls with tenant context.
 * 
 * Permite inyectar el contexto de RLS en funciones que antes usaban pool.query
 * directamente, sin tener que refactorizar todo el SQL.
 */

const { getTenantDb } = require('./tenant-db');

/**
 * Ejecuta una función dentro de un contexto de base de datos con RLS.
 * 
 * @param {Object} req - Express request (debe tener req.ctx inicializado)
 * @param {Function} fn - Función async (db, ctx) => ...
 * @returns {Promise<any>}
 */
async function withTenantDbFromReq(req, fn) {
    if (!req.ctx || !req.ctx.tenantId) {
        throw new Error('Tenant context missing in request. Ensure tenantContextMiddleware is used.');
    }

    const db = getTenantDb(req.ctx);

    // Usamos txWithRLS incluso para queries simples en legacy
    // para garantizar que el SET LOCAL app.tenant_id se ejecute.
    return db.txWithRLS(async (trxDb) => {
        return fn(trxDb, req.ctx);
    });
}

module.exports = {
    withTenantDbFromReq
};
