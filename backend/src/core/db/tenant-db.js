/**
 * TenantSafe Database Wrapper (RLS-Enabled)
 * 
 * Proporciona acceso a base de datos con aislamiento de tenant OBLIGATORIO.
 * Toda query multi-tenant DEBE pasar por este wrapper.
 * 
 * SEGURIDAD: Este wrapper ahora setea variables de sesión PostgreSQL
 * para que Row Level Security (RLS) funcione automáticamente.
 * 
 * @example
 * // En un repositorio:
 * const { getTenantDb } = require('../../../src/core/db/tenant-db');
 * 
 * async function getOrdenes(ctx) {
 *   const db = getTenantDb(ctx);
 *   // RLS se aplica automáticamente - pero mantén WHERE id_tenant por claridad
 *   return db.query('SELECT * FROM ordenes WHERE id_tenant = $1', [db.tenantId]);
 * }
 * 
 * @see docs/RLS_PLAN.md para guía de seguridad
 * @see docs/TENANT_DB.md para guía de uso
 */

const pool = require('../../../db');
const { ForbiddenError } = require('../http/middlewares/error-handler');
const logger = require('../logging/logger');

const IS_DEV = process.env.NODE_ENV !== 'production';

// Feature flag para habilitar/deshabilitar RLS
// En emergencia, cambiar a false para desactivar el SET LOCAL
const RLS_ENABLED = process.env.RLS_ENABLED !== 'false';

/**
 * @typedef {Object} TenantContext
 * @property {number|string} tenantId - ID del tenant (obligatorio para rutas privadas)
 * @property {number|string} [userId] - ID del usuario (para auditoría)
 * @property {string} [requestId] - ID de la request (para correlación de logs)
 * @property {boolean} [isSuperAdmin] - Si es super admin (bypass de tenant)
 * @property {string} [bypassReason] - Razón del bypass (para auditoría)
 */

/**
 * @typedef {Object} TenantDbOptions
 * @property {boolean} [allowNoTenant=false] - Permitir operaciones sin tenant (rutas públicas)
 * @property {boolean} [systemContext=false] - Contexto de sistema (jobs, migraciones)
 */

/**
 * @typedef {Object} TenantDb
 * @property {Function} query - Ejecuta query con RLS activo
 * @property {Function} queryRaw - Query sin RLS (solo para super admin o sistema)
 * @property {Function} tx - Ejecuta transacción con RLS
 * @property {Function} txWithRLS - Transacción con SET LOCAL explícito (recomendado)
 * @property {Function} assertTenant - Valida que tenantId existe
 * @property {number|string|null} tenantId - TenantId del contexto
 */

/**
 * Verifica si el contexto es de sistema (jobs, migraciones, super admin)
 * @param {TenantContext} ctx 
 * @returns {boolean}
 */
function isSystemContext(ctx) {
    return ctx?.isSuperAdmin === true || ctx?.systemContext === true;
}

/**
 * Setea las variables de sesión para RLS en el cliente/conexión dado.
 * DEBE llamarse al inicio de cada transacción o query crítica.
 * 
 * @param {import('pg').PoolClient} client - Cliente de conexión
 * @param {TenantContext} ctx - Contexto con tenantId y flags
 * @private
 */
async function setRLSContext(client, ctx) {
    if (!RLS_ENABLED) {
        return; // RLS deshabilitado via env var (emergencia)
    }

    const tenantId = ctx?.tenantId;
    const isSuperAdmin = ctx?.isSuperAdmin === true || ctx?.systemContext === true;

    if (isSuperAdmin) {
        // Super admin: bypass RLS
        await client.query("SELECT set_config('app.is_superadmin', 'true', true)");
        await client.query("SELECT set_config('app.tenant_id', '', true)");

        // Auditar el bypass
        logger.warn({
            requestId: ctx?.requestId,
            userId: ctx?.userId,
            action: 'SUPERADMIN_RLS_BYPASS',
            reason: ctx?.bypassReason || 'not_specified'
        }, 'Super-admin RLS bypass activated');
    } else if (tenantId) {
        // Usuario normal: setear tenant para RLS
        await client.query("SELECT set_config('app.is_superadmin', 'false', true)");
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [String(tenantId)]);
    } else {
        // Sin tenant y sin super admin - modo público (ej: login)
        await client.query("SELECT set_config('app.is_superadmin', 'false', true)");
        await client.query("SELECT set_config('app.tenant_id', '', true)");
    }
}

/**
 * Obtiene un wrapper de DB con aislamiento de tenant y soporte RLS.
 * 
 * @param {TenantContext} ctx - Contexto de la request (req.context)
 * @param {TenantDbOptions} [options={}] - Opciones de configuración
 * @returns {TenantDb}
 * @throws {ForbiddenError} Si falta tenantId y no está permitido
 */
