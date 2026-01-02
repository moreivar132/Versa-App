-- =====================================================
-- MIGRACIÓN: Módulo de Cuentas Corrientes
-- Descripción: Sistema de crédito para clientes que
--              permite diferir el pago de órdenes
-- =====================================================

-- =====================================================
-- 1. TABLA: cuentacorriente
-- Registro maestro de cuenta corriente por cliente
-- =====================================================
CREATE TABLE IF NOT EXISTS cuentacorriente (
    id              BIGSERIAL PRIMARY KEY,
    id_cliente      BIGINT NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
    id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    limite_credito  NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo_actual    NUMERIC(14,2) NOT NULL DEFAULT 0, -- Positivo = el cliente debe dinero
    estado          TEXT NOT NULL DEFAULT 'ACTIVA', -- ACTIVA, SUSPENDIDA, CERRADA
    fecha_apertura  DATE NOT NULL DEFAULT current_date,
    notas           TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT NULL REFERENCES usuario(id)
);

-- Índice único: un cliente solo puede tener una cuenta corriente por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_cuentacorriente_cliente_tenant
ON cuentacorriente(id_cliente, id_tenant);

CREATE INDEX IF NOT EXISTS idx_cuentacorriente_tenant
ON cuentacorriente(id_tenant);

CREATE INDEX IF NOT EXISTS idx_cuentacorriente_estado
ON cuentacorriente(estado);

COMMENT ON TABLE cuentacorriente IS 'Cuenta corriente de crédito para clientes';
COMMENT ON COLUMN cuentacorriente.saldo_actual IS 'Saldo pendiente del cliente. Positivo = debe dinero';

-- =====================================================
-- 2. TABLA: movimientocuenta
-- Historial de movimientos de la cuenta corriente
-- =====================================================
CREATE TABLE IF NOT EXISTS movimientocuenta (
    id                  BIGSERIAL PRIMARY KEY,
    id_cuenta_corriente BIGINT NOT NULL REFERENCES cuentacorriente(id) ON DELETE CASCADE,
    tipo_movimiento     TEXT NOT NULL, -- 'CARGO' (deuda) o 'ABONO' (pago)
    importe             NUMERIC(14,2) NOT NULL,
    saldo_anterior      NUMERIC(14,2) NOT NULL,
    saldo_posterior     NUMERIC(14,2) NOT NULL,
    concepto            TEXT NOT NULL,
    -- Referencias opcionales
    id_orden            BIGINT NULL REFERENCES orden(id),
    id_factura          BIGINT NULL REFERENCES facturacabecera(id),
    id_orden_pago       BIGINT NULL REFERENCES ordenpago(id),
    referencia_externa  TEXT NULL,
    fecha_movimiento    DATE NOT NULL DEFAULT current_date,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT NULL REFERENCES usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_movimientocuenta_cuenta
ON movimientocuenta(id_cuenta_corriente);

CREATE INDEX IF NOT EXISTS idx_movimientocuenta_fecha
ON movimientocuenta(fecha_movimiento DESC);

CREATE INDEX IF NOT EXISTS idx_movimientocuenta_tipo
ON movimientocuenta(tipo_movimiento);

CREATE INDEX IF NOT EXISTS idx_movimientocuenta_orden
ON movimientocuenta(id_orden)
WHERE id_orden IS NOT NULL;

COMMENT ON TABLE movimientocuenta IS 'Historial de movimientos de cuentas corrientes';
COMMENT ON COLUMN movimientocuenta.tipo_movimiento IS 'CARGO = aumenta deuda, ABONO = disminuye deuda';

-- =====================================================
-- 3. ALTERACIÓN TABLA orden
-- Añadir campo para marcar como "pasado a cuenta corriente"
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='orden' AND column_name='en_cuenta_corriente'
    ) THEN
        ALTER TABLE orden
        ADD COLUMN en_cuenta_corriente BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='orden' AND column_name='id_cuenta_corriente'
    ) THEN
        ALTER TABLE orden
        ADD COLUMN id_cuenta_corriente BIGINT NULL REFERENCES cuentacorriente(id);
    END IF;
END $$;

COMMENT ON COLUMN orden.en_cuenta_corriente IS 'Indica si el saldo pendiente se cargó a cuenta corriente del cliente';
COMMENT ON COLUMN orden.id_cuenta_corriente IS 'Referencia a la cuenta corriente donde se cargó la deuda';

-- =====================================================
-- 4. Función para actualizar saldo de cuenta corriente
-- Se llama automáticamente al insertar movimientos
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_saldo_cuenta_corriente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_movimiento = 'CARGO' THEN
        UPDATE cuentacorriente 
        SET saldo_actual = saldo_actual + NEW.importe,
            updated_at = NOW()
        WHERE id = NEW.id_cuenta_corriente;
    ELSIF NEW.tipo_movimiento = 'ABONO' THEN
        UPDATE cuentacorriente 
        SET saldo_actual = saldo_actual - NEW.importe,
            updated_at = NOW()
        WHERE id = NEW.id_cuenta_corriente;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar saldo automáticamente
DROP TRIGGER IF EXISTS trg_actualizar_saldo_cuenta ON movimientocuenta;
CREATE TRIGGER trg_actualizar_saldo_cuenta
AFTER INSERT ON movimientocuenta
FOR EACH ROW
EXECUTE FUNCTION actualizar_saldo_cuenta_corriente();

-- =====================================================
-- 5. Vista útil para consulta rápida de cuentas
-- =====================================================
CREATE OR REPLACE VIEW v_cuentas_corrientes_resumen AS
SELECT 
    cc.id,
    cc.id_cliente,
    cf.nombre AS cliente_nombre,
    cf.telefono AS cliente_telefono,
    cf.documento AS cliente_nif,
    cc.id_tenant,
    cc.limite_credito,
    cc.saldo_actual,
    cc.estado,
    cc.fecha_apertura,
    cc.notas,
    (SELECT COUNT(*) FROM movimientocuenta mc WHERE mc.id_cuenta_corriente = cc.id) AS total_movimientos,
    (SELECT MAX(mc.fecha_movimiento) FROM movimientocuenta mc WHERE mc.id_cuenta_corriente = cc.id) AS ultimo_movimiento
FROM cuentacorriente cc
JOIN clientefinal cf ON cc.id_cliente = cf.id;

COMMENT ON VIEW v_cuentas_corrientes_resumen IS 'Vista resumida de cuentas corrientes con datos del cliente';
