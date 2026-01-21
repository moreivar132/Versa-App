-- ================================================================
-- DUAL AUTH ARCHITECTURE MIGRATION
-- ================================================================
-- Separates Marketplace (B2C global) from SaaS (B2B tenant-scoped)
-- ================================================================

-- ================================================================
-- 1. MARKETPLACE: Make clientefinal.id_tenant NULLABLE
-- ================================================================
-- Allows customers to be global (book at any tenant/branch)

ALTER TABLE clientefinal ALTER COLUMN id_tenant DROP NOT NULL;

COMMENT ON COLUMN clientefinal.id_tenant IS 'Optional: NULL for global marketplace customers, set for tenant-specific clients';

-- ================================================================
-- 2. MARKETPLACE: Add is_google_auth to clientefinal_auth
-- ================================================================
-- Allow OAuth-only customers (no password required)

ALTER TABLE clientefinal_auth ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE clientefinal_auth 
  ADD COLUMN IF NOT EXISTS is_google_auth BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN clientefinal_auth.is_google_auth IS 'True if customer registered via Google OAuth';

-- ================================================================
-- 3. MARKETPLACE: Create marketplace_auth_identity table
-- ================================================================
-- Links OAuth providers (Google) to marketplace customers

CREATE TABLE IF NOT EXISTS marketplace_auth_identity (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,  -- 'google', 'apple', etc.
    provider_subject VARCHAR(255) NOT NULL,  -- Provider's unique user ID (e.g., Google sub)
    email VARCHAR(255),  -- Email from provider
    name VARCHAR(255),  -- Display name from provider
    avatar_url TEXT,  -- Profile picture URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_subject)
);

-- Indexes for marketplace_auth_identity
CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_customer 
    ON marketplace_auth_identity(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_provider 
    ON marketplace_auth_identity(provider, provider_subject);
CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_email 
    ON marketplace_auth_identity(email);

COMMENT ON TABLE marketplace_auth_identity IS 'Links OAuth providers to marketplace customers (clientefinal)';

-- ================================================================
-- 4. SAAS: Create saas_invite table
-- ================================================================
-- Invitation tokens for B2B SaaS onboarding

CREATE TABLE IF NOT EXISTS saas_invite (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 hash of invite token
    tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_ADMIN',  -- Role to assign on registration
    email_allowed VARCHAR(255),  -- Optional: restrict invite to specific email
    expires_at TIMESTAMPTZ NOT NULL,  -- Invitation expiration
    used_at TIMESTAMPTZ,  -- When the invite was consumed (NULL if unused)
    created_by_user_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for saas_invite
CREATE INDEX IF NOT EXISTS idx_saas_invite_token ON saas_invite(token_hash);
CREATE INDEX IF NOT EXISTS idx_saas_invite_tenant ON saas_invite(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_invite_expires ON saas_invite(expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE saas_invite IS 'Invitation tokens for SaaS B2B user onboarding';
COMMENT ON COLUMN saas_invite.token_hash IS 'SHA-256 hash of the invite token (never store plaintext)';
COMMENT ON COLUMN saas_invite.email_allowed IS 'If set, only this email can use the invite';

-- ================================================================
-- 5. SAAS: Rename oauth_account to user_auth_identity
-- ================================================================
-- Clarity: this table is specifically for usuario (staff/SaaS users)

DO $$
BEGIN
    -- Only rename if oauth_account exists and user_auth_identity doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_account') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_auth_identity') 
    THEN
        ALTER TABLE oauth_account RENAME TO user_auth_identity;
        
        -- Rename indexes if they exist
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_oauth_account_user') THEN
            ALTER INDEX idx_oauth_account_user RENAME TO idx_user_auth_identity_user;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_oauth_account_provider') THEN
            ALTER INDEX idx_oauth_account_provider RENAME TO idx_user_auth_identity_provider;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_oauth_account_email') THEN
            ALTER INDEX idx_oauth_account_email RENAME TO idx_user_auth_identity_email;
        END IF;
    END IF;
END $$;

-- Add comment to clarify purpose
COMMENT ON TABLE user_auth_identity IS 'Links OAuth providers to SaaS users (usuario table)';

-- ================================================================
-- 6. UPDATE TRIGGERS
-- ================================================================

-- Trigger for marketplace_auth_identity.updated_at
CREATE OR REPLACE FUNCTION update_marketplace_auth_identity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_auth_identity_updated_at ON marketplace_auth_identity;
CREATE TRIGGER trg_marketplace_auth_identity_updated_at
    BEFORE UPDATE ON marketplace_auth_identity
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_auth_identity_updated_at();

-- ================================================================
-- END OF MIGRATION
-- ================================================================
