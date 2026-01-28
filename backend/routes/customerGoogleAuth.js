/**
 * Customer Google OAuth Routes (Marketplace B2C)
 * Handles Google OAuth 2.0 for Marketplace customers (clientefinal)
 * 
 * IMPORTANT: This is for B2C customers who can be GLOBAL (no tenant required).
 * Uses marketplace_auth_identity table, NOT oauth_account/user_auth_identity.
 * 
 * Routes:
 *   GET  /api/cliente/auth/google          - Initiate OAuth flow for customers
 *   GET  /api/cliente/auth/google/callback - Handle Google callback for customers
 */

const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const router = express.Router();
const { generateCustomerToken } = require('../middleware/customerAuth');
const { getSystemDb } = require('../src/core/db/tenant-db');
const { APP_URL } = require('../config/urls');

// State tokens store (in-memory, short-lived)
const stateTokens = new Map();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and store a state token for CSRF protection
 */
function generateStateToken(redirectTo = '/cliente-dashboard.html') {
    const token = crypto.randomBytes(32).toString('hex');
    stateTokens.set(token, {
        redirectTo,
        createdAt: Date.now(),
        type: 'customer' // Mark as customer OAuth
    });

    // Cleanup old tokens
    for (const [key, value] of stateTokens.entries()) {
        if (Date.now() - value.createdAt > STATE_TTL) {
            stateTokens.delete(key);
        }
    }

    return token;
}

/**
 * Validate and consume a state token
 */
function consumeStateToken(token) {
    const state = stateTokens.get(token);
    if (!state) return null;

    stateTokens.delete(token);

    if (Date.now() - state.createdAt > STATE_TTL) {
        return null;
    }

    return state;
}

/**
 * Find or create marketplace customer from Google profile
 * Uses marketplace_auth_identity table for OAuth links
 * Creates clientefinal WITHOUT tenant (global B2C customer)
 */
async function findOrCreateMarketplaceCustomer(googleProfile) {
    const { providerId, email, name, avatar } = googleProfile;
    const systemDb = getSystemDb();

    if (!email) {
        throw new Error('Google profile must include email');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if OAuth identity already exists
    const existingIdentity = await systemDb.query(
        `SELECT mai.*, cf.id as cliente_id, cf.nombre, cfa.id as auth_id
         FROM marketplace_auth_identity mai
         JOIN clientefinal cf ON mai.customer_id = cf.id
         LEFT JOIN clientefinal_auth cfa ON cfa.id_cliente = cf.id
         WHERE mai.provider = 'google' 
           AND mai.provider_subject = $1`,
        [providerId]
    );

    if (existingIdentity.rows.length > 0) {
        const row = existingIdentity.rows[0];
        return {
            id: row.auth_id || row.cliente_id, // Use auth_id if exists, otherwise cliente_id
            id_cliente: row.cliente_id,
            email: normalizedEmail,
            nombre: row.nombre,
            isNew: false
        };
    }

    // 2. Check if customer auth exists by email
    const existingAuth = await systemDb.query(
        `SELECT cfa.*, cf.nombre
         FROM clientefinal_auth cfa
         JOIN clientefinal cf ON cfa.id_cliente = cf.id
         WHERE cfa.email = $1`,
        [normalizedEmail]
    );

    if (existingAuth.rows.length > 0) {
        // Link Google to existing customer account
        const customer = existingAuth.rows[0];

        // Create marketplace_auth_identity link
        await systemDb.query(
            `INSERT INTO marketplace_auth_identity 
             (customer_id, provider, provider_subject, email, name, avatar_url)
             VALUES ($1, 'google', $2, $3, $4, $5)
             ON CONFLICT (provider, provider_subject) DO NOTHING`,
            [customer.id_cliente, providerId, normalizedEmail, name, avatar]
        );

        console.log(`[MarketplaceAuth] Linked Google to existing customer: ${normalizedEmail}`);

        return {
            id: customer.id,
            id_cliente: customer.id_cliente,
            email: normalizedEmail,
            nombre: customer.nombre,
            isNew: false
        };
    }

    // 3. Create new global customer (NO TENANT - B2C)
    // 3. Create new global customer (NO TENANT - B2C)
    try {
        const customer = await systemDb.txWithRLS(async (tx) => {
            // Create clientefinal WITHOUT tenant (id_tenant = NULL for global customers)
            const clienteResult = await tx.query(
                `INSERT INTO clientefinal (nombre, email, telefono, id_tenant)
                 VALUES ($1, $2, NULL, NULL)
                 RETURNING id`,
                [name || 'Usuario Google', normalizedEmail]
            );
            const clienteId = clienteResult.rows[0].id;

            // Create clientefinal_auth (no password for OAuth-only users)
            const authResult = await tx.query(
                `INSERT INTO clientefinal_auth (id_cliente, email, password_hash, is_google_auth)
                 VALUES ($1, $2, NULL, true)
                 RETURNING id`,
                [clienteId, normalizedEmail]
            );
            const authId = authResult.rows[0].id;

            // Create marketplace_auth_identity link
            await tx.query(
                `INSERT INTO marketplace_auth_identity 
                 (customer_id, provider, provider_subject, email, name, avatar_url)
                 VALUES ($1, 'google', $2, $3, $4, $5)`,
                [clienteId, providerId, normalizedEmail, name, avatar]
            );

            process.nextTick(() => console.log(`[MarketplaceAuth] Created new global customer: ${normalizedEmail} (id: ${clienteId})`));

            return {
                id: authId,
                id_cliente: clienteId,
                email: normalizedEmail,
                nombre: name || 'Usuario Google',
                isNew: true
            };
        });

        return customer;
    } catch (error) {
        throw error;
    }
}

function getFrontendBaseUrl() {
    if (process.env.FRONTEND_BASE_URL) {
        return process.env.FRONTEND_BASE_URL.replace(/\/$/, '');
    }

    // In production, do not default to localhost
    if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: FRONTEND_BASE_URL not set in Production.');
    }

    return 'http://localhost:5173';
}