function getTenantDb(ctx, options = {}) {
    const { allowNoTenant = false, systemContext = false } = options;
    const tenantId = ctx?.tenantId;
    const userId = ctx?.userId;
    const requestId = ctx?.requestId;
    const isSuperAdmin = ctx?.isSuperAdmin || systemContext;

    // Enforcement en DEV: fallar rápido si falta tenant en contexto privado
    if (IS_DEV && !tenantId && !allowNoTenant && !isSuperAdmin) {
        const errorMsg = `[TenantDb] ENFORCEMENT: tenantId no encontrado en contexto. ` +
            `Si esta es una ruta pública, usa getTenantDb(ctx, { allowNoTenant: true }). ` +
            `RequestId: ${requestId || 'unknown'}`;
        console.error(errorMsg);
        throw new ForbiddenError(errorMsg);
    }

    /**
     * Valida que tenantId esté presente
     * @throws {ForbiddenError}
     */
    function assertTenant() {
        if (!tenantId && !isSuperAdmin) {
            throw new ForbiddenError('Operación requiere contexto de tenant');
        }
    }

    /**
     * Ejecuta query simple con aislamiento de tenant.
     * Automáticamente setea el contexto RLS para esta consulta.
     * 
     * @param {string} sql - Query SQL
     * @param {Array} params - Parámetros
     * @returns {Promise<import('pg').QueryResult>}
     */
    async function query(sql, params = []) {
        if (!allowNoTenant) {
            assertTenant();
        }

        const client = await pool.connect();
        try {
            // Seteamos el contexto RLS para este cliente antes de la query
            await setRLSContext(client, ctx);
            return await client.query(sql, params);
        } finally {
            client.release();
        }
    }

    /**
     * Query sin validación de tenant - SOLO para super admin o contexto de sistema
     * @param {string} sql 
     * @param {Array} params 
     * @returns {Promise<import('pg').QueryResult>}
     */
    async function queryRaw(sql, params = []) {
        if (!isSuperAdmin && !allowNoTenant) {
            throw new ForbiddenError('queryRaw solo permitido para super admin o contexto de sistema');
        }
        return pool.query(sql, params);
    }

    /**
     * Ejecuta una transacción CON SET LOCAL para RLS.
     * Este es el método RECOMENDADO para operaciones de escritura.
     * 
     * @param {Function} callback - Función async que recibe el trxDb
     * @returns {Promise<any>}
     * 
     * @example
     * await db.txWithRLS(async (trxDb) => {
     *   await trxDb.query('INSERT INTO ordenes ...', [...]);
     *   await trxDb.query('UPDATE inventario ...', [...]);
     * });
     */
    async function txWithRLS(callback) {
        if (!allowNoTenant) {
            assertTenant();
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // CRÍTICO: Setear contexto RLS al inicio de la transacción
            await setRLSContext(client, ctx);

            // Crear wrapper del client
            const trxDb = {
                tenantId,
                userId,
                requestId,

                async query(sql, params = []) {
                    if (IS_DEV) {
                        console.debug(`[TenantDb:TX+RLS] Query | tenant=${tenantId}`);
                    }
                    return client.query(sql, params);
                },

                async queryRaw(sql, params = []) {
                    if (!isSuperAdmin) {
                        throw new ForbiddenError('queryRaw en TX solo para super admin');
                    }
                    return client.query(sql, params);
                },

                assertTenant
            };

            const result = await callback(trxDb);
            await client.query('COMMIT');
            return result;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * LEGACY: Transacción sin SET LOCAL explícito.
     * Mantenido para compatibilidad - usar txWithRLS() para nuevas implementaciones.
     * 
     * @deprecated Usar txWithRLS() en su lugar
     * @param {Function} callback
     * @returns {Promise<any>}
     */
    async function tx(callback) {
        // Ahora tx() también usa RLS para no romper seguridad
        return txWithRLS(callback);
    }

    return {
        tenantId,
        userId,
        requestId,
        query,
        queryRaw,
        tx,
        txWithRLS,
        withTenantTx: txWithRLS, // Alias solicitado en CRIT-FIX-02
        assertTenant
    };
}

/**
 * Wrapper para operaciones de sistema (jobs, migraciones, seeds).
 * NO usar en routes/controllers - solo en scripts internos.
 * 
 * @param {Object} [options] - Opciones
 * @param {string} [options.source='system'] - Identificador del origen
 * @param {string} [options.reason] - Razón del bypass para auditoría
 * @returns {TenantDb}
 */
function getSystemDb(options = {}) {
    const { source = 'system', reason = 'system_job' } = options;

    logger.warn({
        source,
        reason,
        action: 'GET_SYSTEM_DB'
    }, 'getSystemDb llamado - bypass de tenant activado');

    return getTenantDb(
        {
            isSuperAdmin: true,
            systemContext: true,
            requestId: `system-${Date.now()}`,
            bypassReason: reason
        },
        { systemContext: true }
    );
}

/**
 * Query única con RLS seteado (sin transacción completa).
 * Útil para operaciones de lectura que necesitan RLS seguro.
 * 
 * @param {TenantContext} ctx - Contexto
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros
 * @returns {Promise<import('pg').QueryResult>}
 */
async function queryWithRLS(ctx, sql, params = []) {
    const client = await pool.connect();

    try {
        await setRLSContext(client, ctx);
        return await client.query(sql, params);
    } finally {
        client.release();
    }
}

module.exports = {
    getTenantDb,
    getSystemDb,
    isSystemContext,
    queryWithRLS,
    setRLSContext, // Exportado para tests
    // Re-export pool para migración gradual (DEPRECAR en futuro)
    pool,
    // Feature flag
    RLS_ENABLED
};
