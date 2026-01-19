/**
 * Migration: create_marketplace_tables
 * Source: backend/migrations/create_marketplace_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates marketplace module tables:
 * - marketplace_listing: public profile per branch
 * - marketplace_servicio: global service catalog
 * - marketplace_servicio_sucursal: services offered per branch
 * - marketplace_promo: promotions and offers
 * - marketplace_review: verified customer reviews
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating marketplace tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: marketplace_listing
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_listing (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            activo BOOLEAN NOT NULL DEFAULT false,
            titulo_publico TEXT NULL,
            descripcion_publica TEXT NULL,
            whatsapp_publico TEXT NULL,
            telefono_publico TEXT NULL,
            email_publico TEXT NULL,
            lat NUMERIC(10,7) NULL,
            lng NUMERIC(10,7) NULL,
            fotos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            horario_json JSONB NULL,
            politica_cancelacion TEXT NULL,
            reserva_online_activa BOOLEAN NOT NULL DEFAULT true,
            min_horas_anticipacion INT NOT NULL DEFAULT 2,
            cancelacion_horas_limite INT NOT NULL DEFAULT 24,
            deposito_activo BOOLEAN NOT NULL DEFAULT false,
            deposito_tipo TEXT NULL CHECK (deposito_tipo IN ('FIJO', 'PORCENTAJE')),
            deposito_valor NUMERIC(10,2) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_listing_sucursal
        ON marketplace_listing(id_sucursal);

        CREATE INDEX IF NOT EXISTS idx_marketplace_listing_activo
        ON marketplace_listing(activo)
        WHERE activo = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_listing_tenant_activo
        ON marketplace_listing(id_tenant, activo);

        CREATE INDEX IF NOT EXISTS idx_marketplace_listing_geo
        ON marketplace_listing(lat, lng)
        WHERE lat IS NOT NULL AND lng IS NOT NULL AND activo = true;

        COMMENT ON TABLE marketplace_listing IS 'Perfil público de sucursales habilitadas en el marketplace';

        -- =====================================================
        -- 2. TABLA: marketplace_servicio
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_servicio (
            id BIGSERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            descripcion TEXT NULL,
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_servicio_nombre
        ON marketplace_servicio(nombre);

        CREATE INDEX IF NOT EXISTS idx_marketplace_servicio_categoria
        ON marketplace_servicio(categoria, activo)
        WHERE activo = true;

        COMMENT ON TABLE marketplace_servicio IS 'Catálogo global de servicios disponibles en el marketplace';

        -- =====================================================
        -- 3. TABLA: marketplace_servicio_sucursal
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_servicio_sucursal (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            id_servicio BIGINT NOT NULL REFERENCES marketplace_servicio(id) ON DELETE CASCADE,
            precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
            duracion_min INT NOT NULL CHECK (duracion_min > 0),
            precio_desde BOOLEAN NOT NULL DEFAULT false,
            activo BOOLEAN NOT NULL DEFAULT true,
            rank_destacado INT NOT NULL DEFAULT 100,
            permite_reserva_online BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_servicio_sucursal
        ON marketplace_servicio_sucursal(id_sucursal, id_servicio);

        CREATE INDEX IF NOT EXISTS idx_marketplace_servicio_sucursal_activo
        ON marketplace_servicio_sucursal(id_sucursal, activo, rank_destacado)
        WHERE activo = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_servicio_sucursal_servicio
        ON marketplace_servicio_sucursal(id_servicio, activo)
        WHERE activo = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_servicio_sucursal_tenant
        ON marketplace_servicio_sucursal(id_tenant, id_sucursal);

        COMMENT ON TABLE marketplace_servicio_sucursal IS 'Servicios ofrecidos por cada sucursal con precio y duración';

        -- =====================================================
        -- 4. TABLA: marketplace_promo
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_promo (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            id_servicio BIGINT NULL REFERENCES marketplace_servicio(id) ON DELETE CASCADE,
            titulo TEXT NOT NULL,
            descripcion TEXT NULL,
            tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE', 'FIJO')),
            valor_descuento NUMERIC(10,2) NOT NULL CHECK (valor_descuento >= 0),
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_semana_json JSONB NULL,
            horas_json JSONB NULL,
            cupo_total INT NULL CHECK (cupo_total > 0),
            cupo_usado INT NOT NULL DEFAULT 0 CHECK (cupo_usado >= 0),
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_promo_cupo CHECK (cupo_total IS NULL OR cupo_usado <= cupo_total),
            CONSTRAINT chk_promo_fechas CHECK (fecha_fin >= fecha_inicio)
        );

        CREATE INDEX IF NOT EXISTS idx_marketplace_promo_sucursal
        ON marketplace_promo(id_sucursal, activo, fecha_inicio, fecha_fin)
        WHERE activo = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_promo_servicio
        ON marketplace_promo(id_servicio, activo)
        WHERE id_servicio IS NOT NULL AND activo = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_promo_tenant
        ON marketplace_promo(id_tenant);

        COMMENT ON TABLE marketplace_promo IS 'Promociones y ofertas del marketplace por sucursal';

        -- =====================================================
        -- 5. TABLA: marketplace_review
        -- =====================================================
        CREATE TABLE IF NOT EXISTS marketplace_review (
            id BIGSERIAL PRIMARY KEY,
            id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            id_cliente BIGINT NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            id_cita BIGINT NULL REFERENCES citataller(id) ON DELETE SET NULL,
            id_orden BIGINT NULL REFERENCES orden(id) ON DELETE SET NULL,
            rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comentario TEXT NULL,
            visible BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_review_tiene_cita_o_orden CHECK (
                id_cita IS NOT NULL OR id_orden IS NOT NULL
            )
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_review_cita
        ON marketplace_review(id_cita)
        WHERE id_cita IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_review_orden
        ON marketplace_review(id_orden)
        WHERE id_orden IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_marketplace_review_sucursal
        ON marketplace_review(id_sucursal, visible, created_at DESC)
        WHERE visible = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_review_rating
        ON marketplace_review(id_sucursal, rating)
        WHERE visible = true;

        CREATE INDEX IF NOT EXISTS idx_marketplace_review_cliente
        ON marketplace_review(id_cliente);

        COMMENT ON TABLE marketplace_review IS 'Reseñas verificadas de clientes (solo tras cita/orden)';

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
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_listing_updated_at') THEN
                CREATE TRIGGER update_marketplace_listing_updated_at
                BEFORE UPDATE ON marketplace_listing
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_servicio_updated_at') THEN
                CREATE TRIGGER update_marketplace_servicio_updated_at
                BEFORE UPDATE ON marketplace_servicio
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_servicio_sucursal_updated_at') THEN
                CREATE TRIGGER update_marketplace_servicio_sucursal_updated_at
                BEFORE UPDATE ON marketplace_servicio_sucursal
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_promo_updated_at') THEN
                CREATE TRIGGER update_marketplace_promo_updated_at
                BEFORE UPDATE ON marketplace_promo
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END$$;
    `);

    console.log('[Migration] ✅ Marketplace tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping marketplace tables...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS update_marketplace_promo_updated_at ON marketplace_promo;
        DROP TRIGGER IF EXISTS update_marketplace_servicio_sucursal_updated_at ON marketplace_servicio_sucursal;
        DROP TRIGGER IF EXISTS update_marketplace_servicio_updated_at ON marketplace_servicio;
        DROP TRIGGER IF EXISTS update_marketplace_listing_updated_at ON marketplace_listing;
        
        DROP TABLE IF EXISTS marketplace_review CASCADE;
        DROP TABLE IF EXISTS marketplace_promo CASCADE;
        DROP TABLE IF EXISTS marketplace_servicio_sucursal CASCADE;
        DROP TABLE IF EXISTS marketplace_servicio CASCADE;
        DROP TABLE IF EXISTS marketplace_listing CASCADE;
    `);

    console.log('[Migration] ✅ Marketplace tables dropped');
};

exports.config = { transaction: true };
