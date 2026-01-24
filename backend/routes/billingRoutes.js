// routes/billingRoutes.js
/**
 * Billing API Routes
 * 
 * Endpoints for subscription management:
 * - POST /checkout-session - Create checkout for plan upgrade
 * - POST /portal-session - Create Stripe Customer Portal session
 * - GET /my-subscription - Get current subscription details
 * - GET /plans - List available plans
 * - POST /create-trial - Create trial subscription (internal)
 * 
 * NOTE: These routes are EXEMPT from subscription checks
 * so users can always access billing functionality.
 */

const express = require('express');
const router = express.Router();
const { getSystemDb, getTenantDb } = require('../src/core/db/tenant-db');
const verifyJWT = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const trialService = require('../services/trialService');
const emailService = require('../services/emailService');
const { APP_URL } = require('../config/urls');

// ============================================================
// PUBLIC ROUTES (No auth required)
// ============================================================

/**
 * GET /api/billing/plans
 * List available plans with features (public)
 */
router.get('/plans', async (req, res) => {
    try {
        const db = getSystemDb();
        const result = await db.query(`
            SELECT 
                id,
                nombre,
                plan_key,
                descripcion,
                trial_dias_default,
                incluye_marketplace,
                incluye_crm,
                features_json,
                activo
            FROM plan_suscripcion
            WHERE activo = true AND plan_key != 'trial_full_15d'
            ORDER BY id ASC
        `);

        res.json({
            ok: true,
            plans: result.rows.map(p => ({
                id: p.id,
                name: p.nombre,
                planKey: p.plan_key,
                description: p.descripcion,
                trialDays: p.trial_dias_default,
                features: p.features_json || {},
                includesMarketplace: p.incluye_marketplace,
                includesCrm: p.incluye_crm
            }))
        });
    } catch (error) {
        console.error('[Billing] Error fetching plans:', error);
        res.status(500).json({ ok: false, error: 'Error obteniendo planes' });
    }
});

// ============================================================
// AUTHENTICATED ROUTES
// ============================================================

/**
 * GET /api/billing/my-subscription
 * Get current subscription for authenticated tenant
 */
router.get('/my-subscription', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const isSuperAdmin = req.user.is_super_admin;

        if (isSuperAdmin) {
            return res.json({
                ok: true,
                isSuperAdmin: true,
                subscription: null,
                message: 'Super Admin - sin restricciones de suscripción'
            });
        }

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no identificado' });
        }

        // Use tenant DB
        const db = getTenantDb({ tenantId });

        const result = await db.query(`
            SELECT 
                ts.*,
                ps.nombre as plan_nombre,
                ps.plan_key,
                ps.descripcion as plan_descripcion,
                ps.features_json as plan_features
            FROM tenant_suscripcion ts
            LEFT JOIN plan_suscripcion ps ON ts.plan_id = ps.id
            WHERE ts.tenant_id = $1
            ORDER BY ts.created_at DESC
            LIMIT 1
        `, [tenantId]);

        if (result.rows.length === 0) {
            return res.json({
                ok: true,
                subscription: null,
                message: 'No hay suscripción activa'
            });
        }

        const sub = result.rows[0];

        // Calculate trial days remaining if applicable
        let trialDaysRemaining = null;
        if (sub.status === 'trialing' && sub.trial_end_at) {
            const trialEnd = new Date(sub.trial_end_at);
            const now = new Date();
            trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)));
        }

        res.json({
            ok: true,
            subscription: {
                id: sub.id,
                status: sub.status,
                planId: sub.plan_id,
                planName: sub.plan_nombre,
                planKey: sub.plan_key,
                planDescription: sub.plan_descripcion,
                features: sub.plan_features || {},
                stripeCustomerId: sub.stripe_customer_id,
                stripeSubscriptionId: sub.stripe_subscription_id,
                trialStartAt: sub.trial_start_at,
                trialEndAt: sub.trial_end_at,
                trialDaysRemaining,
                currentPeriodStart: sub.current_period_start,
                currentPeriodEnd: sub.current_period_end,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
                cancelAt: sub.cancel_at,
                pastDueSince: sub.past_due_since,
                graceUntil: sub.grace_until
            }
        });

    } catch (error) {
        console.error('[Billing] Error fetching subscription:', error);
        res.status(500).json({ ok: false, error: 'Error obteniendo suscripción' });
    }
});

/**
 * POST /api/billing/checkout-session
 * Create a Stripe checkout session for subscription
 */
