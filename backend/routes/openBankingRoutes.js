/**
 * Open Banking Routes - API endpoints
 * 
 * Rutas para conexión bancaria, cuentas y transacciones
 */
const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const { requireEmpresaAccess } = require('../middleware/rbac');
const openBankingService = require('../modules/open_banking/openBankingService');
const auditService = require('../src/core/logging/audit-service');
const { AUDIT_ACTIONS } = auditService;

router.use(verifyJWT);
router.use(requireEmpresaAccess());

// ================================================================
// OAUTH / CONEXIÓN
// ================================================================

/**
 * POST /api/open-banking/truelayer/link
 * Inicia el flujo OAuth con TrueLayer
 * Body: { redirect_path?: string }
 * Returns: { url: string }
 */
router.post('/truelayer/link', verifyJWT, async (req, res) => {
    try {
        const { redirect_path } = req.body;
        const tenantId = req.user.id_tenant;
        const userId = req.user.id;

        if (!tenantId) {
            return res.status(400).json({
                ok: false,
                error: 'Tenant no identificado'
            });
        }

        const { url, state } = openBankingService.initiateOAuthFlow({
            tenantId,
            userId,
            redirectPath: redirect_path || '/manager-taller-banking.html'
        });

        console.log(`[OpenBanking] OAuth iniciado para tenant ${tenantId}, user ${userId}`);

        auditService.register(req, AUDIT_ACTIONS.BANKING_LINK_INITIATE, {
            entityType: 'BANK_CONNECTION',
            after: { redirectPath: redirect_path }
        });

        res.json({ ok: true, url });

    } catch (error) {
        console.error('[OpenBanking] Error en /truelayer/link:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/**
 * GET /api/open-banking/truelayer/callback
 * Callback OAuth de TrueLayer
 * Query: code, state, error?
 */
router.get('/truelayer/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        // TrueLayer puede devolver error en callback
        if (error) {
            console.error(`[OpenBanking] OAuth error: ${error} - ${error_description}`);
            const errorRedirect = `/manager-taller-banking.html?error=${encodeURIComponent(error_description || error)}`;
            return res.redirect(errorRedirect);
        }

        if (!code || !state) {
            return res.redirect('/manager-taller-banking.html?error=invalid_callback');
        }

        const { connection, redirectPath } = await openBankingService.handleOAuthCallback(code, state);

        console.log(`[OpenBanking] Conexión creada: ${connection.id} para tenant ${connection.tenant_id}`);

        auditService.register(req, AUDIT_ACTIONS.BANKING_LINK_SUCCESS, {
            entityType: 'BANK_CONNECTION',
            entityId: connection.id,
            after: connection
        });

        // Redirigir a UI con éxito
        const successRedirect = `${redirectPath}?connected=true&connection_id=${connection.id}`;
        res.redirect(successRedirect);

    } catch (error) {
        console.error('[OpenBanking] Error en callback:', error);

        auditService.register(req, AUDIT_ACTIONS.BANKING_LINK_ERROR, {
            entityType: 'BANK_CONNECTION',
            after: { error: error.message }
        });

        const errorRedirect = `/manager-taller-banking.html?error=${encodeURIComponent(error.message)}`;
        res.redirect(errorRedirect);
    }
});

// ================================================================
// CONEXIONES
// ================================================================

/**
 * GET /api/open-banking/connections
 * Lista las conexiones bancarias del tenant
 */
router.get('/connections', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.id_tenant;

        const connections = await openBankingService.listConnections(tenantId);

        res.json({ ok: true, connections });

    } catch (error) {
        console.error('[OpenBanking] Error en /connections:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/**
 * GET /api/open-banking/connections/:id
 * Obtiene detalle de una conexión
 */
router.get('/connections/:id', verifyJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id_tenant;

        const connection = await openBankingService.getConnection(id, tenantId);

        if (!connection) {
            return res.status(404).json({
                ok: false,
                error: 'Conexión no encontrada'
            });
        }

        res.json({ ok: true, connection });

    } catch (error) {
        console.error('[OpenBanking] Error en /connections/:id:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

// ================================================================
// CUENTAS
// ================================================================

/**
 * POST /api/open-banking/accounts
 * Crea una cuenta bancaria manual
 * Body: { display_name, currency, iban_masked? }
 */
router.post('/accounts', verifyJWT, async (req, res) => {
    console.log('[OpenBanking] POST /accounts reached');
    try {
        const { display_name, currency = 'EUR', iban_masked, id_empresa } = req.body;
        const tenantId = req.user.id_tenant;

        if (!display_name) {
            return res.status(400).json({ ok: false, error: 'display_name es requerido' });
        }

        const account = await openBankingService.createManualAccount({
            tenantId,
            display_name,
            currency,
            iban_masked,
            id_empresa: id_empresa || req.headers['x-empresa-id']
        });

        auditService.register(req, AUDIT_ACTIONS.BANKING_ACCOUNT_CREATE, {
            entityType: 'BANK_ACCOUNT',
            entityId: account.id,
            after: account
        });

        res.json({ ok: true, account });

    } catch (error) {
        console.error('[OpenBanking] Error en POST /accounts:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/**
 * GET /api/open-banking/accounts
 * Lista cuentas bancarias
 * Query: connection_id? (opcional, si no se pasa lista todas)
 */
router.get('/accounts', verifyJWT, async (req, res) => {
    try {
        const { connection_id } = req.query;
        const tenantId = req.user.id_tenant;
        const idEmpresa = req.query.id_empresa || req.headers['x-empresa-id'];

        let accounts;
        if (connection_id) {
            accounts = await openBankingService.listAccounts(connection_id, tenantId);
        } else {
            accounts = await openBankingService.listAllAccounts(tenantId, idEmpresa);
        }

        res.json({ ok: true, accounts });

    } catch (error) {
        console.error('[OpenBanking] Error en /accounts:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

const bankingAiService = require('../modules/banking/services/bankingAiService');

// ================================================================
// TRANSACCIONES
// ================================================================

/**
 * GET /api/open-banking/transactions
 * Lista transacciones con filtros
 * Query: account_id?, from?, to?, limit?, offset?
 */
router.get('/transactions', verifyJWT, async (req, res) => {
    try {
        const { account_id, from, to, limit = 50, offset = 0 } = req.query;
        const tenantId = req.user.id_tenant;
        const idEmpresa = req.query.id_empresa || req.headers['x-empresa-id'];

        const result = await openBankingService.listTransactions({
            tenantId,
            accountId: account_id || null,
            idEmpresa: idEmpresa || null,
            from: from || null,
            to: to || null,
            limit: Math.min(parseInt(limit) || 50, 100),
            offset: parseInt(offset) || 0
        });

        res.json({
            ok: true,
            transactions: result.transactions,
            total: result.total,
            hasMore: result.hasMore
        });

    } catch (error) {
        console.error('[OpenBanking] Error en /transactions:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/**
 * POST /api/open-banking/transactions/analyze
 * Analiza movimientos usando IA
 * Body: { transactions: [...] }
 */
router.post('/transactions/analyze', verifyJWT, async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ ok: false, error: 'Lista de transacciones requerida' });
        }

        const analysis = await bankingAiService.analyzeTransactions(transactions);
        res.json({ ok: true, analysis });

    } catch (error) {
        console.error('[OpenBanking] Error en /analyze:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ================================================================
// SINCRONIZACIÓN
// ================================================================

/**
 * POST /api/open-banking/transactions/:id/reconcile
 * Conciliar transacción con facturas
 * Body: { invoices: [id1, id2] }
 */
router.post('/transactions/:id/reconcile', verifyJWT, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { invoices } = req.body;
        const tenantId = req.user.id_tenant;
        const idEmpresa = req.body.id_empresa || req.headers['x-empresa-id'];

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return res.status(400).json({ ok: false, error: 'Lista de facturas requerida' });
        }

        const result = await openBankingService.reconcileTransaction(tenantId, transactionId, invoices, idEmpresa);

        auditService.register(req, AUDIT_ACTIONS.BANKING_RECONCILE, {
            entityType: 'BANK_TRANSACTION',
            entityId: transactionId,
            after: { invoices, result }
        });

        res.json(result);
    } catch (error) {
        console.error('[OpenBanking] Error en reconcile:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

/**
 * POST /api/open-banking/sync
 * Trigger sync manual
 * Body: { connection_id, from?, to? }
 */
router.post('/sync', verifyJWT, async (req, res) => {
    try {
        const { connection_id, from, to } = req.body;
        const tenantId = req.user.id_tenant;

        if (!connection_id) {
            return res.status(400).json({
                ok: false,
                error: 'connection_id es requerido'
            });
        }

        // Verificar que la conexión pertenece al tenant
        const connection = await openBankingService.getConnection(connection_id, tenantId);
        if (!connection) {
            return res.status(404).json({
                ok: false,
                error: 'Conexión no encontrada'
            });
        }

        // Ejecutar sync
        const result = await openBankingService.syncConnection(connection_id, tenantId, {
            runType: 'manual',
            fromDate: from,
            toDate: to
        });

        auditService.register(req, AUDIT_ACTIONS.BANKING_SYNC, {
            entityType: 'BANK_CONNECTION',
            entityId: connection_id,
            after: {
                runType: 'manual',
                syncRunId: result.syncRunId,
                metrics: result.metrics
            }
        });

        res.json({
            ok: true,
            message: 'Sincronización completada',
            syncRunId: result.syncRunId,
            metrics: result.metrics
        });

    } catch (error) {
        console.error('[OpenBanking] Error en /sync:', error);

        // Determinar si es error de reauth
        if (error.code === 'invalid_grant' || error.code === 'access_denied') {
            return res.status(401).json({
                ok: false,
                error: 'La conexión requiere reconexión',
                code: 'NEEDS_REAUTH'
            });
        }

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/**
 * GET /api/open-banking/sync/history
 * Historial de sincronizaciones
 * Query: connection_id, limit?
 */
router.get('/sync/history', verifyJWT, async (req, res) => {
    try {
        const { connection_id, limit = 10 } = req.query;
        const tenantId = req.user.id_tenant;

        if (!connection_id) {
            return res.status(400).json({
                ok: false,
                error: 'connection_id es requerido'
            });
        }

        const history = await openBankingService.getSyncHistory(
            connection_id,
            tenantId,
            Math.min(parseInt(limit) || 10, 50)
        );

        res.json({ ok: true, history });

    } catch (error) {
        console.error('[OpenBanking] Error en /sync/history:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

module.exports = router;
