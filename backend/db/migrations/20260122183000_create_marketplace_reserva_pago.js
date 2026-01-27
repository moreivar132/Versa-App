/**
 * Migration: create_marketplace_reserva_pago
 * Source: backend/archive/legacy-migrations/create_marketplace_reserva_pago.sql
 * Module: Marketplace
 * Risk Level: Medio
 * 
 * Creates marketplace payment tracking table for Stripe Checkout:
 * - marketplace_reserva_pago: payment records for appointments
 * - Foreign keys to sucursal, clientefinal, citataller, tenant
 * - Trigger for updated_at
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating marketplace_reserva_pago table...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: marketplace_reserva_pago
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_reserva_pago (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL,
            id_sucursal BIGINT NOT NULL,
            id_cita BIGINT NOT NULL,
            id_cliente BIGINT NULL,
            
            payment_mode TEXT NOT NULL CHECK (payment_mode IN ('DEPOSITO', 'TOTAL')),
            
            amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
            currency TEXT NOT NULL DEFAULT 'eur',
            
            status TEXT NOT NULL DEFAULT 'CREATED' 
                CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELED', 'CREDITED')),
            
            stripe_checkout_session_id TEXT NULL,
            stripe_payment_intent_id TEXT NULL,
            checkout_url TEXT NULL,
            
            metadata_json JSONB NULL,
            
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- =====================================================
        -- 2. ÍNDICES
        -- =====================================================
        CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_pago_cita_mode 
            ON marketplace_reserva_pago(id_cita, payment_mode);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_pago_stripe_session 
            ON marketplace_reserva_pago(stripe_checkout_session_id) 
            WHERE stripe_checkout_session_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_reserva_pago_cliente_fecha 
            ON marketplace_reserva_pago(id_cliente, created_at DESC)
            WHERE id_cliente IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_reserva_pago_status 
            ON marketplace_reserva_pago(status);

        CREATE INDEX IF NOT EXISTS idx_reserva_pago_tenant 
            ON marketplace_reserva_pago(id_tenant);

        -- =====================================================
        -- 3. FOREIGN KEYS
        -- =====================================================
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_reserva_pago_sucursal'
            ) THEN
                ALTER TABLE marketplace_reserva_pago
                ADD CONSTRAINT fk_reserva_pago_sucursal
                FOREIGN KEY (id_sucursal) REFERENCES sucursal(id) ON DELETE CASCADE;
            END IF;
        END$$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_reserva_pago_cliente'
            ) THEN
                ALTER TABLE marketplace_reserva_pago
                ADD CONSTRAINT fk_reserva_pago_cliente
                FOREIGN KEY (id_cliente) REFERENCES clientefinal(id) ON DELETE SET NULL;
            END IF;
        END$$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_reserva_pago_cita'
            ) THEN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'citataller') THEN
                    ALTER TABLE marketplace_reserva_pago
                    ADD CONSTRAINT fk_reserva_pago_cita
                    FOREIGN KEY (id_cita) REFERENCES citataller(id) ON DELETE CASCADE;
                END IF;
            END IF;
        END$$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_reserva_pago_tenant'
            ) THEN
                ALTER TABLE marketplace_reserva_pago
                ADD CONSTRAINT fk_reserva_pago_tenant
                FOREIGN KEY (id_tenant) REFERENCES tenant(id) ON DELETE CASCADE;
            END IF;
        END$$;

        -- =====================================================
        -- 4. TRIGGER para updated_at
        -- =====================================================
        CREATE OR REPLACE FUNCTION update_reserva_pago_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_update_reserva_pago_timestamp ON marketplace_reserva_pago;
        CREATE TRIGGER trigger_update_reserva_pago_timestamp
        BEFORE UPDATE ON marketplace_reserva_pago
        FOR EACH ROW
        EXECUTE FUNCTION update_reserva_pago_updated_at();

        -- =====================================================
        -- 5. COMENTARIOS
        -- =====================================================
        COMMENT ON TABLE marketplace_reserva_pago IS 'Registra los pagos de reservas del marketplace (Stripe Checkout)';
        COMMENT ON COLUMN marketplace_reserva_pago.payment_mode IS 'DEPOSITO para señal, TOTAL para pago completo';
        COMMENT ON COLUMN marketplace_reserva_pago.status IS 'Estado del pago: CREATED, PENDING, PAID, EXPIRED, FAILED, CANCELED, CREDITED';
    `);

    console.log('[Migration] ✅ marketplace_reserva_pago table created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping marketplace_reserva_pago table...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS trigger_update_reserva_pago_timestamp ON marketplace_reserva_pago;
        DROP FUNCTION IF EXISTS update_reserva_pago_updated_at();
        DROP TABLE IF EXISTS marketplace_reserva_pago CASCADE;
    `);

    console.log('[Migration] ✅ marketplace_reserva_pago table dropped');
};

exports.config = { transaction: true };
