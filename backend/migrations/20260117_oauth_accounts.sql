-- ================================================================
-- OAuth Accounts Migration
-- ================================================================
-- Links external OAuth providers (Google, etc.) to usuario table.
-- Supports multiple providers per user.
-- ================================================================

CREATE TABLE IF NOT EXISTS oauth_account (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,  -- 'google', 'microsoft', etc.
    provider_account_id VARCHAR(255) NOT NULL,  -- Provider's unique user ID (e.g., Google sub)
    email VARCHAR(255),  -- Email from provider (may differ from usuario.email)
    name VARCHAR(255),  -- Display name from provider
    avatar_url TEXT,  -- Profile picture URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

-- Index for finding user's OAuth accounts
CREATE INDEX IF NOT EXISTS idx_oauth_account_user ON oauth_account(user_id);

-- Index for looking up by provider + provider_account_id
CREATE INDEX IF NOT EXISTS idx_oauth_account_provider ON oauth_account(provider, provider_account_id);

-- Index for email lookups during account linking
CREATE INDEX IF NOT EXISTS idx_oauth_account_email ON oauth_account(email);

-- ================================================================
-- Audit: OAuth Login Events
-- ================================================================
-- Track OAuth login attempts for security monitoring

-- Uses existing audit_logs table, no new table needed.
-- OAuth logins will be logged with:
--   action: 'oauth.login' or 'oauth.link'
--   entity_type: 'user'
--   entity_id: user.id
--   after_json: { provider: 'google', email: '...' }
