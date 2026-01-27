/**
 * Migration: create_email_tables
 * Source: backend/migrations/create_email_*.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates email automation module tables (consolidated from multiple files):
 * - email_template: email templates per tenant
 * - email_config: webhook configuration per tenant
 * - email_event_log: email event tracking
 * - email_queue: deferred/retry queue
 * - email_automation: automation configuration
 * - email_campaign: campaign management
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating email automation tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: email_template
        -- =====================================================
        CREATE TABLE IF NOT EXISTS email_template (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NULL,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            html_body TEXT NOT NULL,
            text_body TEXT NULL,
            variables_json JSONB NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uk_email_template_tenant_code UNIQUE(id_tenant, code)
        );

        CREATE INDEX IF NOT EXISTS idx_email_template_code ON email_template(code);
        CREATE INDEX IF NOT EXISTS idx_email_template_tenant ON email_template(id_tenant) WHERE id_tenant IS NOT NULL;

        COMMENT ON TABLE email_template IS 'Plantillas de email para automatizaciones';

        -- =====================================================
        -- 2. TABLA: email_config
        -- =====================================================
        CREATE TABLE IF NOT EXISTS email_config (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER NOT NULL,
            webhook_url TEXT,
            webhook_type VARCHAR(50) DEFAULT 'MAKE',
            sender_name TEXT DEFAULT 'VERSA',
            sender_email TEXT DEFAULT 'noreply@versa.app',
            enabled BOOLEAN DEFAULT true,
            last_test_at TIMESTAMPTZ,
            last_test_status VARCHAR(20),
            last_test_error TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(id_tenant)
        );

        CREATE INDEX IF NOT EXISTS idx_email_config_tenant ON email_config(id_tenant);
        COMMENT ON TABLE email_config IS 'Per-tenant configuration for email webhook (Make.com, Zapier, etc.)';

        -- =====================================================
        -- 3. TABLA: email_event_log
        -- =====================================================
        CREATE TABLE IF NOT EXISTS email_event_log (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL,
            template_code TEXT NOT NULL,
            event_code TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            recipient_name TEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            variables_json JSONB NULL,
            error_message TEXT NULL,
            sent_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_email_event_log_tenant ON email_event_log(id_tenant, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_email_event_log_status ON email_event_log(status);
        CREATE INDEX IF NOT EXISTS idx_email_event_log_event ON email_event_log(event_code);

        COMMENT ON TABLE email_event_log IS 'Log de emails enviados/pendientes';

        -- =====================================================
        -- 4. TABLA: email_queue
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
            CONSTRAINT fk_email_queue_event_log FOREIGN KEY (event_log_id) 
                REFERENCES email_event_log(id) ON DELETE CASCADE,
            CONSTRAINT uk_email_queue_event_log UNIQUE(event_log_id)
        );

        CREATE INDEX IF NOT EXISTS idx_email_queue_run_at ON email_queue(run_at) WHERE locked_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_email_queue_locked ON email_queue(locked_at) WHERE locked_at IS NOT NULL;

        COMMENT ON TABLE email_queue IS 'Cola de emails pendientes de envío (para workers futuros)';

        -- =====================================================
        -- 5. TABLA: email_automation
        -- =====================================================
        CREATE TABLE IF NOT EXISTS email_automation (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL,
            event_code TEXT NOT NULL,
            template_code TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            delay_seconds INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uk_email_automation_tenant_event UNIQUE(id_tenant, event_code)
        );

        CREATE INDEX IF NOT EXISTS idx_email_automation_tenant ON email_automation(id_tenant);
        CREATE INDEX IF NOT EXISTS idx_email_automation_event ON email_automation(event_code);

        COMMENT ON TABLE email_automation IS 'Configuración de automatizaciones de email por tenant';

        -- =====================================================
        -- 6. TABLA: email_campaign
        -- =====================================================
        CREATE TABLE IF NOT EXISTS email_campaign (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            template_code TEXT,
            html_body TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            scheduled_at TIMESTAMPTZ,
            sent_at TIMESTAMPTZ,
            total_recipients INT DEFAULT 0,
            sent_count INT DEFAULT 0,
            open_count INT DEFAULT 0,
            click_count INT DEFAULT 0,
            created_by BIGINT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_email_campaign_tenant ON email_campaign(id_tenant, status);
        CREATE INDEX IF NOT EXISTS idx_email_campaign_scheduled ON email_campaign(scheduled_at) 
            WHERE status = 'SCHEDULED';

        COMMENT ON TABLE email_campaign IS 'Campañas de email marketing';

        -- =====================================================
        -- TRIGGERS para updated_at
        -- =====================================================
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
    `);

    console.log('[Migration] ✅ Email automation tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping email automation tables...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS trg_email_automation_updated_at ON email_automation;
        DROP TRIGGER IF EXISTS trg_email_template_updated_at ON email_template;
        DROP FUNCTION IF EXISTS update_email_automation_updated_at();
        DROP FUNCTION IF EXISTS update_email_template_updated_at();
        DROP TABLE IF EXISTS email_campaign CASCADE;
        DROP TABLE IF EXISTS email_automation CASCADE;
        DROP TABLE IF EXISTS email_queue CASCADE;
        DROP TABLE IF EXISTS email_event_log CASCADE;
        DROP TABLE IF EXISTS email_config CASCADE;
        DROP TABLE IF EXISTS email_template CASCADE;
    `);

    console.log('[Migration] ✅ Email automation tables dropped');
};

exports.config = { transaction: true };