router.post('/checkout-session', verifyJWT, async (req, res) => {
    try {
        const { planKey, billingCycle = 'monthly' } = req.body;
        const tenantId = req.user.tenant_id;
        const userEmail = req.user.email;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no identificado' });
        }

        if (!planKey || !['basic', 'pro', 'business'].includes(planKey)) {
            return res.status(400).json({
                ok: false,
                error: 'Plan inválido. Valores permitidos: basic, pro, business'
            });
        }

        if (!['monthly', 'yearly'].includes(billingCycle)) {
            return res.status(400).json({
                ok: false,
                error: 'Ciclo de facturación inválido. Valores permitidos: monthly, yearly'
            });
        }

        // Use tenant DB
        const db = getTenantDb({ tenantId });

        // Get plan from database
        const planResult = await db.query(`
            SELECT id, plan_key, precio_mensual_stripe_price_id, precio_anual_stripe_price_id
            FROM plan_suscripcion
            WHERE plan_key = $1 AND activo = true
        `, [planKey]);

        if (planResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: `Plan "${planKey}" no encontrado` });
        }

        const plan = planResult.rows[0];
        const priceId = billingCycle === 'monthly'
            ? plan.precio_mensual_stripe_price_id
            : plan.precio_anual_stripe_price_id;

        if (!priceId) {
            return res.status(400).json({
                ok: false,
                error: `No hay precio configurado para ${planKey} (${billingCycle})`
            });
        }

        // Get or create Stripe customer
        let stripeCustomerId = null;
        const existingSub = await db.query(
            'SELECT stripe_customer_id FROM tenant_suscripcion WHERE tenant_id = $1',
            [tenantId]
        );

        if (existingSub.rows.length > 0 && existingSub.rows[0].stripe_customer_id) {
            stripeCustomerId = existingSub.rows[0].stripe_customer_id;
        }

        // Create checkout session
        const successUrl = `${APP_URL}/manager-taller-billing.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${APP_URL}/manager-taller-billing.html?checkout=cancel`;

        const session = await stripeService.createSubscriptionCheckoutSession({
            priceId,
            tenantId,
            planKey,
            billingCycle,
            email: userEmail,
            successUrl,
            cancelUrl,
            stripeCustomerId
        });

        // Save checkout session ID
        await db.query(`
            UPDATE tenant_suscripcion 
            SET stripe_checkout_session_id_last = $1
            WHERE tenant_id = $2
        `, [session.id, tenantId]);

        res.json({
            ok: true,
            url: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('[Billing] Error creating checkout session:', error);
        res.status(500).json({ ok: false, error: 'Error creando sesión de checkout' });
    }
});

/**
 * POST /api/billing/portal-session
 * Create Stripe Customer Portal session for subscription management
 */
router.post('/portal-session', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no identificado' });
        }

        const db = getTenantDb({ tenantId });

        // Get Stripe customer ID
        const subResult = await db.query(
            'SELECT stripe_customer_id FROM tenant_suscripcion WHERE tenant_id = $1',
            [tenantId]
        );

        if (subResult.rows.length === 0 || !subResult.rows[0].stripe_customer_id) {
            return res.status(400).json({
                ok: false,
                error: 'No hay un cliente de Stripe asociado. Primero debes suscribirte a un plan.'
            });
        }

        const stripeCustomerId = subResult.rows[0].stripe_customer_id;
        const returnUrl = `${APP_URL}/manager-taller-billing.html`;

        const { portal_url } = await stripeService.createPortalSession({
            stripe_customer_id: stripeCustomerId,
            return_url: returnUrl
        });

        res.json({
            ok: true,
            url: portal_url
        });

    } catch (error) {
        console.error('[Billing] Error creating portal session:', error);
        res.status(500).json({ ok: false, error: 'Error creando sesión del portal' });
    }
});

/**
 * POST /api/billing/create-trial
 * Create trial subscription for tenant (if eligible)
 */
router.post('/create-trial', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no identificado' });
        }

        const result = await trialService.ensureTrial15DaysIfEligible(tenantId);

        res.json({
            ok: true,
            created: result.created,
            subscription: result.subscription,
            message: result.reason
        });

    } catch (error) {
        console.error('[Billing] Error creating trial:', error);
        res.status(500).json({ ok: false, error: 'Error creando trial' });
    }
});

/**
 * GET /api/billing/trial-status
 * Check trial status and days remaining
 */
