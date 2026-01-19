-- =====================================================
-- VERSA - BLOQUE 7: Email Automations
-- Tabla de plantillas de email
-- =====================================================

CREATE TABLE IF NOT EXISTS email_template (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NULL,  -- NULL = plantilla global por defecto
    code TEXT NOT NULL,     -- 'WELCOME' | 'PASSWORD_RESET' | etc
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT NULL,
    variables_json JSONB NULL,  -- lista de variables soportadas
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant específico o global, pero unique por code
    CONSTRAINT uk_email_template_tenant_code UNIQUE(id_tenant, code)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_template_code ON email_template(code);
CREATE INDEX IF NOT EXISTS idx_email_template_tenant ON email_template(id_tenant) WHERE id_tenant IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_template_updated_at ON email_template;
CREATE TRIGGER trg_email_template_updated_at
    BEFORE UPDATE ON email_template
    FOR EACH ROW
    EXECUTE FUNCTION update_email_template_updated_at();

-- Comentarios
COMMENT ON TABLE email_template IS 'Plantillas de email para automatizaciones';
COMMENT ON COLUMN email_template.id_tenant IS 'NULL = plantilla global, valor = override por tenant';
COMMENT ON COLUMN email_template.code IS 'Código único: WELCOME, PASSWORD_RESET, etc';
COMMENT ON COLUMN email_template.variables_json IS 'Lista de variables soportadas: ["nombre", "reset_url"]';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
