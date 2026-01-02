-- =====================================================
-- VERSA - Email Config Table
-- Stores per-tenant webhook configuration for email sending
-- =====================================================

CREATE TABLE IF NOT EXISTS email_config (
    id SERIAL PRIMARY KEY,
    id_tenant INTEGER NOT NULL,
    
    -- Webhook configuration
    webhook_url TEXT,                        -- Make.com webhook URL
    webhook_type VARCHAR(50) DEFAULT 'MAKE', -- MAKE, ZAPIER, N8N, etc.
    
    -- Sender info (passed to webhook)
    sender_name TEXT DEFAULT 'VERSA',
    sender_email TEXT DEFAULT 'noreply@versa.app',
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    last_test_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),  -- SUCCESS, FAILED
    last_test_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(id_tenant)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_email_config_tenant ON email_config(id_tenant);

-- Comment
COMMENT ON TABLE email_config IS 'Per-tenant configuration for email webhook (Make.com, Zapier, etc.)';
