/**
 * Migration: Copiloto Contable IA
 * @description Chat AI system, automatic insights, and alerts
 */

exports.up = async function (knex) {
    // 1. Create copilot_chat_session table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS copilot_chat_session (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_empresa BIGINT NOT NULL REFERENCES accounting_empresa(id),
            created_by BIGINT NOT NULL REFERENCES usuario(id),
            title TEXT,
            context_periodo_inicio DATE,
            context_periodo_fin DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    await knex.raw(`CREATE INDEX idx_copilot_session_tenant_empresa ON copilot_chat_session(id_tenant, id_empresa, created_at DESC);`);
    await knex.raw(`CREATE INDEX idx_copilot_session_user ON copilot_chat_session(created_by, created_at DESC);`);
    await knex.raw(`COMMENT ON TABLE copilot_chat_session IS 'Sesiones de chat con el copiloto contable IA';`);

    // 2. Create copilot_chat_message table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS copilot_chat_message (
            id BIGSERIAL PRIMARY KEY,
            session_id BIGINT NOT NULL REFERENCES copilot_chat_session(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            evidence_json JSONB,
            tools_used TEXT[],
            tokens_used INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    await knex.raw(`CREATE INDEX idx_copilot_message_session ON copilot_chat_message(session_id, created_at);`);
    await knex.raw(`CREATE INDEX idx_copilot_message_session_role ON copilot_chat_message(session_id, role);`);
    await knex.raw(`CREATE INDEX idx_copilot_message_evidence ON copilot_chat_message USING GIN (evidence_json);`);
    await knex.raw(`COMMENT ON TABLE copilot_chat_message IS 'Mensajes de conversación con evidencia y trazabilidad';`);

    // 3. Create copilot_alert_rule table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS copilot_alert_rule (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_empresa BIGINT REFERENCES accounting_empresa(id),
            name TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN (
                'GASTO_CATEGORIA_SPIKE', 'PROVEEDOR_SPIKE', 'SIN_ADJUNTO',
                'SIN_CATEGORIA', 'IVA_INCONSISTENTE', 'VENCIMIENTO_PROXIMO', 'DUPLICADO_POTENCIAL'
            )),
            params_json JSONB NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT true,
            frequency TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by BIGINT REFERENCES usuario(id)
        );
    `);

    await knex.raw(`CREATE INDEX idx_copilot_alert_rule_tenant ON copilot_alert_rule(id_tenant) WHERE is_enabled = true;`);
    await knex.raw(`CREATE INDEX idx_copilot_alert_rule_empresa ON copilot_alert_rule(id_empresa) WHERE is_enabled = true;`);
    await knex.raw(`CREATE INDEX idx_copilot_alert_rule_tipo ON copilot_alert_rule(tipo) WHERE is_enabled = true;`);
    await knex.raw(`COMMENT ON TABLE copilot_alert_rule IS 'Reglas configurables para alertas automáticas';`);

    // 4. Create copilot_alert_event table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS copilot_alert_event (
            id BIGSERIAL PRIMARY KEY,
            rule_id BIGINT NOT NULL REFERENCES copilot_alert_rule(id) ON DELETE CASCADE,
            periodo_inicio DATE NOT NULL,
            periodo_fin DATE NOT NULL,
            severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
            result_json JSONB NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'SEEN', 'SNOOZED', 'RESOLVED')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            seen_at TIMESTAMPTZ,
            seen_by BIGINT REFERENCES usuario(id),
            snoozed_until TIMESTAMPTZ,
            resolved_at TIMESTAMPTZ,
            resolved_by BIGINT REFERENCES usuario(id)
        );
    `);

    await knex.raw(`CREATE INDEX idx_copilot_alert_event_rule ON copilot_alert_event(rule_id, created_at DESC);`);
    await knex.raw(`CREATE INDEX idx_copilot_alert_event_status ON copilot_alert_event(status, created_at DESC) WHERE status IN ('NEW', 'SEEN');`);
    await knex.raw(`CREATE INDEX idx_copilot_alert_event_result ON copilot_alert_event USING GIN (result_json);`);
    await knex.raw(`COMMENT ON TABLE copilot_alert_event IS 'Eventos de alerta generados por evaluación de reglas';`);

    // 5. Create trigger for session updated_at
    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_copilot_session_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE copilot_chat_session SET updated_at = now() WHERE id = NEW.session_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`DROP TRIGGER IF EXISTS trg_update_session_on_message ON copilot_chat_message;`);
    await knex.raw(`
        CREATE TRIGGER trg_update_session_on_message
            AFTER INSERT ON copilot_chat_message
            FOR EACH ROW
            EXECUTE FUNCTION update_copilot_session_timestamp();
    `);

    // 6. Create function to generate session title
    await knex.raw(`
        CREATE OR REPLACE FUNCTION generate_session_title(session_id_param BIGINT)
        RETURNS TEXT AS $$
        DECLARE
            first_message TEXT;
            generated_title TEXT;
        BEGIN
            SELECT content INTO first_message
            FROM copilot_chat_message
            WHERE session_id = session_id_param AND role = 'user'
            ORDER BY created_at LIMIT 1;
            
            IF first_message IS NULL THEN RETURN 'Nueva conversación'; END IF;
            
            generated_title := substring(first_message from 1 for 60);
            IF length(first_message) > 60 THEN generated_title := generated_title || '...'; END IF;
            
            RETURN generated_title;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 7. Add RBAC permissions
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.read') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Copiloto Lectura', 'copiloto.read', 'copiloto', 'Ver insights y consultar el copiloto IA');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.write') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Copiloto Escritura', 'copiloto.write', 'copiloto', 'Crear conversaciones y alertas personalizadas');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'copiloto.admin') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Copiloto Admin', 'copiloto.admin', 'copiloto', 'Configurar reglas globales y ver históricos completos');
            END IF;
        END $$;
    `);

    // 8. Create summary view
    await knex.raw(`
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
    `);
    await knex.raw(`COMMENT ON VIEW copilot_alerts_summary IS 'Resumen rápido de alertas por tenant/empresa';`);
};

exports.down = async function (knex) {
    await knex.raw(`DROP VIEW IF EXISTS copilot_alerts_summary;`);
    await knex.raw(`DROP TRIGGER IF EXISTS trg_update_session_on_message ON copilot_chat_message;`);
    await knex.raw(`DROP FUNCTION IF EXISTS generate_session_title(BIGINT);`);
    await knex.raw(`DROP FUNCTION IF EXISTS update_copilot_session_timestamp();`);
    await knex.raw(`DROP TABLE IF EXISTS copilot_alert_event CASCADE;`);
    await knex.raw(`DROP TABLE IF EXISTS copilot_alert_rule CASCADE;`);
    await knex.raw(`DROP TABLE IF EXISTS copilot_chat_message CASCADE;`);
    await knex.raw(`DROP TABLE IF EXISTS copilot_chat_session CASCADE;`);
};

exports.config = { transaction: true };
