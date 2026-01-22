/**
 * Migration: Dual Auth Architecture
 * @description Separates Marketplace (B2C global) from SaaS (B2B tenant-scoped)
 */

exports.up = async function (knex) {
    // 1. Make clientefinal.id_tenant nullable for global marketplace customers
    await knex.raw(`ALTER TABLE clientefinal ALTER COLUMN id_tenant DROP NOT NULL;`);
    await knex.raw(`COMMENT ON COLUMN clientefinal.id_tenant IS 'Optional: NULL for global marketplace customers, set for tenant-specific clients';`);

    // 2. Make password optional for OAuth-only customers
    await knex.raw(`ALTER TABLE clientefinal_auth ALTER COLUMN password_hash DROP NOT NULL;`);
    await knex.raw(`ALTER TABLE clientefinal_auth ADD COLUMN IF NOT EXISTS is_google_auth BOOLEAN DEFAULT FALSE;`);
    await knex.raw(`COMMENT ON COLUMN clientefinal_auth.is_google_auth IS 'True if customer registered via Google OAuth';`);

    // 3. Create marketplace_auth_identity table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS marketplace_auth_identity (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            provider VARCHAR(50) NOT NULL,
            provider_subject VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            name VARCHAR(255),
            avatar_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(provider, provider_subject)
        );
    `);

    // 4. Create indexes for marketplace_auth_identity
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_customer ON marketplace_auth_identity(customer_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_provider ON marketplace_auth_identity(provider, provider_subject);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_marketplace_auth_identity_email ON marketplace_auth_identity(email);`);
    await knex.raw(`COMMENT ON TABLE marketplace_auth_identity IS 'Links OAuth providers to marketplace customers (clientefinal)';`);

    // 5. Create saas_invite table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS saas_invite (
            id SERIAL PRIMARY KEY,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_ADMIN',
            email_allowed VARCHAR(255),
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_by_user_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // 6. Create indexes for saas_invite
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_saas_invite_token ON saas_invite(token_hash);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_saas_invite_tenant ON saas_invite(tenant_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_saas_invite_expires ON saas_invite(expires_at) WHERE used_at IS NULL;`);
    await knex.raw(`COMMENT ON TABLE saas_invite IS 'Invitation tokens for SaaS B2B user onboarding';`);

    // 7. Rename oauth_account to user_auth_identity if exists
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_account') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_auth_identity') 
            THEN
                ALTER TABLE oauth_account RENAME TO user_auth_identity;
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
    `);

    // 8. Create trigger for updated_at
    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_marketplace_auth_identity_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`DROP TRIGGER IF EXISTS trg_marketplace_auth_identity_updated_at ON marketplace_auth_identity;`);
    await knex.raw(`
        CREATE TRIGGER trg_marketplace_auth_identity_updated_at
            BEFORE UPDATE ON marketplace_auth_identity
            FOR EACH ROW
            EXECUTE FUNCTION update_marketplace_auth_identity_updated_at();
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP TRIGGER IF EXISTS trg_marketplace_auth_identity_updated_at ON marketplace_auth_identity;`);
    await knex.raw(`DROP FUNCTION IF EXISTS update_marketplace_auth_identity_updated_at();`);
    await knex.raw(`DROP TABLE IF EXISTS saas_invite CASCADE;`);
    await knex.raw(`DROP TABLE IF EXISTS marketplace_auth_identity CASCADE;`);
    // Note: Not reverting column changes as they are non-destructive
};

exports.config = { transaction: true };
