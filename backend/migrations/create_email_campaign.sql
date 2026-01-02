-- =====================================================
-- VERSA - Email Campaign System
-- Tabla para gestionar campañas de email programables
-- =====================================================

CREATE TABLE IF NOT EXISTS email_campaign (
    id SERIAL PRIMARY KEY,
    id_tenant INT NOT NULL REFERENCES tenant(id),
    
    -- Información básica
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'promo', 'manual', 'announcement'
    
    -- Referencia a promoción (si aplica)
    id_promo INT REFERENCES fidelizacion_promo(id) ON DELETE SET NULL,
    
    -- Contenido del email
    template_code VARCHAR(50),
    subject VARCHAR(255) NOT NULL,
    html_body TEXT NOT NULL,
    preview_text VARCHAR(255),
    
    -- Estado y programación
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'cancelled'
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Filtro de destinatarios
    -- Ejemplos:
    -- { "type": "all_members" } - Todos los miembros de fidelización
    -- { "type": "active_members" } - Solo miembros activos
    -- { "type": "specific", "ids": [1, 2, 3] } - Lista específica de id_cliente
    recipient_filter JSONB NOT NULL DEFAULT '{"type": "all_members"}',
    
    -- Estadísticas
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    
    -- Auditoría
    created_by INT REFERENCES usuario(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_campaign_tenant ON email_campaign(id_tenant);
CREATE INDEX IF NOT EXISTS idx_email_campaign_status ON email_campaign(status);
CREATE INDEX IF NOT EXISTS idx_email_campaign_scheduled ON email_campaign(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_campaign_promo ON email_campaign(id_promo) WHERE id_promo IS NOT NULL;

-- Comentarios
COMMENT ON TABLE email_campaign IS 'Campañas de email programables para promociones y anuncios';
COMMENT ON COLUMN email_campaign.recipient_filter IS 'Filtro JSON para seleccionar destinatarios: all_members, active_members, o specific con ids';
COMMENT ON COLUMN email_campaign.status IS 'Estados: draft (borrador), scheduled (programado), sending (enviando), sent (enviado), cancelled (cancelado)';
