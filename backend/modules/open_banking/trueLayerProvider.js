/**
 * TrueLayer Provider - Adapter para la API de TrueLayer
 * 
 * Implementa la interfaz OpenBankingProvider:
 * - buildAuthLink() - Construye URL de autorización OAuth
 * - exchangeCodeForTokens() - Intercambia code por tokens
 * - refreshAccessToken() - Renueva access token
 * - listAccounts() - Obtiene lista de cuentas
 * - getTransactions() - Descarga transacciones
 */

// Determinar URLs base según el entorno (sandbox usa dominios diferentes)
const isSandbox = (process.env.TRUELAYER_ENV || 'sandbox') === 'sandbox';
const TRUELAYER_AUTH_BASE = process.env.TRUELAYER_AUTH_BASE ||
    (isSandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com');
const TRUELAYER_API_BASE = process.env.TRUELAYER_API_BASE ||
    (isSandbox ? 'https://api.truelayer-sandbox.com' : 'https://api.truelayer.com');

/**
 * Construye la URL de autorización OAuth de TrueLayer
 * @param {Object} params
 * @param {string} params.state - Estado CSRF
 * @param {string} params.redirectUri - URI de callback
 * @param {string[]} params.scopes - Scopes solicitados
 * @returns {string} URL de autorización
 */
function buildAuthLink({ state, redirectUri, scopes = [] }) {
    const clientId = process.env.TRUELAYER_CLIENT_ID;
    if (!clientId) {
        throw new Error('TRUELAYER_CLIENT_ID no configurado');
    }

    // Scopes por defecto para Data API
    const defaultScopes = [
        'info',
        'accounts',
        'transactions',
        'balance',
        'offline_access' // Para refresh tokens long-lived
    ];

    const finalScopes = scopes.length > 0 ? scopes : defaultScopes;

    // Determinar providers según ambiente
    const env = process.env.TRUELAYER_ENV || 'sandbox';
    const providers = env === 'live'
        ? 'uk-ob-all uk-oauth-all'
        : 'mock';

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: finalScopes.join(' '),
        providers: providers,
        state: state
    });

    return `${TRUELAYER_AUTH_BASE}/?${params.toString()}`;
}

/**
 * Intercambia el código de autorización por tokens
 * @param {string} code - Código de autorización
 * @param {string} redirectUri - URI de callback (debe coincidir)
 * @returns {Promise<Object>} { access_token, refresh_token, expires_in, scope }
 */
async function exchangeCodeForTokens(code, redirectUri) {
    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('TRUELAYER_CLIENT_ID o TRUELAYER_CLIENT_SECRET no configurados');
    }

    const response = await fetch(`${TRUELAYER_AUTH_BASE}/connect/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Token exchange failed');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope
    };
}

/**
 * Renueva el access token usando refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} { access_token, refresh_token, expires_in }
 */
async function refreshAccessToken(refreshToken) {
    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('TRUELAYER_CLIENT_ID o TRUELAYER_CLIENT_SECRET no configurados');
    }

    const response = await fetch(`${TRUELAYER_AUTH_BASE}/connect/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Token refresh failed');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Puede no devolver nuevo refresh
        expires_in: data.expires_in
    };
}

/**
 * Obtiene la lista de cuentas del usuario
 * @param {string} accessToken - Access token válido
 * @returns {Promise<Array>} Lista de cuentas
 */
async function listAccounts(accessToken) {
    const response = await fetch(`${TRUELAYER_API_BASE}/data/v1/accounts`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Failed to list accounts');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }

    // Mapear a formato interno
    return (data.results || []).map(acc => ({
        provider_account_id: acc.account_id,
        account_type: acc.account_type,
        currency: acc.currency,
        iban_masked: maskIban(acc.account_number?.iban),
        display_name: acc.display_name || acc.provider?.display_name || 'Cuenta',
        provider_payload: acc
    }));
}

/**
 * Obtiene las transacciones de una cuenta
 * @param {string} accessToken - Access token válido
 * @param {string} accountId - ID de cuenta del provider
 * @param {Date} from - Fecha inicio
 * @param {Date} to - Fecha fin
 * @returns {Promise<Array>} Lista de transacciones
 */
async function getTransactions(accessToken, accountId, from, to) {
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const url = `${TRUELAYER_API_BASE}/data/v1/accounts/${accountId}/transactions?from=${fromStr}&to=${toStr}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Failed to get transactions');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }

    // Mapear a formato interno
    return (data.results || []).map(tx => ({
        provider_transaction_id: tx.transaction_id || generateTxId(tx),
        booking_date: tx.timestamp ? tx.timestamp.split('T')[0] : null,
        value_date: tx.transaction_classification?.normalised_provider_transaction_id ? null : null,
        amount: Math.abs(tx.amount),
        currency: tx.currency,
        description: tx.description || tx.meta?.provider_transaction_category || '',
        merchant_name: tx.merchant_name,
        category: tx.transaction_category,
        reference: tx.meta?.provider_reference,
        running_balance: tx.running_balance?.amount || null,
        direction: tx.amount >= 0 ? 'in' : 'out',
        provider_payload: tx
    }));
}

/**
 * Obtiene el balance de una cuenta
 * @param {string} accessToken - Access token válido
 * @param {string} accountId - ID de cuenta del provider
 * @returns {Promise<Object>} Balance info
 */
async function getBalance(accessToken, accountId) {
    const response = await fetch(`${TRUELAYER_API_BASE}/data/v1/accounts/${accountId}/balance`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Failed to get balance');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }

    const balance = data.results?.[0];
    return balance ? {
        current: balance.current,
        available: balance.available,
        currency: balance.currency,
        update_timestamp: balance.update_timestamp
    } : null;
}

// === HELPERS ===

/**
 * Enmascara un IBAN mostrando solo inicio y final
 * @param {string} iban 
 * @returns {string} IBAN enmascarado
 */
function maskIban(iban) {
    if (!iban) return null;
    if (iban.length <= 8) return iban;
    return `${iban.substring(0, 4)}****${iban.substring(iban.length - 4)}`;
}

/**
 * Genera un ID determinístico para transacciones sin ID
 * @param {Object} tx - Transacción
 * @returns {string} ID generado
 */
function generateTxId(tx) {
    const crypto = require('crypto');
    const data = `${tx.timestamp}|${tx.amount}|${tx.description || ''}|${tx.currency}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

module.exports = {
    buildAuthLink,
    exchangeCodeForTokens,
    refreshAccessToken,
    listAccounts,
    getTransactions,
    getBalance
};
