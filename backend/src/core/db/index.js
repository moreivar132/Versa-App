/**
 * Core Database Module
 * 
 * Punto de entrada para acceso a base de datos.
 * 
 * USO CORRECTO:
 * - Para queries con tenant: usar getTenantDb(ctx)
 * - Para transacciones: usar db.tx(async (trxDb) => { ... })
 * - Para jobs/migraciones: usar getSystemDb()
 * 
 * USO INCORRECTO (DEPRECADO):
 * - Acceso directo a pool.query() - migrar a getTenantDb
 * 
 * @see docs/TENANT_DB.md
 */

// Pool base (reutilizado del archivo existente)
const pool = require('../../../db');

// Wrapper TenantSafe
const { getTenantDb, getSystemDb, isSystemContext } = require('./tenant-db');

// ============================================================
// EXPORTS PRINCIPALES (usar estos)
// ============================================================

module.exports = {
    // Wrapper TenantSafe (RECOMENDADO)
    getTenantDb,
    getSystemDb,
    isSystemContext,

    // Pool crudo (DEPRECADO - solo para migración gradual)
    pool,

    // Helpers legacy (DEPRECADO - migrar a getTenantDb)
    /**
     * @deprecated Usar getTenantDb(ctx).query() en su lugar
     */
    query: (sql, params) => pool.query(sql, params),

    /**
     * @deprecated Usar getTenantDb(ctx).tx() en su lugar
     */
    async transaction(callback) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * @deprecated Usar getTenantDb(ctx).query() con tenantId explícito
     */
    async queryWithTenant(sql, params = [], tenantId) {
        if (!tenantId) {
            throw new Error('tenantId es requerido para queryWithTenant');
        }
        return pool.query(sql, [...params, tenantId]);
    }
};
