/**
 * Migration: create_fidelizacion_tables
 * Source: backend/migrations/create_fidelizacion_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates loyalty/fidelization module tables:
 * - fidelizacion_programa: loyalty program config per tenant
 * - fidelizacion_miembro: enrolled customers
 * - fidelizacion_movimiento: points history
 * - fidelizacion_promo: simple promotions
 * - fidelizacion_tarjeta_link: public card access tokens
 * - fidelizacion_qr_sesion: dynamic QR with nonce
 * - vw_fidelizacion_saldo: points balance view
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating fidelizacion tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: fidelizacion_programa
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_programa (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            nombre VARCHAR(120) NOT NULL DEFAULT 'VERSA Puntos',
            etiqueta_puntos VARCHAR(40) NOT NULL DEFAULT 'Puntos',
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_programa_tenant
        ON fidelizacion_programa(id_tenant);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_programa_tenant_activo
        ON fidelizacion_programa(id_tenant, activo)
        WHERE activo = true;

        COMMENT ON TABLE fidelizacion_programa IS 'Configuración del programa de fidelización por tenant';

        -- =====================================================
        -- 2. TABLA: fidelizacion_miembro
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_miembro (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_programa BIGINT NOT NULL REFERENCES fidelizacion_programa(id) ON DELETE CASCADE,
            id_cliente BIGINT NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            member_code VARCHAR(32) NOT NULL,
            estado VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (estado IN ('active', 'blocked')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_miembro_tenant_cliente
        ON fidelizacion_miembro(id_tenant, id_cliente);

        CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_miembro_tenant_code
        ON fidelizacion_miembro(id_tenant, member_code);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_miembro_tenant_cliente
        ON fidelizacion_miembro(id_tenant, id_cliente);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_miembro_programa
        ON fidelizacion_miembro(id_programa);

        COMMENT ON TABLE fidelizacion_miembro IS 'Clientes inscritos en el programa de fidelización';

        -- =====================================================
        -- 3. TABLA: fidelizacion_movimiento
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_movimiento (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
            tipo VARCHAR(16) NOT NULL CHECK (tipo IN ('earn', 'adjust')),
            puntos INT NOT NULL,
            motivo VARCHAR(120) NOT NULL,
            ref_tipo VARCHAR(40) NULL,
            ref_id BIGINT NULL,
            created_by BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_movimiento_miembro
        ON fidelizacion_movimiento(id_tenant, id_miembro, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_movimiento_tenant
        ON fidelizacion_movimiento(id_tenant, created_at DESC);

        COMMENT ON TABLE fidelizacion_movimiento IS 'Historial de movimientos de puntos (sumar/ajustar)';

        -- =====================================================
        -- 4. TABLA: fidelizacion_promo
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_promo (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            titulo VARCHAR(80) NOT NULL,
            descripcion VARCHAR(200) NULL,
            starts_at TIMESTAMPTZ NOT NULL,
            ends_at TIMESTAMPTZ NOT NULL,
            activo BOOLEAN NOT NULL DEFAULT true,
            created_by BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT chk_promo_fechas CHECK (ends_at >= starts_at)
        );

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_promo_tenant_activo
        ON fidelizacion_promo(id_tenant, activo, starts_at, ends_at)
        WHERE activo = true;

        COMMENT ON TABLE fidelizacion_promo IS 'Promociones simples (texto) por tenant';

        -- =====================================================
        -- 5. TABLA: fidelizacion_tarjeta_link
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_tarjeta_link (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
            public_token_hash TEXT NOT NULL,
            token_last4 VARCHAR(4) NULL,
            expires_at TIMESTAMPTZ NULL,
            last_opened_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_tarjeta_link_miembro
        ON fidelizacion_tarjeta_link(id_miembro);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_tarjeta_link_tenant_miembro
        ON fidelizacion_tarjeta_link(id_tenant, id_miembro);

        COMMENT ON TABLE fidelizacion_tarjeta_link IS 'Links públicos para acceso a la tarjeta (token hasheado)';

        -- =====================================================
        -- 6. TABLA: fidelizacion_qr_sesion
        -- =====================================================
        CREATE TABLE IF NOT EXISTS fidelizacion_qr_sesion (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
            nonce_hash TEXT NOT NULL,
            issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_qr_sesion_miembro
        ON fidelizacion_qr_sesion(id_tenant, id_miembro, expires_at DESC);

        CREATE INDEX IF NOT EXISTS idx_fidelizacion_qr_sesion_expires
        ON fidelizacion_qr_sesion(expires_at)
        WHERE used_at IS NULL;

        COMMENT ON TABLE fidelizacion_qr_sesion IS 'Sesiones de QR dinámico con nonce para prevenir reutilización';

        -- =====================================================
        -- 7. VIEW: vw_fidelizacion_saldo
        -- =====================================================
        CREATE OR REPLACE VIEW vw_fidelizacion_saldo AS
        SELECT 
            m.id AS id_miembro,
            m.id_tenant,
            m.id_cliente,
            m.member_code,
            m.estado,
            COALESCE(SUM(mov.puntos), 0)::INT AS balance
        FROM fidelizacion_miembro m
        LEFT JOIN fidelizacion_movimiento mov ON mov.id_miembro = m.id
        GROUP BY m.id, m.id_tenant, m.id_cliente, m.member_code, m.estado;

        COMMENT ON VIEW vw_fidelizacion_saldo IS 'Vista de saldos de puntos por miembro';

        -- =====================================================
        -- TRIGGERS para updated_at
        -- =====================================================
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_programa_updated_at') THEN
                CREATE TRIGGER update_fidelizacion_programa_updated_at
                BEFORE UPDATE ON fidelizacion_programa
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_miembro_updated_at') THEN
                CREATE TRIGGER update_fidelizacion_miembro_updated_at
                BEFORE UPDATE ON fidelizacion_miembro
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_promo_updated_at') THEN
                CREATE TRIGGER update_fidelizacion_promo_updated_at
                BEFORE UPDATE ON fidelizacion_promo
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_tarjeta_link_updated_at') THEN
                CREATE TRIGGER update_fidelizacion_tarjeta_link_updated_at
                BEFORE UPDATE ON fidelizacion_tarjeta_link
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END$$;
    `);

    console.log('[Migration] ✅ Fidelizacion tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping fidelizacion tables...');

    await knex.raw(`
        DROP VIEW IF EXISTS vw_fidelizacion_saldo;
        DROP TRIGGER IF EXISTS update_fidelizacion_tarjeta_link_updated_at ON fidelizacion_tarjeta_link;
        DROP TRIGGER IF EXISTS update_fidelizacion_promo_updated_at ON fidelizacion_promo;
        DROP TRIGGER IF EXISTS update_fidelizacion_miembro_updated_at ON fidelizacion_miembro;
        DROP TRIGGER IF EXISTS update_fidelizacion_programa_updated_at ON fidelizacion_programa;
        DROP TABLE IF EXISTS fidelizacion_qr_sesion CASCADE;
        DROP TABLE IF EXISTS fidelizacion_tarjeta_link CASCADE;
        DROP TABLE IF EXISTS fidelizacion_promo CASCADE;
        DROP TABLE IF EXISTS fidelizacion_movimiento CASCADE;
        DROP TABLE IF EXISTS fidelizacion_miembro CASCADE;
        DROP TABLE IF EXISTS fidelizacion_programa CASCADE;
    `);

    console.log('[Migration] ✅ Fidelizacion tables dropped');
};

exports.config = { transaction: true };
