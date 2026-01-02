-- =====================================================
-- VERSA - BLOQUE 7: Email Automations
-- Tabla de cola de emails (para envío diferido/reintentos)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_queue (
    id BIGSERIAL PRIMARY KEY,
    event_log_id BIGINT NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    locked_at TIMESTAMPTZ NULL,
    locked_by TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- FK a log
    CONSTRAINT fk_email_queue_event_log FOREIGN KEY (event_log_id) 
        REFERENCES email_event_log(id) ON DELETE CASCADE,
    CONSTRAINT uk_email_queue_event_log UNIQUE(event_log_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_queue_run_at ON email_queue(run_at) WHERE locked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_locked ON email_queue(locked_at) WHERE locked_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE email_queue IS 'Cola de emails pendientes de envío (para workers futuros)';
COMMENT ON COLUMN email_queue.run_at IS 'Momento programado para envío';
COMMENT ON COLUMN email_queue.locked_at IS 'Timestamp de bloqueo por worker';
COMMENT ON COLUMN email_queue.locked_by IS 'ID del worker que lo bloqueó';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
