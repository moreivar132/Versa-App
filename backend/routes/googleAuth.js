/**
 * SaaS Google OAuth Routes (B2B)
 * Handles Google OAuth 2.0 for SaaS staff/admin users
 * 
 * IMPORTANT: This is for B2B users who MUST belong to a tenant.
 * - Invite-only registration (new users need invite token)
 * - Link-only for existing users (no auto-create)
 * 
 * Routes:
 *   GET  /api/auth/google          - Initiate OAuth flow
 *   GET  /api/auth/google/callback - Handle Google callback
 *   GET  /api/auth/google/status   - Check if Google OAuth is configured
 */

const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const router = express.Router();
const googleAuthService = require('../services/googleAuthService');

// State tokens store (in-memory, short-lived)
const stateTokens = new Map();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and store a state token for CSRF protection
 * @param {string} redirectTo - Where to redirect after auth
 * @param {string|null} inviteToken - Optional invite token to preserve through OAuth flow
 * @returns {string} State token
 */
function generateStateToken(redirectTo = '/', inviteToken = null) {
    const token = crypto.randomBytes(32).toString('hex');
    stateTokens.set(token, {
        redirectTo,
        inviteToken,
        createdAt: Date.now()
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
 * @param {string} token - State token to validate
 * @returns {Object|null} State data or null if invalid
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
 * Get frontend base URL for redirects
 */
/**
 * Get frontend base URL for redirects
 */
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
 * GET /api/auth/google
 * Initiate Google OAuth flow for SaaS users
 * Query params:
 *   - redirect: URL to redirect after successful auth (final destination)
 *   - invite: Optional invite token for new user registration
 * 
 * NOTE: After OAuth, we redirect to login-finsaas.html with the token,
 * which processes it and then redirects to the final destination.
 */
router.get('/google', (req, res, next) => {
    // The final destination after token processing
    const finalRedirect = req.query.redirect || '/src/verticals/finsaas/pages/dashboard.html';
    // We redirect to login first, which will handle token and redirect to finalRedirect
    const redirectTo = `/login-finsaas.html?redirect=${encodeURIComponent(finalRedirect)}`;
    const inviteToken = req.query.invite || null;

    const state = generateStateToken(redirectTo, inviteToken);

    passport.authenticate('google', {
        scope: ['openid', 'email', 'profile'],
        state,
        session: false
    })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback for SaaS users
 */
router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${getFrontendBaseUrl()}/login-finsaas.html?error=google_auth_failed`
    }, async (err, googleProfile, info) => {
        try {
            // Handle authentication errors
            if (err) {
                console.error('[SaaSAuth] Passport error:', err);
                return res.redirect(`${getFrontendBaseUrl()}/login-finsaas.html?error=auth_error`);
            }

            if (!googleProfile) {
                console.error('[SaaSAuth] No profile returned');
                return res.redirect(`${getFrontendBaseUrl()}/login-finsaas.html?error=no_profile`);
            }

            // Validate state token
            const stateToken = req.query.state;
            const stateData = consumeStateToken(stateToken);

            if (!stateData) {
                console.error('[SaaSAuth] Invalid or expired state token');
                return res.redirect(`${getFrontendBaseUrl()}/login-finsaas.html?error=invalid_state`);
            }

            // Process SaaS authentication (invite-only for new users)
            const result = await googleAuthService.processSaaSGoogleAuth(
                {
                    providerId: googleProfile.providerId,
                    email: googleProfile.email,
                    name: googleProfile.name,
                    avatar: googleProfile.avatar
                },
                stateData.inviteToken // Pass invite token if present
            );

            // Handle errors
            if (result.error) {
                const errorMessages = {
                    'MISSING_EMAIL': 'no_email',
                    'NO_ACCOUNT_NO_INVITE': 'no_account',
                    'INVALID_INVITE': 'invalid_invite',
                    'CREATION_FAILED': 'server_error'
                };
                const errorCode = errorMessages[result.error] || 'server_error';

                console.log(`[SaaSAuth] Auth failed: ${result.error}`);
                return res.redirect(`${getFrontendBaseUrl()}/login-finsaas.html?error=${errorCode}`);
            }

            const { user, isNew } = result;

            // Generate JWT token
            const token = await googleAuthService.generateLoginToken(user);

            // Log the OAuth event
            await googleAuthService.logOAuthEvent({
                userId: user.id,
                provider: 'google',
                action: isNew ? 'saas.oauth.register' : 'saas.oauth.login',
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                metadata: { email: googleProfile.email, tenantId: user.id_tenant }
            });

            // Redirect to frontend with token
            const redirectUrl = new URL(stateData.redirectTo, getFrontendBaseUrl());
            redirectUrl.searchParams.set('token', token);
            redirectUrl.searchParams.set('oauth', 'google');
            if (isNew) {
                redirectUrl.searchParams.set('new_user', 'true');
            }

            console.log(`[SaaSAuth] Success: ${user.email} (isNew: ${isNew}, tenant: ${user.id_tenant})`);

            res.redirect(redirectUrl.toString());

        } catch (error) {
            console.error('[SaaSAuth] Callback error:', error);
            res.redirect(`${getFrontendBaseUrl()}/login-finsaas.html?error=server_error`);
        }
    })(req, res, next);
});

/**
 * GET /api/auth/google/status
 * Check if Google OAuth is configured
 */
router.get('/google/status', (req, res) => {
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    res.json({
        configured: isConfigured,
        provider: 'google'
    });
});

module.exports = router;
