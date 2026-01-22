/**
 * Google Authentication Service for SaaS (B2B)
 * Handles Google OAuth user linking and invite-based registration
 * 
 * IMPORTANT: This is for B2B SaaS users who MUST belong to a tenant.
 * - Does NOT auto-create users without valid invite
 * - Links Google to existing users by email
 * - Creates new users ONLY with valid invite token
 * 
 * Uses user_auth_identity table (formerly oauth_account)
 */

const { getSystemDb } = require('../src/core/db/tenant-db');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../models/userModel');
const saasInviteService = require('./saasInviteService');

/**
 * Find user by Google provider ID in user_auth_identity
 * @param {string} providerSubject - Google's unique user ID (sub)
 * @returns {Object|null} User data if found
 */
async function findUserByGoogleId(providerSubject) {
    const systemDb = getSystemDb();
    const result = await systemDb.query(
        `SELECT uai.*, u.id as user_id, u.email, u.nombre, u.id_tenant, u.is_super_admin
         FROM user_auth_identity uai
         JOIN usuario u ON uai.user_id = u.id
         WHERE uai.provider = 'google' AND uai.provider_account_id = $1`,
        [providerSubject]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.user_id,
        email: row.email,
        nombre: row.nombre,
        id_tenant: row.id_tenant,
        is_super_admin: row.is_super_admin,
        identityId: row.id
    };
}

/**
 * Link Google account to existing user
 * @param {number} userId - User ID to link to
 * @param {Object} googleProfile - { providerId, email, name, avatar }
 * @returns {Object} Created user_auth_identity row
 */
async function linkGoogleToUser(userId, googleProfile) {
    const { providerId, email, name, avatar } = googleProfile;
    const systemDb = getSystemDb();

    const result = await systemDb.query(
        `INSERT INTO user_auth_identity (user_id, provider, provider_account_id, email, name, avatar_url)
         VALUES ($1, 'google', $2, $3, $4, $5)
         ON CONFLICT (provider, provider_account_id) 
         DO UPDATE SET email = $3, name = $4, avatar_url = $5, updated_at = NOW()
         RETURNING *`,
        [userId, providerId, email, name, avatar]
    );

    console.log(`[SaaSAuth] Linked Google account to user ${userId}`);

    return result.rows[0];
}

/**
 * Process SaaS Google OAuth callback
 * Implements invite-only registration for B2B
 * 
 * @param {Object} googleProfile - { providerId, email, name, avatar }
 * @param {string|null} inviteToken - Optional invite token from query params
 * @returns {Object} { user, isNew, error }
 */
