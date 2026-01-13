-- =====================================================
-- VERSA - PASO 5: Portal Cliente
-- Tabla de autenticación para clientes finales
-- =====================================================

-- Tabla de credenciales del portal cliente
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

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
