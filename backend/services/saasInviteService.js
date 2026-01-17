/**
 * SaaS Invite Service
 * Handles invitation tokens for B2B SaaS user onboarding
 * 
 * Invites allow new users to join a specific tenant with a predefined role.
 * Token security: Only the hash is stored in DB, never the plaintext.
 */

const crypto = require('crypto');
const pool = require('../db');

// Invite token configuration
const INVITE_TOKEN_BYTES = 32; // 256-bit token
const DEFAULT_EXPIRY_HOURS = 72; // 3 days

/**
 * Generate a cryptographically secure invite token
 * @returns {string} Plaintext token (only returned once, not stored)
 */
function generateInviteToken() {
    return crypto.randomBytes(INVITE_TOKEN_BYTES).toString('hex');
}

/**
 * Hash an invite token for storage
 * @param {string} token - Plaintext token
 * @returns {string} SHA-256 hash
 */
function hashInviteToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new invitation
 * @param {Object} params
 * @param {number} params.tenantId - Tenant to invite to
 * @param {string} params.role - Role to assign (default: CLIENT_ADMIN)
 * @param {string} [params.emailAllowed] - Optional: restrict to specific email
 * @param {number} [params.empresaId] - Optional: assign to specific empresa
 * @param {number} [params.expiryHours] - Hours until expiration (default: 72)
 * @param {number} [params.createdByUserId] - User creating the invite
 * @returns {Object} { inviteId, token, expiresAt }
 */
async function createInvite({ tenantId, role = 'CLIENT_ADMIN', emailAllowed = null, empresaId = null, expiryHours = DEFAULT_EXPIRY_HOURS, createdByUserId = null }) {
    // Validate tenant exists
    const tenantCheck = await pool.query('SELECT id FROM tenant WHERE id = $1', [tenantId]);
    if (tenantCheck.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    // Validate empresa belongs to tenant if specified
    if (empresaId) {
        const empresaCheck = await pool.query(
            'SELECT id FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );
        if (empresaCheck.rows.length === 0) {
            throw new Error('Empresa not found in tenant');
        }
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const result = await pool.query(
        `INSERT INTO saas_invite (token_hash, tenant_id, id_empresa, role, email_allowed, expires_at, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, expires_at`,
        [tokenHash, tenantId, empresaId, role, emailAllowed, expiresAt, createdByUserId]
    );

    const invite = result.rows[0];

    console.log(`[SaaSInvite] Created invite for tenant ${tenantId}, empresa ${empresaId || 'none'}, role ${role}, expires ${invite.expires_at}`);

    return {
        inviteId: invite.id,
        token, // Only returned here, never stored
        expiresAt: invite.expires_at
    };
}

/**
 * Validate an invite token
 * @param {string} token - Plaintext invite token
 * @param {string} [email] - Email attempting to use invite (for email_allowed check)
 * @returns {Object|null} Invite data if valid, null otherwise
 */
async function validateInvite(token, email = null) {
    const tokenHash = hashInviteToken(token);

    const result = await pool.query(
        `SELECT si.*, t.nombre as tenant_nombre
         FROM saas_invite si
         JOIN tenant t ON si.tenant_id = t.id
         WHERE si.token_hash = $1
           AND si.used_at IS NULL
           AND si.expires_at > NOW()`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        console.log('[SaaSInvite] Token invalid, expired, or already used');
        return null;
    }

    const invite = result.rows[0];

    // Check email restriction if set
    if (invite.email_allowed && email) {
        if (invite.email_allowed.toLowerCase() !== email.toLowerCase()) {
            console.log(`[SaaSInvite] Email mismatch: expected ${invite.email_allowed}, got ${email}`);
            return null;
        }
    }

    return {
        id: invite.id,
        tenantId: invite.tenant_id,
        tenantName: invite.tenant_nombre,
        role: invite.role,
        emailAllowed: invite.email_allowed,
        expiresAt: invite.expires_at
    };
}

/**
 * Mark an invite as used
 * @param {number} inviteId - Invite ID
 * @returns {boolean} Success
 */
async function consumeInvite(inviteId) {
    const result = await pool.query(
        `UPDATE saas_invite 
         SET used_at = NOW()
         WHERE id = $1 AND used_at IS NULL
         RETURNING id`,
        [inviteId]
    );

    if (result.rowCount > 0) {
        console.log(`[SaaSInvite] Consumed invite ${inviteId}`);
        return true;
    }

    return false;
}

/**
 * Get invite by ID (for display purposes)
 * @param {number} inviteId
 * @returns {Object|null}
 */
async function getInviteById(inviteId) {
    const result = await pool.query(
        `SELECT si.*, t.nombre as tenant_nombre
         FROM saas_invite si
         JOIN tenant t ON si.tenant_id = t.id
         WHERE si.id = $1`,
        [inviteId]
    );

    if (result.rows.length === 0) return null;

    const invite = result.rows[0];
    return {
        id: invite.id,
        tenantId: invite.tenant_id,
        tenantName: invite.tenant_nombre,
        role: invite.role,
        emailAllowed: invite.email_allowed,
        expiresAt: invite.expires_at,
        usedAt: invite.used_at,
        createdAt: invite.created_at
    };
}

/**
 * List invites for a tenant
 * @param {number} tenantId
 * @param {boolean} activeOnly - Only show unused, unexpired invites
 * @returns {Array}
 */
async function listInvitesByTenant(tenantId, activeOnly = false) {
    let query = `
        SELECT si.*, 
               e.nombre_legal as empresa_nombre,
               CASE WHEN si.used_at IS NOT NULL THEN 'used'
                    WHEN si.expires_at < NOW() THEN 'expired'
                    ELSE 'active' END as status
        FROM saas_invite si
        LEFT JOIN accounting_empresa e ON si.id_empresa = e.id
        WHERE si.tenant_id = $1
    `;

    if (activeOnly) {
        query += ` AND si.used_at IS NULL AND si.expires_at > NOW()`;
    }

    query += ` ORDER BY si.created_at DESC`;

    const result = await pool.query(query, [tenantId]);

    return result.rows.map(invite => ({
        id: invite.id,
        role: invite.role,
        emailAllowed: invite.email_allowed,
        empresaId: invite.id_empresa,
        empresaNombre: invite.empresa_nombre,
        expiresAt: invite.expires_at,
        usedAt: invite.used_at,
        status: invite.status,
        createdAt: invite.created_at
    }));
}

/**
 * Delete an invite (only if not used)
 * @param {number} inviteId
 * @returns {boolean}
 */
async function deleteInvite(inviteId) {
    const result = await pool.query(
        `DELETE FROM saas_invite WHERE id = $1 AND used_at IS NULL`,
        [inviteId]
    );
    return result.rowCount > 0;
}

/**
 * Build invite URL
 * @param {string} token - Plaintext invite token
 * @param {string} [loginPath] - Path to login page (default: /login-finsaas.html)
 * @returns {string}
 */
function buildInviteUrl(token, loginPath = '/login-finsaas.html') {
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    return `${baseUrl}${loginPath}?invite=${token}`;
}

module.exports = {
    generateInviteToken,
    hashInviteToken,
    createInvite,
    validateInvite,
    consumeInvite,
    getInviteById,
    listInvitesByTenant,
    deleteInvite,
    buildInviteUrl
};
