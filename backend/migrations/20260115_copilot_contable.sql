-- =====================================================
-- MIGRACIÓN: Copiloto Contable IA - Tablas y Funciones
-- Descripción: Sistema de chat IA, insights automáticos y alertas
-- Fecha: 2026-01-15
-- Autor: VERSA Dev Team
-- =====================================================

-- =====================================================
-- 1. TABLA: copilot_chat_session
-- Sesiones de conversación con el copiloto
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_chat_session (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_empresa BIGINT NOT NULL REFERENCES accounting_empresa(id),
    created_by BIGINT NOT NULL REFERENCES usuario(id),
    title TEXT, -- Auto-generado del primer mensaje
    context_periodo_inicio DATE,
    context_periodo_fin DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_session_tenant_empresa 
    ON copilot_chat_session(id_tenant, id_empresa, created_at DESC);

CREATE INDEX idx_copilot_session_user 
    ON copilot_chat_session(created_by, created_at DESC);

COMMENT ON TABLE copilot_chat_session IS 'Sesiones de chat con el copiloto contable IA';

-- =====================================================
-- 2. TABLA: copilot_chat_message
-- Mensajes individuales dentro de cada sesión
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_chat_message (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES copilot_chat_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    evidence_json JSONB, -- {periodo, empresa, items[], queries_used[]}
    tools_used TEXT[], -- Array de nombres de herramientas llamadas
    tokens_used INTEGER, -- Para tracking de costos
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_message_session 
    ON copilot_chat_message(session_id, created_at);

CREATE INDEX idx_copilot_message_session_role 
    ON copilot_chat_message(session_id, role);

-- GIN index for searching evidence JSON
CREATE INDEX idx_copilot_message_evidence 
    ON copilot_chat_message USING GIN (evidence_json);

COMMENT ON TABLE copilot_chat_message IS 'Mensajes de conversación con evidencia y trazabilidad';

-- =====================================================
-- 3. TABLA: copilot_alert_rule
-- Reglas de alertas configurables
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_alert_rule (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_empresa BIGINT REFERENCES accounting_empresa(id), -- NULL = aplica a todas
    name TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'GASTO_CATEGORIA_SPIKE',    -- Aumento anómalo en categoría
        'PROVEEDOR_SPIKE',           -- Aumento anómalo en proveedor
        'SIN_ADJUNTO',               -- Facturas sin archivo adjunto
        'SIN_CATEGORIA',             -- Facturas sin categoría
        'IVA_INCONSISTENTE',         -- IVA fuera de rangos normales
        'VENCIMIENTO_PROXIMO',       -- Facturas próximas a vencer
        'DUPLICADO_POTENCIAL'        -- Posibles facturas duplicadas
    )),
    params_json JSONB NOT NULL, -- Thresholds, category IDs, etc.
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    frequency TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by BIGINT REFERENCES usuario(id)
);

CREATE INDEX idx_copilot_alert_rule_tenant 
    ON copilot_alert_rule(id_tenant) WHERE is_enabled = true;

CREATE INDEX idx_copilot_alert_rule_empresa 
    ON copilot_alert_rule(id_empresa) WHERE is_enabled = true;

CREATE INDEX idx_copilot_alert_rule_tipo 
    ON copilot_alert_rule(tipo) WHERE is_enabled = true;

COMMENT ON TABLE copilot_alert_rule IS 'Reglas configurables para alertas automáticas';

-- =====================================================
-- 4. TABLA: copilot_alert_event
-- Eventos de alerta generados por las reglas
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_alert_event (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES copilot_alert_rule(id) ON DELETE CASCADE,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    result_json JSONB NOT NULL, -- Findings, affected items, metrics
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'SEEN', 'SNOOZED', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    seen_at TIMESTAMPTZ,
    seen_by BIGINT REFERENCES usuario(id),
    snoozed_until TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by BIGINT REFERENCES usuario(id)
);

CREATE INDEX idx_copilot_alert_event_rule 
    ON copilot_alert_event(rule_id, created_at DESC);

CREATE INDEX idx_copilot_alert_event_status 
    ON copilot_alert_event(status, created_at DESC) 
    WHERE status IN ('NEW', 'SEEN');

CREATE INDEX idx_copilot_alert_event_result 
    ON copilot_alert_event USING GIN (result_json);