async function processSaaSGoogleAuth(googleProfile, inviteToken = null) {
    const { providerId, email, name, avatar } = googleProfile;

    // Use System DB for global auth flows
    const systemDb = getSystemDb();

    if (!email) {
        return { user: null, isNew: false, error: 'MISSING_EMAIL' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if Google account is already linked to a user
    const existingUser = await findUserByGoogleId(providerId);

    if (existingUser) {
        // Already linked - just login
        console.log(`[SaaSAuth] Login via existing Google link: ${normalizedEmail}`);
        return { user: existingUser, isNew: false, error: null };
    }

    // 2. Check if user exists by email
    // Note: getUserByEmail from model might use pool internally if not refactored properly?
    // But Batch A8 refactored userModel to support ctx. Let's pass systemDb (ctx) if possible or rely on its default.
    // Wait, Batch A8 userModel accepts ctx/db. If we call it without arguments, it might default to tenant db with missing context?
    // Actually getUserByEmail is often global.
    // Let's check how getUserByEmail works. It likely uses resolveDb. If no context, what does it do?
    // Assuming getUserByEmail(email) uses ALLOW_NO_TENANT logic if needed or just queries.
    // Ideally we pass systemDb to it. But checking imported function signature...
    // const { getUserByEmail } = require('../models/userModel');
    // It's likely `getUserByEmail(email, ctx)`.
    // I should pass systemDb as second arg if supported.
    // But safely: `getUserByEmail(email)` should work if it handles its own DB resolution.
    // However, explicit is better. I'll just look it up directly here to avoid dependency ambiguity if I can't verify userModel sig.
    // Or just trust it.

    // Direct lookup for safety and less dependency on userModel internals which might enforce tenant context.
    const userResult = await systemDb.query('SELECT * FROM usuario WHERE email = $1', [normalizedEmail]);
    const userByEmail = userResult.rows[0];

    if (userByEmail) {
        // User exists - link Google and login
        await linkGoogleToUser(userByEmail.id, { providerId, email: normalizedEmail, name, avatar });
        console.log(`[SaaSAuth] Linked Google to existing user: ${normalizedEmail}`);
        return { user: userByEmail, isNew: false, error: null };
    }

    // 3. User doesn't exist - check for invite
    if (!inviteToken) {
        console.log(`[SaaSAuth] No user found and no invite token for: ${normalizedEmail}`);
        return { user: null, isNew: false, error: 'NO_ACCOUNT_NO_INVITE' };
    }

    // 4. Validate invite token
    const invite = await saasInviteService.validateInvite(inviteToken, normalizedEmail);

    if (!invite) {
        console.log(`[SaaSAuth] Invalid or expired invite for: ${normalizedEmail}`);
        return { user: null, isNew: false, error: 'INVALID_INVITE' };
    }

    // 5. Create new user with invite's tenant and role
    const client = await systemDb.connect();
    try {
        await client.query('BEGIN');

        // Create user with tenant from invite
        const userResult = await client.query(
            `INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
             VALUES ($1, $2, $3, $4, false)
             RETURNING id, id_tenant, nombre, email, is_super_admin`,
            [invite.tenantId, name || 'Usuario Google', normalizedEmail, '']
        );
        const newUser = userResult.rows[0];

        // Assign role from invite (with tenant_id for RBAC)
        const roleResult = await client.query(
            `SELECT id FROM rol WHERE nombre = $1`,
            [invite.role]
        );

        if (roleResult.rows.length > 0) {
            await client.query(
                `INSERT INTO usuariorol (id_usuario, id_rol, tenant_id) VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [newUser.id, roleResult.rows[0].id, invite.tenantId]
            );
        }

        // Link Google account
        await client.query(
            `INSERT INTO user_auth_identity (user_id, provider, provider_account_id, email, name, avatar_url)
             VALUES ($1, 'google', $2, $3, $4, $5)`,
            [newUser.id, providerId, normalizedEmail, name, avatar]
        );

        // If empresa specified in invite, assign user to empresa
        if (invite.empresaId) {
            await client.query(`
                INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa, created_by)
                VALUES ($1, $2, $3, $1)
                ON CONFLICT (id_usuario, id_empresa) DO NOTHING
            `, [newUser.id, invite.empresaId, 'empresa_lector']);
            console.log(`[SaaSAuth] Assigned user ${newUser.id} to empresa ${invite.empresaId}`);
        }

        // Mark invite as used
        await client.query(
            `UPDATE saas_invite SET used_at = NOW(), used_by_user_id = $1 WHERE id = $2`,
            [newUser.id, invite.id]
        );

        await client.query('COMMIT');

        console.log(`[SaaSAuth] Created new user via invite: ${normalizedEmail} (tenant: ${invite.tenantId}, role: ${invite.role})`);

        return {
            user: newUser,
            isNew: true,
            error: null,
            tenantName: invite.tenantName
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[SaaSAuth] User creation error:', error);
        return { user: null, isNew: false, error: 'CREATION_FAILED' };
    } finally {
        client.release();
    }
}

/**
 * Generate JWT token for authenticated SaaS user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
async function generateLoginToken(user) {
    const systemDb = getSystemDb();

    // Fetch user roles
    const rolesResult = await systemDb.query(`
        SELECT r.nombre, r.display_name
        FROM usuariorol ur
        JOIN rol r ON r.id = ur.id_rol
        WHERE ur.id_usuario = $1
    `, [user.id]);

    const userRoles = rolesResult.rows.map(r => r.nombre);

    const payload = {
        id: user.id,
        id_tenant: user.id_tenant,
        id_sucursal: user.id_sucursal || null,
        email: user.email,
        nombre: user.nombre,
        is_super_admin: user.is_super_admin || false,
        roles: userRoles,
        auth_provider: 'google'
    };

    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
}

/**
 * Log OAuth authentication event
 * @param {Object} params
 */
async function logOAuthEvent({ userId, provider, action, ip, userAgent, metadata }) {
    const systemDb = getSystemDb();
    try {
        await systemDb.query(
            `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_json, ip_address, user_agent)
             VALUES ($1, $2, 'user', $3, $4, $5, $6)`,
            [
                userId,
                action,
                String(userId),
                JSON.stringify({ provider, ...metadata }),
                ip?.substring(0, 45) || null,
                userAgent?.substring(0, 500) || null
            ]
        );
    } catch (err) {
        console.error('[SaaSAuth] Failed to log OAuth event:', err.message);
    }
}

/**
 * Get user's linked OAuth accounts
 * @param {number} userId
 * @returns {Array}
 */
async function getUserOAuthAccounts(userId) {
    const systemDb = getSystemDb();
    const result = await systemDb.query(
        `SELECT id, provider, email, name, avatar_url, created_at 
         FROM user_auth_identity 
         WHERE user_id = $1`,
        [userId]
    );
    return result.rows;
}

/**
 * Unlink an OAuth account from user
 * @param {number} userId
 * @param {string} provider
 * @returns {boolean}
 */
async function unlinkOAuthAccount(userId, provider) {
    const systemDb = getSystemDb();
    const result = await systemDb.query(
        `DELETE FROM user_auth_identity WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
    );
    return result.rowCount > 0;
}

module.exports = {
    findUserByGoogleId,
    linkGoogleToUser,
    processSaaSGoogleAuth,
    generateLoginToken,
    logOAuthEvent,
    getUserOAuthAccounts,
    unlinkOAuthAccount
};