router.get('/trial-status', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no identificado' });
        }

        const daysRemaining = await trialService.getTrialDaysRemaining(tenantId);
        const { expired } = await trialService.checkTrialExpiration(tenantId);

        res.json({
            ok: true,
            inTrial: daysRemaining !== null && daysRemaining > 0,
            daysRemaining,
            expired
        });

    } catch (error) {
        console.error('[Billing] Error checking trial:', error);
        res.status(500).json({ ok: false, error: 'Error verificando trial' });
    }
});

/**
 * POST /api/billing/start-trial (PUBLIC - no auth required)
 * Register new user and start 15-day free trial
 * 
 * This endpoint creates:
 * 1. A new tenant if email doesn't exist
 * 2. A new user with that email
 * 3. A trial subscription for 15 days with BUSINESS features
 */
router.post('/start-trial', async (req, res) => {
    try {
        const { email, nombre, empresa } = req.body;

        if (!email) {
            return res.status(400).json({ ok: false, error: 'Email requerido' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ ok: false, error: 'Email inválido' });
        }

        // Use System DB for creation flow
        const systemDb = getSystemDb();

        // Check if user already exists
        const existingUser = await systemDb.query(
            'SELECT id, email, id_tenant FROM usuario WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            // User exists - redirect to login
            return res.json({
                ok: true,
                exists: true,
                message: 'Ya tienes una cuenta. Por favor inicia sesión.',
                redirectUrl: '/login.html'
            });
        }

        // Create new tenant
        const tenantName = empresa || `Empresa de ${nombre || email.split('@')[0]}`;
        const tenantResult = await systemDb.query(`
            INSERT INTO tenant (nombre, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
            RETURNING id, nombre
        `, [tenantName]);

        const tenantId = tenantResult.rows[0].id;

        // Create default sucursal for tenant
        await systemDb.query(`
            INSERT INTO sucursal (nombre, id_tenant, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
        `, ['Principal', tenantId]);

        // Generate temporary password
        const bcrypt = require('bcryptjs');
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create user
        const userResult = await systemDb.query(`
            INSERT INTO usuario (email, password_hash, nombre, id_tenant, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, email, nombre, id_tenant
        `, [email, hashedPassword, nombre || email.split('@')[0], tenantId]);

        const user = userResult.rows[0];

        // Find or create Admin role for this tenant
        let adminRoleId;
        const existingRole = await systemDb.query(
            'SELECT id FROM rol WHERE nombre = $1 AND (tenant_id = $2 OR scope = $3)',
            ['Administrador', tenantId, 'global']
        );

        if (existingRole.rows.length > 0) {
            adminRoleId = existingRole.rows[0].id;
        } else {
            // Create tenant-specific admin role
            const newRole = await systemDb.query(`
                INSERT INTO rol (nombre, display_name, scope, tenant_id, level, created_at)
                VALUES ($1, $2, 'tenant', $3, 100, NOW())
                RETURNING id
            `, ['Administrador', 'Administrador', tenantId]);
            adminRoleId = newRole.rows[0].id;

            // Assign ALL permissions to this new Admin role
            await systemDb.query(`
                INSERT INTO rolpermiso (id_rol, id_permiso)
                SELECT $1, id
                FROM permiso
            `, [adminRoleId]);
        }

        // Assign admin role to user
        await systemDb.query(`
            INSERT INTO usuariorol (id_usuario, id_rol, tenant_id, assigned_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT DO NOTHING
        `, [user.id, adminRoleId, tenantId]);

        // Create trial subscription
        const trialResult = await trialService.ensureTrial15DaysIfEligible(tenantId);

        // Send emails asynchronously
        Promise.all([
            emailService.sendTempPasswordEmail(email, tempPassword),
            emailService.sendWelcomeEmail(email, nombre || email.split('@')[0], 15)
        ]).catch(err => console.error('Error sending emails:', err));

        // Generate JWT token for immediate login
        // IMPORTANT: Use id_tenant (not tenant_id) to match all routes that expect req.user.id_tenant
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                id_tenant: user.id_tenant,  // Must match what routes expect
                tipo: 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );



        res.json({
            ok: true,
            created: true,
            message: '¡Trial de 15 días activado!',
            token,
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                tipo: 'admin',
                id_tenant: user.id_tenant
            },
            trial: {
                daysRemaining: 15,
                endsAt: trialResult.subscription?.trial_end_at
            },
            redirectUrl: '/manager-taller-inicio.html',
            tempPassword // Remove in production, send by email instead
        });

    } catch (error) {
        console.error('[Billing] Error starting trial:', error);
        res.status(500).json({ ok: false, error: 'Error iniciando trial: ' + error.message });
    }
});

module.exports = router;