COMMENT ON TABLE copilot_alert_event IS 'Eventos de alerta generados por evaluación de reglas';

-- =====================================================
-- 5. TRIGGER: Actualizar updated_at en sessions
-- =====================================================
CREATE OR REPLACE FUNCTION update_copilot_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE copilot_chat_session
    SET updated_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_session_on_message ON copilot_chat_message;
CREATE TRIGGER trg_update_session_on_message
    AFTER INSERT ON copilot_chat_message
    FOR EACH ROW
    EXECUTE FUNCTION update_copilot_session_timestamp();

-- =====================================================
-- 6. FUNCIÓN: Auto-generar título de sesión
-- =====================================================
CREATE OR REPLACE FUNCTION generate_session_title(session_id_param BIGINT)
RETURNS TEXT AS $$
DECLARE
    first_message TEXT;
    generated_title TEXT;
BEGIN
    -- Obtener primer mensaje del usuario
    SELECT content INTO first_message
    FROM copilot_chat_message
    WHERE session_id = session_id_param AND role = 'user'
    ORDER BY created_at
    LIMIT 1;
    
    IF first_message IS NULL THEN
        RETURN 'Nueva conversación';
    END IF;
    
    -- Truncar a 60 caracteres
    generated_title := substring(first_message from 1 for 60);
    
    IF length(first_message) > 60 THEN
        generated_title := generated_title || '...';
    END IF;
    
    RETURN generated_title;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. PERMISOS RBAC: Nuevos permisos para copiloto
-- =====================================================
DO $$
BEGIN
    -- Insertar permisos solo si no existen
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.read') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Copiloto Lectura', 'copiloto.read', 'copiloto', 
                'Ver insights y consultar el copiloto IA');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.write') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Copiloto Escritura', 'copiloto.write', 'copiloto', 
                'Crear conversaciones y alertas personalizadas');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.admin') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Copiloto Admin', 'copiloto.admin', 'copiloto', 
                'Configurar reglas globales y ver históricos completos');
    END IF;
END $$;

-- =====================================================
-- 8. REGLAS DE ALERTA POR DEFECTO (Opcional)
-- Insertar reglas básicas para cada tenant
-- =====================================================
DO $$
DECLARE
    t_id BIGINT;
BEGIN
    FOR t_id IN SELECT id FROM tenant LOOP
        -- Regla: Facturas sin adjunto
        INSERT INTO copilot_alert_rule (id_tenant, name, tipo, params_json, frequency)
        VALUES (
            t_id,
            'Facturas sin adjunto',
            'SIN_ADJUNTO',
            '{"threshold": 1}'::jsonb,
            'WEEKLY'
        ) ON CONFLICT DO NOTHING;
        
        -- Regla: Facturas sin categoría
        INSERT INTO copilot_alert_rule (id_tenant, name, tipo, params_json, frequency)
        VALUES (
            t_id,
            'Facturas sin categoría',
            'SIN_CATEGORIA',
            '{"threshold": 1}'::jsonb,
            'WEEKLY'
        ) ON CONFLICT DO NOTHING;
        
        -- Regla: Gasto anómalo (>2x promedio)
        INSERT INTO copilot_alert_rule (id_tenant, name, tipo, params_json, frequency)
        VALUES (
            t_id,
            'Aumento anómalo de gastos',
            'GASTO_CATEGORIA_SPIKE',
            '{"threshold_multiplier": 2.0, "lookback_periods": 3}'::jsonb,
            'MONTHLY'
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- =====================================================
-- 9. VISTA: Resumen de alertas activas por tenant
-- =====================================================
CREATE OR REPLACE VIEW copilot_alerts_summary AS
SELECT 
    r.id_tenant,
    r.id_empresa,
    COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'NEW') as new_alerts,
    COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'SEEN') as seen_alerts,
    COUNT(DISTINCT r.id) FILTER (WHERE r.is_enabled = true) as active_rules,
    MAX(e.created_at) as last_alert_at
FROM copilot_alert_rule r
LEFT JOIN copilot_alert_event e ON e.rule_id = r.id
GROUP BY r.id_tenant, r.id_empresa;

COMMENT ON VIEW copilot_alerts_summary IS 'Resumen rápido de alertas por tenant/empresa';

-- =====================================================
-- ✅ FIN DE MIGRACIÓN
-- =====================================================
