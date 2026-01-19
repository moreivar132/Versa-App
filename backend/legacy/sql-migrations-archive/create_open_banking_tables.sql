-- =====================================================
-- MIGRACIÓN: Módulo Open Banking (TrueLayer)
-- Descripción: Tablas para conexiones bancarias, cuentas,
--              transacciones y sincronización multi-tenant
-- Fecha: 2026-01-02
-- =====================================================

-- =====================================================
-- 1. TABLA: bank_connection
-- Conexiones OAuth a proveedores de banca abierta
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_connection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_by_user_id BIGINT NULL, -- User who created this connection
    
    -- Provider info
    provider TEXT NOT NULL DEFAULT 'truelayer',
    provider_user_id TEXT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'needs_reauth', 'revoked', 'error')),
    scopes TEXT[] NULL,
    
    -- Tokens (refresh_token cifrado, access_token cache)
    refresh_token_enc TEXT NOT NULL,
    access_token_cache TEXT NULL,
    access_token_expires_at TIMESTAMPTZ NULL,
    
    -- Timestamps
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ NULL,
    next_sync_at TIMESTAMPTZ NULL,
    
    -- Metadata
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_connection_tenant_status 
ON bank_connection(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_connection_next_sync 
ON bank_connection(tenant_id, next_sync_at) 
WHERE status = 'active';

COMMENT ON TABLE bank_connection IS 'Conexiones OAuth a proveedores de banca abierta (TrueLayer, etc.)';
COMMENT ON COLUMN bank_connection.refresh_token_enc IS 'Refresh token cifrado con AES-256-GCM';
COMMENT ON COLUMN bank_connection.status IS 'active=funcional, needs_reauth=token expirado, revoked=revocado, error=error';

-- =====================================================
-- 2. TABLA: bank_account
-- Cuentas bancarias vinculadas a una conexión
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    bank_connection_id UUID NOT NULL REFERENCES bank_connection(id) ON DELETE CASCADE,
    
    -- Provider info
    provider_account_id TEXT NOT NULL,
    account_type TEXT NULL,
    currency TEXT NULL,
    iban_masked TEXT NULL,
    display_name TEXT NULL,
    
    -- Raw data
    provider_payload JSONB NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints e índices
CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_account_provider 
ON bank_account(tenant_id, provider_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_account_connection 
ON bank_account(tenant_id, bank_connection_id);

COMMENT ON TABLE bank_account IS 'Cuentas bancarias vinculadas por conexión Open Banking';
COMMENT ON COLUMN bank_account.iban_masked IS 'IBAN parcialmente oculto (ej: ES12****1234)';

-- =====================================================
-- 3. TABLA: bank_transaction
-- Transacciones bancarias descargadas
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES bank_account(id) ON DELETE CASCADE,
    
    -- Identificador único del provider (para idempotencia)
    provider_transaction_id TEXT NOT NULL,
    
    -- Datos de transacción
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
    
    -- Raw data
    provider_payload JSONB NULL,
    
    -- Timestamps
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint de unicidad para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_transaction_provider 
ON bank_transaction(tenant_id, bank_account_id, provider_transaction_id);

-- Índices de consulta
CREATE INDEX IF NOT EXISTS idx_bank_tx_date 
ON bank_transaction(tenant_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_bank_tx_account_date 
ON bank_transaction(tenant_id, bank_account_id, booking_date);

COMMENT ON TABLE bank_transaction IS 'Transacciones bancarias descargadas con idempotencia por provider_transaction_id';
COMMENT ON COLUMN bank_transaction.direction IS 'in=entrada (ingreso), out=salida (gasto)';
COMMENT ON COLUMN bank_transaction.amount IS 'Siempre positivo, usar direction para signo';

-- =====================================================
-- 4. TABLA: bank_sync_run
-- Historial de sincronizaciones con métricas
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_sync_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    bank_connection_id UUID NOT NULL REFERENCES bank_connection(id) ON DELETE CASCADE,
    
    -- Tipo y estado
    run_type TEXT NOT NULL CHECK (run_type IN ('initial', 'scheduled', 'manual', 'webhook')),
    status TEXT NOT NULL DEFAULT 'running' 
        CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
    
    -- Timestamps de ejecución
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    
    -- Rango de fechas consultadas
    from_ts TIMESTAMPTZ NULL,
    to_ts TIMESTAMPTZ NULL,
    
    -- Métricas
    accounts_fetched INT NOT NULL DEFAULT 0,
    transactions_fetched INT NOT NULL DEFAULT 0,
    transactions_upserted INT NOT NULL DEFAULT 0,
    
    -- Errores
    error_code TEXT NULL,
    error_message TEXT NULL,
    logs JSONB NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_sync_run_tenant_time 
ON bank_sync_run(tenant_id, started_at DESC);

COMMENT ON TABLE bank_sync_run IS 'Historial de ejecuciones de sync con métricas y errores';

-- =====================================================
-- 5. TABLAS PLACEHOLDER (futuro reconciliación)
-- Solo estructura, sin lógica por ahora
-- =====================================================

-- Reglas de categorización automática
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

-- Match de transacción con factura/orden/pago
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

-- Catálogo de categorías contables
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

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
