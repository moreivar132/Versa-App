-- =====================================================
-- VERSA - BLOQUE 7: Email Automations
-- Tabla de log de eventos de email (auditoría + idempotencia)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_event_log (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL,
    event_code TEXT NOT NULL,
    id_cliente BIGINT NULL,
    to_email TEXT NOT NULL,
    subject_snapshot TEXT NOT NULL,
    html_snapshot TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',  -- 'QUEUED'|'SENT'|'FAILED'
    provider TEXT NOT NULL DEFAULT 'MAKE',
    provider_message_id TEXT NULL,
    error_message TEXT NULL,
    metadata_json JSONB NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ NULL,
    
    -- Idempotencia: un email por clave única
    CONSTRAINT uk_email_event_log_idempotency UNIQUE(idempotency_key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_event_log_tenant ON email_event_log(id_tenant);
CREATE INDEX IF NOT EXISTS idx_email_event_log_cliente ON email_event_log(id_cliente) WHERE id_cliente IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_event_log_status ON email_event_log(status);
CREATE INDEX IF NOT EXISTS idx_email_event_log_created ON email_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_event_log_event ON email_event_log(event_code);

-- Comentarios
COMMENT ON TABLE email_event_log IS 'Log de todos los emails enviados (auditoría)';
COMMENT ON COLUMN email_event_log.idempotency_key IS 'Clave para evitar duplicados. Ej: WELCOME:123:20251229';
COMMENT ON COLUMN email_event_log.subject_snapshot IS 'Snapshot del subject al momento de envío';
COMMENT ON COLUMN email_event_log.html_snapshot IS 'Snapshot del HTML al momento de envío';
COMMENT ON COLUMN email_event_log.provider_message_id IS 'ID del mensaje del provider (si aplica)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
