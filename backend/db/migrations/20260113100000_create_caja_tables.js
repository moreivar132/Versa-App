/**
 * Migration: create_caja_tables
 * Source: backend/migrations/create_caja_chica_tables.js (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates cash register and petty cash tables:
 * - caja: cash register per branch
 * - cajamovimiento: cash movements
 * - cajacierre: register closings
 * - cajachica: petty cash per branch
 * - cajachicamovimiento: petty cash movements
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating caja (cash register) tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: caja
        -- =====================================================
        CREATE TABLE IF NOT EXISTS caja (
            id SERIAL PRIMARY KEY,
            id_sucursal INTEGER NOT NULL REFERENCES sucursal(id),
            id_usuario_apertura INTEGER REFERENCES usuario(id),
            fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_cierre TIMESTAMP,
            saldo_apertura DECIMAL(12,2) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_caja_sucursal ON caja(id_sucursal);
        CREATE INDEX IF NOT EXISTS idx_caja_estado ON caja(estado);

        COMMENT ON TABLE caja IS 'Caja registradora por sucursal';

        -- =====================================================
        -- 2. TABLA: cajamovimiento
        -- =====================================================
        CREATE TABLE IF NOT EXISTS cajamovimiento (
            id SERIAL PRIMARY KEY,
            id_caja INTEGER NOT NULL REFERENCES caja(id),
            id_usuario INTEGER REFERENCES usuario(id),
            id_medio_pago INTEGER,
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'INTERNO')),
            monto DECIMAL(12,2) NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            concepto VARCHAR(255),
            descripcion TEXT,
            origen_tipo VARCHAR(50),
            origen_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER REFERENCES usuario(id)
        );

        CREATE INDEX IF NOT EXISTS idx_cajamovimiento_caja ON cajamovimiento(id_caja);
        CREATE INDEX IF NOT EXISTS idx_cajamovimiento_tipo ON cajamovimiento(tipo);

        COMMENT ON TABLE cajamovimiento IS 'Movimientos de caja (ingresos/egresos)';

        -- =====================================================
        -- 3. TABLA: cajacierre
        -- =====================================================
        CREATE TABLE IF NOT EXISTS cajacierre (
            id SERIAL PRIMARY KEY,
            id_caja INTEGER NOT NULL REFERENCES caja(id),
            id_usuario INTEGER REFERENCES usuario(id),
            fecha_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            saldo_inicial DECIMAL(12,2) NOT NULL,
            saldo_final DECIMAL(12,2) NOT NULL,
            efectivo_contado DECIMAL(12,2) NOT NULL,
            diferencia DECIMAL(12,2) DEFAULT 0,
            apertura_siguiente DECIMAL(12,2) DEFAULT 0,
            a_caja_chica DECIMAL(12,2) DEFAULT 0,
            concepto VARCHAR(255),
            descripcion TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_cajacierre_caja ON cajacierre(id_caja);

        COMMENT ON TABLE cajacierre IS 'Cierres de caja con arqueo';

        -- =====================================================
        -- 4. TABLA: cajachica
        -- =====================================================
        CREATE TABLE IF NOT EXISTS cajachica (
            id SERIAL PRIMARY KEY,
            id_sucursal INTEGER NOT NULL REFERENCES sucursal(id),
            saldo_actual DECIMAL(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_cajachica_sucursal ON cajachica(id_sucursal);

        COMMENT ON TABLE cajachica IS 'Caja chica (fondo fijo) por sucursal';

        -- =====================================================
        -- 5. TABLA: cajachicamovimiento
        -- =====================================================
        DROP TABLE IF EXISTS cajachicamovimiento CASCADE;
        CREATE TABLE IF NOT EXISTS cajachicamovimiento (
            id SERIAL PRIMARY KEY,
            id_caja_chica INTEGER NOT NULL REFERENCES cajachica(id),
            id_usuario INTEGER REFERENCES usuario(id),
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'INTERNO')),
            monto DECIMAL(12,2) NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            concepto VARCHAR(255),
            descripcion TEXT,
            origen_tipo VARCHAR(50),
            origen_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER REFERENCES usuario(id)
        );

        CREATE INDEX IF NOT EXISTS idx_cajachicamovimiento_caja ON cajachicamovimiento(id_caja_chica);

        COMMENT ON TABLE cajachicamovimiento IS 'Movimientos de caja chica';
    `);

    console.log('[Migration] ✅ Caja tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping caja tables...');

    await knex.raw(`
        DROP TABLE IF EXISTS cajachicamovimiento CASCADE;
        DROP TABLE IF EXISTS cajachica CASCADE;
        DROP TABLE IF EXISTS cajacierre CASCADE;
        DROP TABLE IF EXISTS cajamovimiento CASCADE;
        DROP TABLE IF EXISTS caja CASCADE;
    `);

    console.log('[Migration] ✅ Caja tables dropped');
};

exports.config = { transaction: true };
