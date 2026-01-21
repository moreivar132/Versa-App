-- ============================================================
-- Migración: clientefinal_credito_mov (Ledger de saldo a favor)
-- Descripción: Tabla para registrar movimientos de crédito/débito del cliente
-- Autor: VERSA
-- Fecha: 2024
-- ============================================================

-- Crear tabla de movimientos de crédito (ledger)
CREATE TABLE IF NOT EXISTS clientefinal_credito_mov (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL,
    id_cliente BIGINT NOT NULL,
    
    -- Referencia a la cita que originó el movimiento (nullable)
    id_cita_origen BIGINT NULL,
    
    -- Tipo de movimiento
    -- CREDITO: Aumenta el saldo a favor (ej: cancelación con pago previo)
    -- DEBITO: Disminuye el saldo a favor (ej: uso del saldo en un servicio)
    tipo TEXT NOT NULL CHECK (tipo IN ('CREDITO', 'DEBITO')),
    
    -- Descripción del movimiento
    concepto TEXT NOT NULL,
    
    -- Monto y moneda
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'eur',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Índice principal para consultas por cliente
CREATE INDEX IF NOT EXISTS idx_credito_mov_cliente_fecha 
    ON clientefinal_credito_mov(id_cliente, created_at DESC);

-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_credito_mov_tenant 
    ON clientefinal_credito_mov(id_tenant);

-- Índice para buscar por cita origen
CREATE INDEX IF NOT EXISTS idx_credito_mov_cita 
    ON clientefinal_credito_mov(id_cita_origen) 
    WHERE id_cita_origen IS NOT NULL;

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

-- FK a clientefinal
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

-- FK a citataller (nullable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_credito_mov_cita'
    ) THEN
        ALTER TABLE clientefinal_credito_mov
        ADD CONSTRAINT fk_credito_mov_cita
        FOREIGN KEY (id_cita_origen) REFERENCES citataller(id) ON DELETE SET NULL;
    END IF;
END$$;

-- FK a tenant (si existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tenant'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_credito_mov_tenant'
        ) THEN
            ALTER TABLE clientefinal_credito_mov
            ADD CONSTRAINT fk_credito_mov_tenant
            FOREIGN KEY (id_tenant) REFERENCES tenant(id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$;

-- ============================================================
-- Vista para saldo actual del cliente
-- ============================================================

CREATE OR REPLACE VIEW vw_clientefinal_saldo AS
SELECT 
    id_cliente,
    id_tenant,
    currency,
    SUM(CASE WHEN tipo = 'CREDITO' THEN amount ELSE -amount END) AS saldo_actual
FROM clientefinal_credito_mov
GROUP BY id_cliente, id_tenant, currency;

-- ============================================================
-- Función helper para obtener saldo
-- ============================================================

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

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON TABLE clientefinal_credito_mov IS 'Ledger de movimientos de crédito (saldo a favor) de clientes';
COMMENT ON COLUMN clientefinal_credito_mov.tipo IS 'CREDITO aumenta saldo, DEBITO lo reduce';
COMMENT ON COLUMN clientefinal_credito_mov.concepto IS 'Descripción legible del movimiento';
COMMENT ON VIEW vw_clientefinal_saldo IS 'Vista con saldo actual por cliente y moneda';
COMMENT ON FUNCTION fn_get_cliente_saldo IS 'Retorna el saldo actual de un cliente en una moneda específica';
