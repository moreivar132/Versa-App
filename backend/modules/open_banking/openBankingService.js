/**
 * Open Banking Service - Lógica de negocio
 * 
 * Gestiona conexiones, sincronización y consultas de datos bancarios
 */
const { getTenantDb } = require('../../src/core/db/tenant-db');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./cryptoUtils');
const trueLayerProvider = require('./trueLayerProvider');

// Cache en memoria para estados OAuth pendientes (en producción usar Redis)
const pendingOAuthStates = new Map();
const OAUTH_STATE_TTL = 15 * 60 * 1000; // 15 minutos

// ================================================================
// GESTIÓN DE CONEXIONES
// ================================================================

/**
 * Inicia el flujo OAuth generando URL de autorización
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.userId
 * @param {string} params.redirectPath - Path relativo tras callback
 * @returns {Object} { url, state }
 */
function initiateOAuthFlow({ tenantId, userId, redirectPath = '/manager-taller-banking.html' }) {
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

    if (!redirectUri) {
        throw new Error('TRUELAYER_REDIRECT_URI no configurado');
    }

    // Guardar estado pendiente
    pendingOAuthStates.set(state, {
        tenantId,
        userId,
        redirectPath,
        createdAt: Date.now()
    });

    // Limpiar estados viejos
    cleanupOldStates();

    const url = trueLayerProvider.buildAuthLink({
        state,
        redirectUri,
        scopes: ['info', 'accounts', 'transactions', 'balance', 'offline_access']
    });

    return { url, state };
}

/**
 * Procesa el callback OAuth
 * @param {string} code - Código de autorización
 * @param {string} state - Estado CSRF
 * @returns {Object} { connection, redirectPath }
 */
async function handleOAuthCallback(code, state) {
    // Validar estado
    const pending = pendingOAuthStates.get(state);
    if (!pending) {
        throw new Error('Estado OAuth inválido o expirado');
    }

    pendingOAuthStates.delete(state);

    const { tenantId, userId, redirectPath } = pending;
    const redirectUri = process.env.TRUELAYER_REDIRECT_URI;
    const db = getTenantDb({ id_tenant: tenantId });

    // Intercambiar código por tokens
    const tokens = await trueLayerProvider.exchangeCodeForTokens(code, redirectUri);

    // Calcular expiración
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Cifrar refresh token
    const refreshTokenEnc = encrypt(tokens.refresh_token);

    // Crear o actualizar conexión
    const result = await db.query(`
        INSERT INTO bank_connection (
            tenant_id, created_by_user_id, provider, status,
            scopes, refresh_token_enc, access_token_cache, access_token_expires_at,
            connected_at
        ) VALUES ($1, $2, 'truelayer', 'active', $3, $4, $5, $6, NOW())
        ON CONFLICT (tenant_id, provider, created_by_user_id) 
            WHERE created_by_user_id IS NOT NULL
        DO UPDATE SET
            status = 'active',
            scopes = EXCLUDED.scopes,
            refresh_token_enc = EXCLUDED.refresh_token_enc,
            access_token_cache = EXCLUDED.access_token_cache,
            access_token_expires_at = EXCLUDED.access_token_expires_at,
            connected_at = NOW(),
            updated_at = NOW()
        RETURNING *
    `, [
        tenantId,
        userId,
        tokens.scope ? tokens.scope.split(' ') : null,
        refreshTokenEnc,
        tokens.access_token,
        expiresAt
    ]);

    const connection = result.rows[0];

    // Programar sync inicial
    scheduleInitialSync(connection.id, tenantId);

    return { connection, redirectPath };
}

/**
 * Obtiene un access token válido para una conexión
 * Renueva automáticamente si está expirado
 * @param {string} connectionId
 * @returns {string} Access token válido
 */
