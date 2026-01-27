/**
 * Migration: create_clientefinal_auth
 * Source: backend/archive/legacy-migrations/create_clientefinal_auth.sql
 * Module: Core/Shared
 * Risk Level: Medio
 * 
 * Creates client portal authentication table with:
 * - clientefinal_auth: credentials for end-customer portal login
 * - Unique constraints on email and phone
 * - Trigger for updated_at
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating clientefinal_auth table...');

    await knex.raw(`
        -- =====================================================
        -- TABLA: clientefinal_auth
        -- Credenciales de autenticación del portal cliente
        -- =====================================================
        CREATE TABLE IF NOT EXISTS clientefinal_auth (
            id SERIAL PRIMARY KEY,
            id_cliente INTEGER NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            telefono VARCHAR(20),
            password_hash VARCHAR(255) NOT NULL,
            email_verified BOOLEAN DEFAULT FALSE,
            verify_token TEXT,
            verify_token_expires_at TIMESTAMPTZ,
            reset_token TEXT,
            reset_token_expires_at TIMESTAMPTZ,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT uk_clientefinal_auth_email UNIQUE (email),
            CONSTRAINT uk_clientefinal_auth_cliente UNIQUE (id_cliente),
            CONSTRAINT uk_clientefinal_auth_telefono UNIQUE (telefono)
        );

        -- Índices
        CREATE INDEX IF NOT EXISTS idx_clientefinal_auth_email ON clientefinal_auth(email);
        CREATE INDEX IF NOT EXISTS idx_clientefinal_auth_id_cliente ON clientefinal_auth(id_cliente);
        CREATE INDEX IF NOT EXISTS idx_clientefinal_auth_reset_token ON clientefinal_auth(reset_token) WHERE reset_token IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_clientefinal_auth_verify_token ON clientefinal_auth(verify_token) WHERE verify_token IS NOT NULL;

        -- Trigger para updated_at
        CREATE OR REPLACE FUNCTION update_clientefinal_auth_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_clientefinal_auth_updated_at ON clientefinal_auth;
        CREATE TRIGGER trg_clientefinal_auth_updated_at
            BEFORE UPDATE ON clientefinal_auth
            FOR EACH ROW
            EXECUTE FUNCTION update_clientefinal_auth_updated_at();

        -- Comentarios
        COMMENT ON TABLE clientefinal_auth IS 'Credenciales de autenticación del portal cliente';
        COMMENT ON COLUMN clientefinal_auth.id_cliente IS 'FK a clientefinal.id';
        COMMENT ON COLUMN clientefinal_auth.email IS 'Email para login (único)';
        COMMENT ON COLUMN clientefinal_auth.telefono IS 'Teléfono opcional para 2FA o login alternativo';
        COMMENT ON COLUMN clientefinal_auth.password_hash IS 'Hash bcrypt de la contraseña';
        COMMENT ON COLUMN clientefinal_auth.email_verified IS 'Si el email ha sido verificado';
        COMMENT ON COLUMN clientefinal_auth.verify_token IS 'Token para verificación de email';
        COMMENT ON COLUMN clientefinal_auth.reset_token IS 'Token para reset de password';
    `);

    console.log('[Migration] ✅ clientefinal_auth table created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping clientefinal_auth table...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS trg_clientefinal_auth_updated_at ON clientefinal_auth;
        DROP FUNCTION IF EXISTS update_clientefinal_auth_updated_at();
        DROP TABLE IF EXISTS clientefinal_auth CASCADE;
    `);

    console.log('[Migration] ✅ clientefinal_auth table dropped');
};

exports.config = { transaction: true };
