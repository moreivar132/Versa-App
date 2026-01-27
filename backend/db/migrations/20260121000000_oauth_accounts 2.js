/**
 * Migration: OAuth Accounts
 * @description Links external OAuth providers (Google, etc.) to usuario table
 */

exports.up = async function (knex) {
    // 1. Create oauth_account table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS oauth_account (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
            provider VARCHAR(50) NOT NULL,
            provider_account_id VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            name VARCHAR(255),
            avatar_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(provider, provider_account_id)
        );
    `);

    // 2. Create indexes
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_oauth_account_user ON oauth_account(user_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_oauth_account_provider ON oauth_account(provider, provider_account_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_oauth_account_email ON oauth_account(email);`);
};

exports.down = async function (knex) {
    await knex.raw(`DROP TABLE IF EXISTS oauth_account CASCADE;`);
};

exports.config = { transaction: true };