async function getValidAccessToken(connectionId, tenantId) {
    const db = getTenantDb({ id_tenant: tenantId });
    const result = await db.query(`
        SELECT * FROM bank_connection WHERE id = $1
    `, [connectionId]);

    if (result.rows.length === 0) {
        throw new Error('Conexión no encontrada');
    }

    const conn = result.rows[0];

    if (conn.status !== 'active') {
        throw new Error(`Conexión no activa: ${conn.status}`);
    }

    // Verificar si el token en cache es válido
    const now = new Date();
    const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at) : null;

    if (conn.access_token_cache && expiresAt && expiresAt > new Date(now.getTime() + 60000)) {
        // Token válido (con 1 minuto de margen)
        return conn.access_token_cache;
    }

    // Renovar token
    console.log(`[OpenBanking] Renovando access token para conexión ${connectionId}`);

    try {
        const refreshToken = decrypt(conn.refresh_token_enc);
        const tokens = await trueLayerProvider.refreshAccessToken(refreshToken);

        const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
        const newRefreshEnc = tokens.refresh_token !== refreshToken
            ? encrypt(tokens.refresh_token)
            : conn.refresh_token_enc;

        await db.query(`
            UPDATE bank_connection SET
                access_token_cache = $1,
                access_token_expires_at = $2,
                refresh_token_enc = $3,
                updated_at = NOW()
            WHERE id = $4
        `, [tokens.access_token, newExpiresAt, newRefreshEnc, connectionId]);

        return tokens.access_token;

    } catch (error) {
        // Si falla el refresh, marcar como needs_reauth
        if (error.code === 'invalid_grant' || error.code === 'access_denied') {
            await db.query(`
                UPDATE bank_connection SET
                    status = 'needs_reauth',
                    updated_at = NOW()
                WHERE id = $1
            `, [connectionId]);
        }
        throw error;
    }
}

/**
 * Lista conexiones de un tenant
 * @param {number} tenantId
 * @returns {Array} Conexiones
 */
async function listConnections(tenantId) {
    const db = getTenantDb({ id_tenant: tenantId });
    const result = await db.query(`
        SELECT 
            id, tenant_id, created_by_user_id, provider, status,
            scopes, connected_at, last_sync_at, next_sync_at,
            created_at, updated_at
        FROM bank_connection
        WHERE tenant_id = $1
        ORDER BY created_at DESC
    `, [tenantId]);

    return result.rows;
}

/**
 * Obtiene una conexión por ID
 * @param {string} connectionId
 * @param {number} tenantId - Para validación
 * @returns {Object|null}
 */
async function getConnection(connectionId, tenantId) {
    const db = getTenantDb({ id_tenant: tenantId });
    const result = await db.query(`
        SELECT 
            id, tenant_id, created_by_user_id, provider, status,
            scopes, connected_at, last_sync_at, next_sync_at,
            created_at, updated_at
        FROM bank_connection
        WHERE id = $1 AND tenant_id = $2
    `, [connectionId, tenantId]);

    return result.rows[0] || null;
}

// ================================================================
// CUENTAS BANCARIAS
// ================================================================

/**
 * Lista cuentas de una conexión
 * @param {string} connectionId
 * @param {number} tenantId
 * @returns {Array}
 */
async function listAccounts(connectionId, tenantId) {
    const db = getTenantDb({ id_tenant: tenantId });
    const result = await db.query(`
        SELECT * FROM bank_account
        WHERE bank_connection_id = $1 AND tenant_id = $2
        ORDER BY display_name
    `, [connectionId, tenantId]);

    return result.rows;
}

/**
 * Lista todas las cuentas de un tenant
 * @param {number} tenantId
 * @returns {Array}
 */
