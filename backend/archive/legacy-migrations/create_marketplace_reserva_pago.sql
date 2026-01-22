-- ============================================================
-- Migración: marketplace_reserva_pago
-- Descripción: Tabla para registrar pagos de reservas del marketplace
-- Autor: VERSA
-- Fecha: 2024
-- ============================================================

-- Crear tabla de pagos de reservas
CREATE TABLE IF NOT EXISTS marketplace_reserva_pago (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL,
    id_sucursal BIGINT NOT NULL,
    id_cita BIGINT NOT NULL,
    id_cliente BIGINT NULL,
    
    -- Modo de pago: DEPOSITO (señal) o TOTAL (pago completo)
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('DEPOSITO', 'TOTAL')),
    
    -- Monto y moneda
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'eur',
    
    -- Estado del pago
    -- CREATED: Recién creado, aún sin checkout session
    -- PENDING: Checkout session creada, esperando pago
    -- PAID: Pago completado
    -- EXPIRED: Checkout session expiró sin completar
    -- FAILED: Pago falló
    -- CANCELED: Cita cancelada, pago anulado/acreditado
    -- CREDITED: Pago convertido a saldo a favor (si se cancela después de pagar)
    status TEXT NOT NULL DEFAULT 'CREATED' 
        CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELED', 'CREDITED')),
    
    -- Datos de Stripe
    stripe_checkout_session_id TEXT NULL,
    stripe_payment_intent_id TEXT NULL,
    checkout_url TEXT NULL,
    
    -- Metadata adicional (JSON)
    metadata_json JSONB NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSTRAINTS E ÍNDICES
-- ============================================================

-- Permitir 1 pago por modo por cita (depósito + total ambos posibles)
-- Si solo quieres 1 pago total por cita, cambia a UNIQUE(id_cita)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_pago_cita_mode 
    ON marketplace_reserva_pago(id_cita, payment_mode);

-- Índice único para stripe_checkout_session_id cuando no es null
CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_pago_stripe_session 
    ON marketplace_reserva_pago(stripe_checkout_session_id) 
    WHERE stripe_checkout_session_id IS NOT NULL;

-- Índice para buscar por cliente y fecha
CREATE INDEX IF NOT EXISTS idx_reserva_pago_cliente_fecha 
    ON marketplace_reserva_pago(id_cliente, created_at DESC)
    WHERE id_cliente IS NOT NULL;

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_reserva_pago_status 
    ON marketplace_reserva_pago(status);

-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_reserva_pago_tenant 
    ON marketplace_reserva_pago(id_tenant);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

-- FK a sucursal
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

-- FK a clientefinal (nullable)
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

-- FK a citataller
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_reserva_pago_cita'
    ) THEN
        ALTER TABLE marketplace_reserva_pago
        ADD CONSTRAINT fk_reserva_pago_cita
        FOREIGN KEY (id_cita) REFERENCES citataller(id) ON DELETE CASCADE;
    END IF;
END$$;

-- FK a tenant (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tenant'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_reserva_pago_tenant'
        ) THEN
            ALTER TABLE marketplace_reserva_pago
            ADD CONSTRAINT fk_reserva_pago_tenant
            FOREIGN KEY (id_tenant) REFERENCES tenant(id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$;

-- ============================================================
-- TRIGGER para updated_at
-- ============================================================

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

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON TABLE marketplace_reserva_pago IS 'Registra los pagos de reservas del marketplace (Stripe Checkout)';
COMMENT ON COLUMN marketplace_reserva_pago.payment_mode IS 'DEPOSITO para señal, TOTAL para pago completo';
COMMENT ON COLUMN marketplace_reserva_pago.status IS 'Estado del pago: CREATED, PENDING, PAID, EXPIRED, FAILED, CANCELED, CREDITED';
