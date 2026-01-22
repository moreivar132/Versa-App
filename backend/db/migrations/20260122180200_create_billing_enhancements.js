/**
 * Migration: create_billing_enhancements
 * Source: backend/archive/legacy-migrations/create_billing_enhancements.sql
 * Module: Core/Shared
 * Risk Level: Medio
 * 
 * Enhances billing/subscription system with:
 * - stripe_event_log: webhook idempotency
 * - Enhanced plan_suscripcion columns (plan_key, features_json)
 * - Enhanced tenant_suscripcion columns (past_due tracking)
 * - Helper function: tenant_has_active_subscription
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating billing enhancements...');

    await knex.raw(`
        -- ================================================================
        -- 1. STRIPE EVENT LOG (Idempotency)
        -- ================================================================
        CREATE TABLE IF NOT EXISTS stripe_event_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            stripe_event_id TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            created INTEGER NOT NULL,
            payload_json JSONB,
            processed_at TIMESTAMPTZ DEFAULT NOW(),
            processing_error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_stripe_event_log_event_id ON stripe_event_log(stripe_event_id);
        CREATE INDEX IF NOT EXISTS idx_stripe_event_log_type ON stripe_event_log(type);
        CREATE INDEX IF NOT EXISTS idx_stripe_event_log_processed ON stripe_event_log(processed_at);

        COMMENT ON TABLE stripe_event_log IS 'Stores processed Stripe webhook events for idempotency';
        COMMENT ON COLUMN stripe_event_log.stripe_event_id IS 'Unique event ID from Stripe (evt_xxx)';
        COMMENT ON COLUMN stripe_event_log.type IS 'Event type (e.g., checkout.session.completed)';
        COMMENT ON COLUMN stripe_event_log.created IS 'Unix timestamp when Stripe created the event';

        -- ================================================================
        -- 2. ENHANCE PLAN_SUSCRIPCION TABLE
        -- ================================================================
        ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS plan_key TEXT;
        ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS features_json JSONB DEFAULT '{}';
        ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS incluye_marketplace BOOLEAN DEFAULT true;
        ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS incluye_crm BOOLEAN DEFAULT true;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_suscripcion_plan_key 
        ON plan_suscripcion(plan_key) WHERE plan_key IS NOT NULL;

        -- Update existing plans with plan_key based on nombre
        UPDATE plan_suscripcion 
        SET plan_key = LOWER(nombre) 
        WHERE plan_key IS NULL;

        COMMENT ON COLUMN plan_suscripcion.plan_key IS 'Internal plan key (lowercase): basic, pro, business, trial_full_15d';
        COMMENT ON COLUMN plan_suscripcion.features_json IS 'JSON object with feature flags and limits for this plan';

        -- ================================================================
        -- 3. ENHANCE TENANT_SUSCRIPCION TABLE
        -- ================================================================
        ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;
        ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
        ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS plan_key TEXT;
        ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS stripe_checkout_session_id_last TEXT;

        COMMENT ON COLUMN tenant_suscripcion.past_due_since IS 'When the subscription entered past_due status';
        COMMENT ON COLUMN tenant_suscripcion.grace_until IS 'Grace period end date for past_due subscriptions';
        COMMENT ON COLUMN tenant_suscripcion.plan_key IS 'Direct reference to plan_key for faster lookups';

        -- ================================================================
        -- 4. HELPER FUNCTION: Check if tenant has active subscription
        -- ================================================================
        CREATE OR REPLACE FUNCTION tenant_has_active_subscription(p_tenant_id INTEGER)
        RETURNS BOOLEAN AS $$
        DECLARE
            sub_status TEXT;
            trial_end TIMESTAMPTZ;
            period_end TIMESTAMPTZ;
        BEGIN
            SELECT status, trial_end_at, current_period_end 
            INTO sub_status, trial_end, period_end
            FROM tenant_suscripcion 
            WHERE tenant_id = p_tenant_id
            ORDER BY created_at DESC
            LIMIT 1;
            
            IF sub_status IS NULL THEN
                RETURN FALSE;
            END IF;
            
            IF sub_status = 'trialing' AND trial_end >= NOW() THEN
                RETURN TRUE;
            END IF;
            
            IF sub_status = 'active' AND period_end >= NOW() THEN
                RETURN TRUE;
            END IF;
            
            RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql;

        COMMENT ON FUNCTION tenant_has_active_subscription IS 'Returns true if tenant has an active or valid trialing subscription';
    `);

    console.log('[Migration] ✅ Billing enhancements created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Reverting billing enhancements...');

    await knex.raw(`
        DROP FUNCTION IF EXISTS tenant_has_active_subscription(INTEGER);
        
        -- Note: Column drops from existing tables are risky, skipping for safety
        -- ALTER TABLE tenant_suscripcion DROP COLUMN IF EXISTS past_due_since;
        -- ALTER TABLE tenant_suscripcion DROP COLUMN IF EXISTS grace_until;
        -- etc.
        
        DROP TABLE IF EXISTS stripe_event_log CASCADE;
    `);

    console.log('[Migration] ✅ Billing enhancements reverted (columns preserved for safety)');
};

exports.config = { transaction: true };
