-- =====================================================
-- MIGRACIÓN: Módulo Marketplace
-- Descripción: Crea todas las tablas necesarias para el
--              marketplace estilo Treatwell multi-tenant
-- Fecha: 2025-12-27
-- =====================================================

-- =====================================================
-- 1. TABLA: marketplace_listing
-- Perfil público por sucursal para el marketplace
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

-- Constraints e índices
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
COMMENT ON COLUMN marketplace_listing.fotos_json IS 'Array de URLs de fotos del taller';
COMMENT ON COLUMN marketplace_listing.horario_json IS 'JSON con horarios del taller por día';

-- =====================================================
-- 2. TABLA: marketplace_servicio
-- Catálogo global de servicios para el marketplace
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

-- Constraints e índices
CREATE UNIQUE INDEX IF NOT EXISTS ux_marketplace_servicio_nombre
ON marketplace_servicio(nombre);

CREATE INDEX IF NOT EXISTS idx_marketplace_servicio_categoria
ON marketplace_servicio(categoria, activo)
WHERE activo = true;

COMMENT ON TABLE marketplace_servicio IS 'Catálogo global de servicios disponibles en el marketplace';
COMMENT ON COLUMN marketplace_servicio.categoria IS 'Categoría del servicio (moto, coche, bici, etc)';

-- =====================================================
-- 3. TABLA: marketplace_servicio_sucursal
-- Servicios ofrecidos por cada sucursal con precio/duración
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

-- Constraints e índices
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
COMMENT ON COLUMN marketplace_servicio_sucursal.rank_destacado IS 'Orden de destacado (menor = más destacado)';
COMMENT ON COLUMN marketplace_servicio_sucursal.precio_desde IS 'Si true, el precio es "desde" ese valor';

-- =====================================================
-- 4. TABLA: marketplace_promo
-- Promociones y ofertas por sucursal/servicio
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketplace_promo_sucursal
ON marketplace_promo(id_sucursal, activo, fecha_inicio, fecha_fin)
WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_marketplace_promo_servicio
ON marketplace_promo(id_servicio, activo)
WHERE id_servicio IS NOT NULL AND activo = true;

CREATE INDEX IF NOT EXISTS idx_marketplace_promo_tenant
ON marketplace_promo(id_tenant);

COMMENT ON TABLE marketplace_promo IS 'Promociones y ofertas del marketplace por sucursal';
COMMENT ON COLUMN marketplace_promo.dias_semana_json IS 'Array de días (1=Lun, 7=Dom) en que aplica la promo';
COMMENT ON COLUMN marketplace_promo.horas_json IS 'Rango horario {"from":"10:00","to":"14:00"}';

-- =====================================================
-- 5. TABLA: marketplace_review
-- Reseñas verificadas de clientes
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

-- Constraints e índices para evitar reviews duplicadas
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
COMMENT ON COLUMN marketplace_review.visible IS 'Si false, la reseña fue ocultada por el admin';

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

-- Aplicar trigger a las tablas que lo necesitan
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

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
