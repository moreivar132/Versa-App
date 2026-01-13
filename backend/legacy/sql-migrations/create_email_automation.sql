-- =====================================================
-- VERSA - BLOQUE 7: Email Automations
-- Tabla de configuración de automatizaciones de email
-- =====================================================

CREATE TABLE IF NOT EXISTS email_automation (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL,
    event_code TEXT NOT NULL,        -- 'CLIENT_REGISTERED' | 'PASSWORD_RESET_REQUESTED'
    template_code TEXT NOT NULL,     -- 'WELCOME' | 'PASSWORD_RESET'
    enabled BOOLEAN NOT NULL DEFAULT true,
    delay_seconds INT NOT NULL DEFAULT 0,  -- para futuro (hoy 0 = inmediato)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un evento por tenant
    CONSTRAINT uk_email_automation_tenant_event UNIQUE(id_tenant, event_code)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_automation_tenant ON email_automation(id_tenant);
CREATE INDEX IF NOT EXISTS idx_email_automation_event ON email_automation(event_code);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_email_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_automation_updated_at ON email_automation;
CREATE TRIGGER trg_email_automation_updated_at
    BEFORE UPDATE ON email_automation
    FOR EACH ROW
    EXECUTE FUNCTION update_email_automation_updated_at();

-- Comentarios
COMMENT ON TABLE email_automation IS 'Configuración de automatizaciones de email por tenant';
COMMENT ON COLUMN email_automation.event_code IS 'Evento que dispara el email: CLIENT_REGISTERED, PASSWORD_RESET_REQUESTED';
COMMENT ON COLUMN email_automation.template_code IS 'Código de la plantilla a usar';
COMMENT ON COLUMN email_automation.delay_seconds IS 'Delay antes de enviar (0 = inmediato)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
