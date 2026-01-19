/**
 * Migration: create_cuentas_corrientes_tables
 * Source: backend/migrations/create_cuentas_corrientes_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates credit account system tables:
 * - cuentacorriente: master credit account per customer
 * - movimientocuenta: account movement history
 * - v_cuentas_corrientes_resumen: summary view
 * - Adds en_cuenta_corriente and id_cuenta_corriente columns to orden
 * - Trigger for automatic balance updates
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating cuentas corrientes tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: cuentacorriente
        -- =====================================================
        CREATE TABLE IF NOT EXISTS cuentacorriente (
            id              BIGSERIAL PRIMARY KEY,
            id_cliente      BIGINT NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            limite_credito  NUMERIC(14,2) NOT NULL DEFAULT 0,
            saldo_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
            estado          TEXT NOT NULL DEFAULT 'ACTIVA',
            fecha_apertura  DATE NOT NULL DEFAULT current_date,
            notas           TEXT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      BIGINT NULL REFERENCES usuario(id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_cuentacorriente_cliente_tenant
        ON cuentacorriente(id_cliente, id_tenant);

        CREATE INDEX IF NOT EXISTS idx_cuentacorriente_tenant
        ON cuentacorriente(id_tenant);

        CREATE INDEX IF NOT EXISTS idx_cuentacorriente_estado
        ON cuentacorriente(estado);

        COMMENT ON TABLE cuentacorriente IS 'Cuenta corriente de crédito para clientes';

        -- =====================================================
        -- 2. TABLA: movimientocuenta
        -- =====================================================
        CREATE TABLE IF NOT EXISTS movimientocuenta (
            id                  BIGSERIAL PRIMARY KEY,
            id_cuenta_corriente BIGINT NOT NULL REFERENCES cuentacorriente(id) ON DELETE CASCADE,
            tipo_movimiento     TEXT NOT NULL,
            importe             NUMERIC(14,2) NOT NULL,
            saldo_anterior      NUMERIC(14,2) NOT NULL,
            saldo_posterior     NUMERIC(14,2) NOT NULL,
            concepto            TEXT NOT NULL,
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

        -- =====================================================
        -- 3. ALTER TABLA orden
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

        -- =====================================================
        -- 4. Trigger para actualizar saldo
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

        DROP TRIGGER IF EXISTS trg_actualizar_saldo_cuenta ON movimientocuenta;
        CREATE TRIGGER trg_actualizar_saldo_cuenta
        AFTER INSERT ON movimientocuenta
        FOR EACH ROW
        EXECUTE FUNCTION actualizar_saldo_cuenta_corriente();

        -- =====================================================
        -- 5. Vista resumen
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
    `);

    console.log('[Migration] ✅ Cuentas corrientes tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping cuentas corrientes tables...');

    await knex.raw(`
        DROP VIEW IF EXISTS v_cuentas_corrientes_resumen;
        DROP TRIGGER IF EXISTS trg_actualizar_saldo_cuenta ON movimientocuenta;
        DROP FUNCTION IF EXISTS actualizar_saldo_cuenta_corriente();
        
        ALTER TABLE orden DROP COLUMN IF EXISTS id_cuenta_corriente;
        ALTER TABLE orden DROP COLUMN IF EXISTS en_cuenta_corriente;
        
        DROP TABLE IF EXISTS movimientocuenta CASCADE;
        DROP TABLE IF EXISTS cuentacorriente CASCADE;
    `);

    console.log('[Migration] ✅ Cuentas corrientes tables dropped');
};

exports.config = { transaction: true };