async function listAllAccounts(tenantId, idEmpresa = null) {
    const db = getTenantDb({ id_tenant: tenantId });
    let query = `
        SELECT ba.*, bc.provider, bc.status as connection_status,
               (SELECT COALESCE(SUM(amount), 0) FROM bank_transaction WHERE bank_account_id = ba.id) as balance
        FROM bank_account ba
        LEFT JOIN bank_connection bc ON bc.id = ba.bank_connection_id
        WHERE ba.tenant_id = $1
    `;
    const params = [tenantId];

    if (idEmpresa) {
        query += ` AND ba.id_empresa = $2`;
        params.push(idEmpresa);
    }

    query += ` ORDER BY ba.display_name`;

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Crea una cuenta manual sin conexión provider
 * @param {Object} params
 * @returns {Object} Cuenta creada
 */
async function createManualAccount({ tenantId, display_name, currency, iban_masked, id_empresa }) {
    const providerAccountId = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const db = getTenantDb({ id_tenant: tenantId });

    const result = await db.query(`
        INSERT INTO bank_account (
            tenant_id, bank_connection_id, provider_account_id,
            account_type, currency, iban_masked, display_name, source, id_empresa
        ) VALUES ($1, NULL, $2, 'checking', $3, $4, $5, 'manual', $6)
        RETURNING *
    `, [tenantId, providerAccountId, currency, iban_masked, display_name, id_empresa]);

    return result.rows[0];
}

// ================================================================
// TRANSACCIONES
// ================================================================

/**
 * Lista transacciones con filtros y paginación
 * @param {Object} params
 * @returns {Object} { transactions, total, hasMore }
 */
async function listTransactions({
    tenantId,
    accountId = null,
    idEmpresa = null,
    from = null,
    to = null,
    limit = 50,
    offset = 0
}) {
    const db = getTenantDb({ id_tenant: tenantId });
    let conditions = ['tenant_id = $1'];
    let params = [tenantId];
    let paramIndex = 2;

    if (accountId) {
        conditions.push(`bank_account_id = $${paramIndex++}`);
        params.push(accountId);
    }

    if (idEmpresa) {
        conditions.push(`ba.id_empresa = $${paramIndex++}`);
        params.push(idEmpresa);
    }

    if (from) {
        conditions.push(`booking_date >= $${paramIndex++}`);
        params.push(from);
    }

    if (to) {
        conditions.push(`booking_date <= $${paramIndex++}`);
        params.push(to);
    }

    const whereClause = conditions.join(' AND ');

    // Obtener total
    const countResult = await db.query(`
        SELECT COUNT(*) as total 
        FROM bank_transaction bt
        JOIN bank_account ba ON ba.id = bt.bank_account_id
        WHERE ${whereClause.replace(/tenant_id/g, 'bt.tenant_id')}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    // Obtener transacciones
    const result = await db.query(`
        SELECT bt.*, ba.display_name as account_name, ba.currency as account_currency
        FROM bank_transaction bt
        JOIN bank_account ba ON ba.id = bt.bank_account_id
        WHERE ${whereClause.replace(/tenant_id/g, 'bt.tenant_id')}
        ORDER BY bt.booking_date DESC, bt.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    return {
        transactions: result.rows,
        total,
        hasMore: offset + result.rows.length < total
    };
}

// ================================================================
// SINCRONIZACIÓN
// ================================================================

/**
 * Ejecuta sincronización de una conexión
 * @param {string} connectionId
 * @param {number} tenantId
 * @param {Object} options
 * @returns {Object} Resultado del sync
 */
async function syncConnection(connectionId, tenantId, options = {}) {
    const {
        runType = 'manual',
        fromDate = null,
        toDate = null
    } = options;

    const db = getTenantDb({ id_tenant: tenantId });

    // Crear registro de sync run
    const runResult = await db.query(`
        INSERT INTO bank_sync_run (tenant_id, bank_connection_id, run_type, status)
        VALUES ($1, $2, $3, 'running')
        RETURNING *
    `, [tenantId, connectionId, runType]);
    const syncRun = runResult.rows[0];

    let metrics = {
        accounts_fetched: 0,
        transactions_fetched: 0,
        transactions_upserted: 0
    };

    try {
        // Obtener access token
        const accessToken = await getValidAccessToken(connectionId, tenantId);

        // Calcular rango de fechas
        const defaultDays = parseInt(process.env.OPEN_BANKING_DEFAULT_FROM_DAYS) || 90;
        const to = toDate ? new Date(toDate) : new Date();
        const from = fromDate ? new Date(fromDate) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);

        // Actualizar sync run con rango
        await db.query(`
            UPDATE bank_sync_run SET from_ts = $1, to_ts = $2 WHERE id = $3
        `, [from, to, syncRun.id]);

        // Sincronizar cuentas
        const accounts = await trueLayerProvider.listAccounts(accessToken);
        metrics.accounts_fetched = accounts.length;

        for (const acc of accounts) {
            // Upsert cuenta
            await db.query(`
                INSERT INTO bank_account (
                    tenant_id, bank_connection_id, provider_account_id,
                    account_type, currency, iban_masked, display_name, provider_payload
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (tenant_id, provider_account_id) DO UPDATE SET
                    account_type = EXCLUDED.account_type,
                    currency = EXCLUDED.currency,
                    iban_masked = EXCLUDED.iban_masked,
                    display_name = EXCLUDED.display_name,
                    provider_payload = EXCLUDED.provider_payload,
                    updated_at = NOW()
            `, [
                tenantId, connectionId, acc.provider_account_id,
                acc.account_type, acc.currency, acc.iban_masked,
                acc.display_name, JSON.stringify(acc.provider_payload)
            ]);
        }

        // Obtener IDs de cuentas en BD
        const dbAccounts = await db.query(`
            SELECT id, provider_account_id FROM bank_account
            WHERE bank_connection_id = $1 AND tenant_id = $2
        `, [connectionId, tenantId]);

        const accountMap = new Map(dbAccounts.rows.map(a => [a.provider_account_id, a.id]));

        // Sincronizar transacciones por cuenta
        for (const acc of accounts) {
            const dbAccountId = accountMap.get(acc.provider_account_id);
            if (!dbAccountId) continue;

            try {
                const transactions = await trueLayerProvider.getTransactions(
                    accessToken, acc.provider_account_id, from, to
                );
                metrics.transactions_fetched += transactions.length;

                // Upsert transacciones en batch
                for (const tx of transactions) {
                    const result = await db.query(`
                        INSERT INTO bank_transaction (
                            tenant_id, bank_account_id, provider_transaction_id,
                            booking_date, value_date, amount, currency, description,
                            merchant_name, category, reference, running_balance,
                            direction, provider_payload
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        ON CONFLICT (tenant_id, bank_account_id, provider_transaction_id) DO UPDATE SET
                            description = EXCLUDED.description,
                            merchant_name = EXCLUDED.merchant_name,
                            category = EXCLUDED.category,
                            running_balance = EXCLUDED.running_balance,
                            provider_payload = EXCLUDED.provider_payload,
                            updated_at = NOW()
                        RETURNING (xmax = 0) as inserted
                    `, [
                        tenantId, dbAccountId, tx.provider_transaction_id,
                        tx.booking_date, tx.value_date, tx.amount, tx.currency,
                        tx.description, tx.merchant_name, tx.category,
                        tx.reference, tx.running_balance, tx.direction,
                        JSON.stringify(tx.provider_payload)
                    ]);

                    if (result.rows[0]?.inserted) {
                        metrics.transactions_upserted++;
                    }
                }
            } catch (error) {
                console.error(`[OpenBanking] Error sync transactions for account ${acc.provider_account_id}:`, error.message);
            }
        }

        // Actualizar conexión
        const nextSync = new Date(Date.now() + 6 * 60 * 60 * 1000); // +6 horas
        await db.query(`
            UPDATE bank_connection SET
                last_sync_at = NOW(),
                next_sync_at = $1,
                updated_at = NOW()
            WHERE id = $2
        `, [nextSync, connectionId]);

        // Finalizar sync run exitoso
        await db.query(`
            UPDATE bank_sync_run SET
                status = 'succeeded',
                finished_at = NOW(),
                accounts_fetched = $1,
                transactions_fetched = $2,
                transactions_upserted = $3
            WHERE id = $4
        `, [metrics.accounts_fetched, metrics.transactions_fetched, metrics.transactions_upserted, syncRun.id]);

        return { success: true, syncRunId: syncRun.id, metrics };

    } catch (error) {
        console.error(`[OpenBanking] Sync failed for connection ${connectionId}:`, error);

        // Registrar error
        await db.query(`
            UPDATE bank_sync_run SET
                status = 'failed',
                finished_at = NOW(),
                error_code = $1,
                error_message = $2,
                accounts_fetched = $3,
                transactions_fetched = $4,
                transactions_upserted = $5
            WHERE id = $6
        `, [
            error.code || 'UNKNOWN',
            error.message,
            metrics.accounts_fetched,
            metrics.transactions_fetched,
            metrics.transactions_upserted,
            syncRun.id
        ]);

        throw error;
    }
}

/**
 * Programa sync inicial (se ejecutaría via job/cron)
 * Por ahora ejecuta inmediatamente
 * @param {string} connectionId
 * @param {number} tenantId
 */
async function scheduleInitialSync(connectionId, tenantId) {
    console.log(`[OpenBanking] Scheduling initial sync for connection ${connectionId}`);

    // Ejecutar en background
    setImmediate(async () => {
        try {
            await syncConnection(connectionId, tenantId, { runType: 'initial' });
            console.log(`[OpenBanking] Initial sync completed for connection ${connectionId}`);
        } catch (error) {
            console.error(`[OpenBanking] Initial sync failed for connection ${connectionId}:`, error.message);
        }
    });
}

/**
 * Obtiene historial de sync runs
 * @param {string} connectionId
 * @param {number} tenantId
 * @param {number} limit
 * @returns {Array}
 */
async function getSyncHistory(connectionId, tenantId, limit = 10) {
    const db = getTenantDb({ id_tenant: tenantId });
    const result = await db.query(`
        SELECT * FROM bank_sync_run
        WHERE bank_connection_id = $1 AND tenant_id = $2
        ORDER BY started_at DESC
        LIMIT $3
    `, [connectionId, tenantId, limit]);

    return result.rows;
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Limpia estados OAuth expirados
 */
function cleanupOldStates() {
    const now = Date.now();
    for (const [key, value] of pendingOAuthStates.entries()) {
        if (now - value.createdAt > OAUTH_STATE_TTL) {
            pendingOAuthStates.delete(key);
        }
    }
}

// ================================================================
// CONCILIACIÓN
// ================================================================

/**
 * Concilia una transacción bancaria con una o varias facturas
 */
async function reconcileTransaction(tenantId, transactionId, invoiceIds, idEmpresa = null) {
    const db = getTenantDb({ id_tenant: tenantId });
    try {
        await db.txWithRLS(async (tx) => {
            // 1. Obtener transacción y verificar
            const txRes = await tx.query(`
                SELECT bt.*, ba.id_empresa 
                FROM bank_transaction bt
                JOIN bank_account ba ON ba.id = bt.bank_account_id
                WHERE bt.id = $1 AND bt.tenant_id = $2
                FOR UPDATE
            `, [transactionId, tenantId]);

            const transaction = txRes.rows[0];
            if (!transaction) throw new Error('Transacción no encontrada');
            if (transaction.status === 'RECONCILED') throw new Error('Transacción ya conciliada');

            // Enforce Company Isolation
            if (idEmpresa && transaction.id_empresa && String(transaction.id_empresa) !== String(idEmpresa)) {
                throw new Error(`La transacción pertenece a la empresa ${transaction.id_empresa}, pero se solicita desde ${idEmpresa}`);
            }

            // 2. Procesar facturas
            for (const invId of invoiceIds) {
                // Verificar factura
                const invRes = await tx.query(`
                    SELECT * FROM contabilidad_factura 
                    WHERE id = $1 AND id_empresa = $2
                `, [invId, transaction.id_empresa]);

                const invoice = invRes.rows[0];
                if (!invoice) throw new Error(`Factura ${invId} no válida para esta empresa`);
                if (invoice.estado === 'PAGADA') throw new Error(`Factura ${invoice.numero_factura} ya está pagada`);

                // Crear movimiento contable (Cobro o Pago)
                const tipo = transaction.amount >= 0 ? 'COBRO' : 'PAGO';

                await tx.query(`
                    INSERT INTO accounting_transaccion 
                    (id_empresa, tipo, importe, fecha, concepto, metodo, id_factura, bank_transaction_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    transaction.id_empresa,
                    tipo,
                    invoice.total,
                    transaction.booking_date,
                    `Conciliación: ${transaction.description}`,
                    'TRANSFERENCIA',
                    invoice.id,
                    transaction.id
                ]);

                // Actualizar estado factura
                await tx.query(`
                    UPDATE contabilidad_factura 
                    SET estado = 'PAGADA', 
                        total_pagado = total 
                    WHERE id = $1
                `, [invId]);
            }

            // 3. Actualizar estado transacción bancaria
            await tx.query(`
                UPDATE bank_transaction 
                SET status = 'RECONCILED', 
                    reconciled_at = NOW() 
                WHERE id = $1
            `, [transactionId]);

            return { ok: true };
        });

        return { ok: true };

    } catch (e) {
        throw e;
    }
}

module.exports = {
    // OAuth
    initiateOAuthFlow,
    handleOAuthCallback,

    // Conexiones
    listConnections,
    getConnection,
    getValidAccessToken,

    // Cuentas
    listAccounts,
    listAllAccounts,
    createManualAccount,

    // Transacciones
    listTransactions,
    reconcileTransaction,

    // Sync
    syncConnection,
    getSyncHistory
};
