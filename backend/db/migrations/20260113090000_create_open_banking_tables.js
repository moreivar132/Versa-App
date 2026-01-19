/**
 * Migration: create_open_banking_tables
 * Source: backend/migrations/create_open_banking_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates Open Banking (TrueLayer) integration tables:
 * - bank_connection: OAuth connections to banking providers
 * - bank_account: linked bank accounts
 * - bank_transaction: downloaded transactions
 * - bank_sync_run: sync history with metrics
 * - bank_reconciliation_rule: [placeholder] auto-categorization rules
 * - bank_transaction_match: [placeholder] transaction matches
 * - accounting_category: [placeholder] accounting categories
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating Open Banking tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: bank_connection
        -- =====================================================
        CREATE TABLE IF NOT EXISTS bank_connection (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            created_by_user_id BIGINT NULL,
            provider TEXT NOT NULL DEFAULT 'truelayer',
            provider_user_id TEXT NULL,
            status TEXT NOT NULL DEFAULT 'active' 
                CHECK (status IN ('active', 'needs_reauth', 'revoked', 'error')),
            scopes TEXT[] NULL,
            refresh_token_enc TEXT NOT NULL,
            access_token_cache TEXT NULL,
            access_token_expires_at TIMESTAMPTZ NULL,
            connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_sync_at TIMESTAMPTZ NULL,
            next_sync_at TIMESTAMPTZ NULL,
            metadata JSONB NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_bank_connection_tenant_status 
        ON bank_connection(tenant_id, status);

        CREATE INDEX IF NOT EXISTS idx_bank_connection_next_sync 
        ON bank_connection(tenant_id, next_sync_at) 
        WHERE status = 'active';

        COMMENT ON TABLE bank_connection IS 'Conexiones OAuth a proveedores de banca abierta (TrueLayer, etc.)';

        -- =====================================================
        -- 2. TABLA: bank_account
        -- =====================================================
        CREATE TABLE IF NOT EXISTS bank_account (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            bank_connection_id UUID NOT NULL REFERENCES bank_connection(id) ON DELETE CASCADE,
            provider_account_id TEXT NOT NULL,
            account_type TEXT NULL,
            currency TEXT NULL,
            iban_masked TEXT NULL,
            display_name TEXT NULL,
            provider_payload JSONB NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_account_provider 
        ON bank_account(tenant_id, provider_account_id);

        CREATE INDEX IF NOT EXISTS idx_bank_account_connection 
        ON bank_account(tenant_id, bank_connection_id);

        COMMENT ON TABLE bank_account IS 'Cuentas bancarias vinculadas por conexión Open Banking';

        -- =====================================================
        -- 3. TABLA: bank_transaction
        -- =====================================================
        CREATE TABLE IF NOT EXISTS bank_transaction (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            bank_account_id UUID NOT NULL REFERENCES bank_account(id) ON DELETE CASCADE,
            provider_transaction_id TEXT NOT NULL,
            booking_date DATE NOT NULL,
            value_date DATE NULL,
            amount NUMERIC(14,2) NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            description TEXT NULL,
            merchant_name TEXT NULL,
            category TEXT NULL,
            reference TEXT NULL,
            running_balance NUMERIC(14,2) NULL,
            direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
            provider_payload JSONB NULL,
            ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_transaction_provider 
        ON bank_transaction(tenant_id, bank_account_id, provider_transaction_id);

        CREATE INDEX IF NOT EXISTS idx_bank_tx_date 
        ON bank_transaction(tenant_id, booking_date);

        CREATE INDEX IF NOT EXISTS idx_bank_tx_account_date 
        ON bank_transaction(tenant_id, bank_account_id, booking_date);

        COMMENT ON TABLE bank_transaction IS 'Transacciones bancarias descargadas con idempotencia por provider_transaction_id';

        -- =====================================================
        -- 4. TABLA: bank_sync_run
        -- =====================================================
        CREATE TABLE IF NOT EXISTS bank_sync_run (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            bank_connection_id UUID NOT NULL REFERENCES bank_connection(id) ON DELETE CASCADE,
            run_type TEXT NOT NULL CHECK (run_type IN ('initial', 'scheduled', 'manual', 'webhook')),
            status TEXT NOT NULL DEFAULT 'running' 
                CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMPTZ NULL,
            from_ts TIMESTAMPTZ NULL,
            to_ts TIMESTAMPTZ NULL,
            accounts_fetched INT NOT NULL DEFAULT 0,
            transactions_fetched INT NOT NULL DEFAULT 0,
            transactions_upserted INT NOT NULL DEFAULT 0,
            error_code TEXT NULL,
            error_message TEXT NULL,
            logs JSONB NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bank_sync_run_tenant_time 
        ON bank_sync_run(tenant_id, started_at DESC);

        COMMENT ON TABLE bank_sync_run IS 'Historial de ejecuciones de sync con métricas y errores';

        -- =====================================================
        -- 5. PLACEHOLDER TABLES
        -- =====================================================
        CREATE TABLE IF NOT EXISTS bank_reconciliation_rule (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            match_field TEXT NOT NULL,
            match_pattern TEXT NOT NULL,
            assign_category TEXT NULL,
            assign_tag TEXT NULL,
            priority INT NOT NULL DEFAULT 100,
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        COMMENT ON TABLE bank_reconciliation_rule IS '[PLACEHOLDER] Reglas de categorización automática de transacciones';

        CREATE TABLE IF NOT EXISTS bank_transaction_match (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            bank_transaction_id UUID NOT NULL REFERENCES bank_transaction(id) ON DELETE CASCADE,
            match_type TEXT NOT NULL,
            match_entity_id BIGINT NULL,
            confidence NUMERIC(3,2) NULL,
            confirmed BOOLEAN NOT NULL DEFAULT false,
            confirmed_by_user_id BIGINT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        COMMENT ON TABLE bank_transaction_match IS '[PLACEHOLDER] Matches de transacciones con facturas/órdenes/pagos';

        CREATE TABLE IF NOT EXISTS accounting_category (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            parent_id UUID NULL REFERENCES accounting_category(id),
            category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'transfer')),
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_category_code 
        ON accounting_category(tenant_id, code);

        COMMENT ON TABLE accounting_category IS '[PLACEHOLDER] Catálogo de categorías contables';

        -- =====================================================
        -- TRIGGERS para updated_at
        -- =====================================================
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bank_connection_updated_at') THEN
                CREATE TRIGGER update_bank_connection_updated_at
                BEFORE UPDATE ON bank_connection
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bank_account_updated_at') THEN
                CREATE TRIGGER update_bank_account_updated_at
                BEFORE UPDATE ON bank_account
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bank_transaction_updated_at') THEN
                CREATE TRIGGER update_bank_transaction_updated_at
                BEFORE UPDATE ON bank_transaction
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bank_reconciliation_rule_updated_at') THEN
                CREATE TRIGGER update_bank_reconciliation_rule_updated_at
                BEFORE UPDATE ON bank_reconciliation_rule
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END$$;
    `);

    console.log('[Migration] ✅ Open Banking tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping Open Banking tables...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS update_bank_reconciliation_rule_updated_at ON bank_reconciliation_rule;
        DROP TRIGGER IF EXISTS update_bank_transaction_updated_at ON bank_transaction;
        DROP TRIGGER IF EXISTS update_bank_account_updated_at ON bank_account;
        DROP TRIGGER IF EXISTS update_bank_connection_updated_at ON bank_connection;
        
        DROP TABLE IF EXISTS accounting_category CASCADE;
        DROP TABLE IF EXISTS bank_transaction_match CASCADE;
        DROP TABLE IF EXISTS bank_reconciliation_rule CASCADE;
        DROP TABLE IF EXISTS bank_sync_run CASCADE;
        DROP TABLE IF EXISTS bank_transaction CASCADE;
        DROP TABLE IF EXISTS bank_account CASCADE;
        DROP TABLE IF EXISTS bank_connection CASCADE;
    `);

    console.log('[Migration] ✅ Open Banking tables dropped');
};

exports.config = { transaction: true };
