-- ================================================================
-- BILLING ENHANCEMENTS MIGRATION
-- ================================================================
-- Adds:
-- 1. stripe_event_log table for webhook idempotency
-- 2. plan_key and features_json columns to plan_suscripcion
-- 3. past_due tracking columns to tenant_suscripcion
-- ================================================================

-- ================================================================
-- 1. STRIPE EVENT LOG (Idempotency)
-- ================================================================
-- Ensures each Stripe webhook event is processed only once

CREATE TABLE IF NOT EXISTS stripe_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    created INTEGER NOT NULL, -- Unix timestamp from Stripe
    payload_json JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    processing_error TEXT
);

-- Index for fast lookup by stripe_event_id
CREATE INDEX IF NOT EXISTS idx_stripe_event_log_event_id ON stripe_event_log(stripe_event_id);
-- Index for querying by type
CREATE INDEX IF NOT EXISTS idx_stripe_event_log_type ON stripe_event_log(type);
-- Index for cleanup of old events
CREATE INDEX IF NOT EXISTS idx_stripe_event_log_processed ON stripe_event_log(processed_at);

COMMENT ON TABLE stripe_event_log IS 'Stores processed Stripe webhook events for idempotency';
COMMENT ON COLUMN stripe_event_log.stripe_event_id IS 'Unique event ID from Stripe (evt_xxx)';
COMMENT ON COLUMN stripe_event_log.type IS 'Event type (e.g., checkout.session.completed)';
COMMENT ON COLUMN stripe_event_log.created IS 'Unix timestamp when Stripe created the event';

-- ================================================================
-- 2. ENHANCE PLAN_SUSCRIPCION TABLE
-- ================================================================

-- Add plan_key for internal reference (lowercase: basic, pro, business, trial_full_15d)
ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS plan_key TEXT;

-- Add features_json for granular feature control
ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS features_json JSONB DEFAULT '{}';

-- Add incluye_marketplace and incluye_crm if not exist (for backward compatibility)
ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS incluye_marketplace BOOLEAN DEFAULT true;
ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS incluye_crm BOOLEAN DEFAULT true;

-- Create unique index on plan_key (only for non-null values)
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

-- Add past_due tracking
ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

-- Add grace period until (optional, for allowing limited access during past_due)
ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

-- Add plan_key reference for easier lookups
ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS plan_key TEXT;

-- Add last checkout session ID for recovery
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
    
    -- No subscription found
    IF sub_status IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check trialing status with valid trial period
    IF sub_status = 'trialing' AND trial_end >= NOW() THEN
        RETURN TRUE;
    END IF;
    
    -- Check active status with valid period
    IF sub_status = 'active' AND period_end >= NOW() THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION tenant_has_active_subscription IS 'Returns true if tenant has an active or valid trialing subscription';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
