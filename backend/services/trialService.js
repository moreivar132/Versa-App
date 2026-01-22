// services/trialService.js
/**
 * Trial Service - Manages 15-day free trial for new tenants
 * 
 * Key functions:
 * - ensureTrial15DaysIfEligible(id_tenant) - Creates trial if eligible
 * - checkTrialExpiration(id_tenant) - Checks/updates expired trials
 * - getTrialPlan() - Returns the trial plan configuration
 */

const { getSystemDb } = require('../src/core/db/tenant-db');

/**
 * Get the trial plan from database
 * @returns {Promise<Object|null>} Trial plan or null
 */
async function getTrialPlan() {
    const db = getSystemDb();
    const result = await db.query(
        `SELECT * FROM plan_suscripcion WHERE plan_key = 'trial_full_15d' AND activo = true LIMIT 1`
    );
    return result.rows[0] || null;
}

/**
 * Check if a tenant is eligible for the free trial
 * A tenant is eligible if they have NO existing subscription record
 * 
 * @param {number} idTenant - Tenant ID
 * @returns {Promise<boolean>} True if eligible for trial
 */
async function isEligibleForTrial(idTenant) {
    const db = getSystemDb();
    const result = await db.query(
        `SELECT id FROM tenant_suscripcion WHERE tenant_id = $1 LIMIT 1`,
        [idTenant]
    );
    return result.rows.length === 0;
}

/**
 * Creates a 15-day free trial subscription if the tenant is eligible
 * Trial has same features as BUSINESS plan (full access)
 * 
 * @param {number} idTenant - Tenant ID
 * @returns {Promise<Object>} { created: boolean, subscription: object, reason: string }
 */
async function ensureTrial15DaysIfEligible(idTenant) {
    const db = getSystemDb();
    try {
        console.log(`[Trial] Checking trial eligibility for tenant ${idTenant}`);

        // Check if tenant exists
        const tenantCheck = await db.query(
            'SELECT id FROM tenant WHERE id = $1',
            [idTenant]
        );

        if (tenantCheck.rows.length === 0) {
            return {
                created: false,
                subscription: null,
                reason: 'Tenant no encontrado'
            };
        }

        // Check eligibility
        const eligible = await isEligibleForTrial(idTenant);

        if (!eligible) {
            console.log(`[Trial] Tenant ${idTenant} already has a subscription, skipping trial`);

            // Return existing subscription
            const existingSub = await db.query(
                `SELECT ts.*, ps.nombre as plan_nombre, ps.plan_key
                 FROM tenant_suscripcion ts
                 JOIN plan_suscripcion ps ON ts.plan_id = ps.id
                 WHERE ts.tenant_id = $1
                 ORDER BY ts.created_at DESC
                 LIMIT 1`,
                [idTenant]
            );

            return {
                created: false,
                subscription: existingSub.rows[0] || null,
                reason: 'Ya existe una suscripción para este tenant'
            };
        }

        // Get trial plan
        const trialPlan = await getTrialPlan();

        if (!trialPlan) {
            console.error('[Trial] Trial plan (trial_full_15d) not found in database!');
            return {
                created: false,
                subscription: null,
                reason: 'Plan de trial no configurado en el sistema'
            };
        }

        // Calculate trial dates
        const now = new Date();
        const trialEnd = new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)); // 15 days from now

        // Create trial subscription
        const result = await db.query(`
            INSERT INTO tenant_suscripcion (
                tenant_id,
                plan_id,
                plan_key,
                status,
                trial_start_at,
                trial_end_at,
                current_period_start,
                current_period_end
            ) VALUES ($1, $2, $3, 'trialing', $4, $5, $4, $5)
            RETURNING *
        `, [
            idTenant,
            trialPlan.id,
            'trial_full_15d',
            now,
            trialEnd
        ]);

        const subscription = result.rows[0];

        console.log(`[Trial] ✅ Created 15-day trial for tenant ${idTenant}, expires: ${trialEnd.toISOString()}`);

        return {
            created: true,
            subscription: {
                ...subscription,
                plan_nombre: trialPlan.nombre,
                plan_key: trialPlan.plan_key
            },
            reason: 'Trial de 15 días creado exitosamente'
        };

    } catch (error) {
        console.error('[Trial] Error creating trial:', error);
        throw error;
    }
}

/**
 * Check if a tenant's trial has expired and update status accordingly
 * Should be called on login or critical actions
 * 
 * @param {number} idTenant - Tenant ID
 * @returns {Promise<Object>} { expired: boolean, subscription: object }
 */
async function checkTrialExpiration(idTenant) {
    const db = getSystemDb();
    try {
        const result = await db.query(`
            SELECT ts.*, ps.plan_key
            FROM tenant_suscripcion ts
            JOIN plan_suscripcion ps ON ts.plan_id = ps.id
            WHERE ts.tenant_id = $1
            ORDER BY ts.created_at DESC
            LIMIT 1
        `, [idTenant]);

        if (result.rows.length === 0) {
            return { expired: false, subscription: null };
        }

        const subscription = result.rows[0];

        // Only check expiration for 'trialing' status without Stripe subscription
        if (subscription.status !== 'trialing' || subscription.stripe_subscription_id) {
            return { expired: false, subscription };
        }

        const now = new Date();
        const trialEnd = new Date(subscription.trial_end_at);

        if (now > trialEnd) {
            console.log(`[Trial] Trial expired for tenant ${idTenant}, updating status to canceled`);

            // Update to canceled
            await db.query(`
                UPDATE tenant_suscripcion 
                SET status = 'canceled',
                cancel_at = NOW(),
                updated_at = NOW()
                WHERE tenant_id = $1
            `, [idTenant]);

            return {
                expired: true,
                subscription: {
                    ...subscription,
                    status: 'canceled'
                }
            };
        }

        return { expired: false, subscription };

    } catch (error) {
        console.error('[Trial] Error checking trial expiration:', error);
        throw error;
    }
}

/**
 * Get remaining trial days for a tenant
 * @param {number} idTenant - Tenant ID
 * @returns {Promise<number|null>} Days remaining or null if not in trial
 */
async function getTrialDaysRemaining(idTenant) {
    const db = getSystemDb();
    const result = await db.query(`
        SELECT trial_end_at, status
        FROM tenant_suscripcion 
        WHERE tenant_id = $1 AND status = 'trialing'
        LIMIT 1
    `, [idTenant]);

    if (result.rows.length === 0) {
        return null;
    }

    const trialEnd = new Date(result.rows[0].trial_end_at);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();

    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/**
 * Extend trial by additional days (admin function)
 * @param {number} idTenant - Tenant ID
 * @param {number} additionalDays - Days to add
 * @returns {Promise<Object>} Updated subscription
 */
async function extendTrial(idTenant, additionalDays = 7) {
    const db = getSystemDb();
    const result = await db.query(`
        UPDATE tenant_suscripcion 
        SET trial_end_at = trial_end_at + INTERVAL '${additionalDays} days',
            current_period_end = current_period_end + INTERVAL '${additionalDays} days',
            updated_at = NOW()
        WHERE tenant_id = $1 AND status = 'trialing'
        RETURNING *
    `, [idTenant]);

    if (result.rows.length === 0) {
        throw new Error('No active trial found for this tenant');
    }

    console.log(`[Trial] Extended trial for tenant ${idTenant} by ${additionalDays} days`);
    return result.rows[0];
}

module.exports = {
    getTrialPlan,
    isEligibleForTrial,
    ensureTrial15DaysIfEligible,
    checkTrialExpiration,
    getTrialDaysRemaining,
    extendTrial
};