/**
 * GET /api/cliente/auth/google
 * Initiate Google OAuth flow for marketplace customers
 */
router.get('/google', (req, res, next) => {
    const redirectTo = req.query.redirect || '/cliente-dashboard.html';
    const state = generateStateToken(redirectTo);

    // Customer-specific callback URL
    const callbackURL = `${APP_URL}/api/cliente/auth/google/callback`;

    passport.authenticate('google', {
        scope: ['openid', 'email', 'profile'],
        state,
        session: false,
        callbackURL
    })(req, res, next);
});

/**
 * GET /api/cliente/auth/google/callback
 * Handle Google OAuth callback for marketplace customers
 */
router.get('/google/callback', (req, res, next) => {
    const callbackURL = `${APP_URL}/api/cliente/auth/google/callback`;

    passport.authenticate('google', {
        session: false,
        callbackURL,
        failureRedirect: `${getFrontendBaseUrl()}/cliente-login.html?error=google_auth_failed`
    }, async (err, googleProfile, info) => {
        try {
            if (err || !googleProfile) {
                console.error('[MarketplaceAuth] Error:', err);
                return res.redirect(`${getFrontendBaseUrl()}/cliente-login.html?error=auth_error`);
            }

            // Validate state token
            const state = req.query.state;
            const stateData = consumeStateToken(state);

            if (!stateData) {
                return res.redirect(`${getFrontendBaseUrl()}/cliente-login.html?error=invalid_state`);
            }

            // Find or create marketplace customer (global, no tenant)
            const customer = await findOrCreateMarketplaceCustomer({
                providerId: googleProfile.providerId,
                email: googleProfile.email,
                name: googleProfile.name,
                avatar: googleProfile.avatar
            });

            // Generate customer JWT token
            const token = generateCustomerToken({
                id: customer.id,
                id_cliente: customer.id_cliente,
                email: customer.email
            });

            // Log the OAuth event
            const systemDb = getSystemDb();
            try {
                await systemDb.query(
                    `INSERT INTO audit_logs (action, entity_type, entity_id, after_json, ip_address, user_agent)
                     VALUES ($1, 'clientefinal', $2, $3, $4, $5)`,
                    [
                        customer.isNew ? 'marketplace.oauth.register' : 'marketplace.oauth.login',
                        String(customer.id_cliente),
                        JSON.stringify({ provider: 'google', email: customer.email }),
                        req.ip?.substring(0, 45),
                        req.headers['user-agent']?.substring(0, 500)
                    ]
                );
            } catch (logErr) {
                console.error('[MarketplaceAuth] Audit log error:', logErr.message);
            }

            // Redirect to frontend with token
            const redirectUrl = new URL(stateData.redirectTo, getFrontendBaseUrl());
            redirectUrl.searchParams.set('token', token);
            redirectUrl.searchParams.set('oauth', 'google');
            if (customer.isNew) {
                redirectUrl.searchParams.set('new_user', 'true');
            }

            console.log(`[MarketplaceAuth] Success: ${customer.email} (isNew: ${customer.isNew})`);

            res.redirect(redirectUrl.toString());

        } catch (error) {
            console.error('[MarketplaceAuth] Callback error:', error);
            res.redirect(`${getFrontendBaseUrl()}/cliente-login.html?error=server_error`);
        }
    })(req, res, next);
});

module.exports = router;
