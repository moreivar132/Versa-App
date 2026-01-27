/**
 * Migration: create_clientefinal_credito_mov
 * Source: backend/archive/legacy-migrations/create_clientefinal_credito_mov.sql
 * Module: Manager
 * Risk Level: Medio
 * 
 * Creates credit ledger for client balance management:
 * - clientefinal_credito_mov: credit/debit movements
 * - vw_clientefinal_saldo: view for current balance
 * - fn_get_cliente_saldo: helper function
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating clientefinal_credito_mov ledger...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: clientefinal_credito_mov
        -- Ledger de saldo a favor del cliente
        -- =====================================================
        CREATE TABLE IF NOT EXISTS clientefinal_credito_mov (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL,
            id_cliente BIGINT NOT NULL,
            id_cita_origen BIGINT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('CREDITO', 'DEBITO')),
            concepto TEXT NOT NULL,
            amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
            currency TEXT NOT NULL DEFAULT 'eur',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- =====================================================
        -- 2. ÍNDICES
        -- =====================================================
        CREATE INDEX IF NOT EXISTS idx_credito_mov_cliente_fecha 
            ON clientefinal_credito_mov(id_cliente, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_credito_mov_tenant 
            ON clientefinal_credito_mov(id_tenant);

        CREATE INDEX IF NOT EXISTS idx_credito_mov_cita 
            ON clientefinal_credito_mov(id_cita_origen) 
            WHERE id_cita_origen IS NOT NULL;

        -- =====================================================
        -- 3. FOREIGN KEYS
        -- =====================================================
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_credito_mov_cliente'
            ) THEN
                ALTER TABLE clientefinal_credito_mov
                ADD CONSTRAINT fk_credito_mov_cliente
                FOREIGN KEY (id_cliente) REFERENCES clientefinal(id) ON DELETE CASCADE;
            END IF;
        END$$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_credito_mov_cita'
            ) THEN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'citataller') THEN
                    ALTER TABLE clientefinal_credito_mov
                    ADD CONSTRAINT fk_credito_mov_cita
                    FOREIGN KEY (id_cita_origen) REFERENCES citataller(id) ON DELETE SET NULL;
                END IF;
            END IF;
        END$$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_credito_mov_tenant'
            ) THEN
                ALTER TABLE clientefinal_credito_mov
                ADD CONSTRAINT fk_credito_mov_tenant
                FOREIGN KEY (id_tenant) REFERENCES tenant(id) ON DELETE CASCADE;
            END IF;
        END$$;

        -- =====================================================
        -- 4. VISTA: saldo actual del cliente
        -- =====================================================
        CREATE OR REPLACE VIEW vw_clientefinal_saldo AS
        SELECT 
            id_cliente,
            id_tenant,
            currency,
            SUM(CASE WHEN tipo = 'CREDITO' THEN amount ELSE -amount END) AS saldo_actual
        FROM clientefinal_credito_mov
        GROUP BY id_cliente, id_tenant, currency;

        -- =====================================================
        -- 5. FUNCIÓN: obtener saldo
        -- =====================================================
        CREATE OR REPLACE FUNCTION fn_get_cliente_saldo(
            p_id_cliente BIGINT,
            p_currency TEXT DEFAULT 'eur'
        )
        RETURNS NUMERIC(10,2) AS $$
        DECLARE
            v_saldo NUMERIC(10,2);
        BEGIN
            SELECT COALESCE(SUM(
                CASE WHEN tipo = 'CREDITO' THEN amount ELSE -amount END
            ), 0)
            INTO v_saldo
            FROM clientefinal_credito_mov
            WHERE id_cliente = p_id_cliente AND currency = p_currency;
            
            RETURN v_saldo;
        END;
        $$ LANGUAGE plpgsql;

        -- =====================================================
        -- 6. COMENTARIOS
        -- =====================================================
        COMMENT ON TABLE clientefinal_credito_mov IS 'Ledger de movimientos de crédito (saldo a favor) de clientes';
        COMMENT ON COLUMN clientefinal_credito_mov.tipo IS 'CREDITO aumenta saldo, DEBITO lo reduce';
        COMMENT ON COLUMN clientefinal_credito_mov.concepto IS 'Descripción legible del movimiento';
        COMMENT ON VIEW vw_clientefinal_saldo IS 'Vista con saldo actual por cliente y moneda';
        COMMENT ON FUNCTION fn_get_cliente_saldo IS 'Retorna el saldo actual de un cliente en una moneda específica';
    `);

    console.log('[Migration] ✅ clientefinal_credito_mov ledger created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping clientefinal_credito_mov ledger...');

    await knex.raw(`
        DROP FUNCTION IF EXISTS fn_get_cliente_saldo(BIGINT, TEXT);
        DROP VIEW IF EXISTS vw_clientefinal_saldo;
        DROP TABLE IF EXISTS clientefinal_credito_mov CASCADE;
    `);

    console.log('[Migration] ✅ clientefinal_credito_mov ledger dropped');
};

exports.config = { transaction: true };
