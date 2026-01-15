-- ============================================
-- MARKETPLACE CONSTRAINTS & INDEXES MIGRATION
-- Mejoras para integridad de datos y rendimiento
-- Fecha: 2026-01-15
-- ============================================

-- ============================================
-- 1. CONSTRAINTS PARA COORDENADAS
-- ============================================

-- Constraint para validar rango de latitud en sucursal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_sucursal_lat_range'
    ) THEN
        ALTER TABLE public.sucursal
        ADD CONSTRAINT chk_sucursal_lat_range 
        CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));
    END IF;
END $$;

-- Constraint para validar rango de longitud en sucursal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_sucursal_lng_range'
    ) THEN
        ALTER TABLE public.sucursal
        ADD CONSTRAINT chk_sucursal_lng_range 
        CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));
    END IF;
END $$;

-- Constraint para validar rango de latitud en marketplace_listing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_mktplace_listing_lat_range'
    ) THEN
        ALTER TABLE public.marketplace_listing
        ADD CONSTRAINT chk_mktplace_listing_lat_range 
        CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));
    END IF;
END $$;

-- Constraint para validar rango de longitud en marketplace_listing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_mktplace_listing_lng_range'
    ) THEN
        ALTER TABLE public.marketplace_listing
        ADD CONSTRAINT chk_mktplace_listing_lng_range 
        CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));
    END IF;
END $$;

-- ============================================
-- 2. ÍNDICES PARA RENDIMIENTO
-- ============================================

-- Índice para búsqueda de sucursales activas
CREATE INDEX IF NOT EXISTS idx_sucursal_activa 
ON public.sucursal (activa) 
WHERE activa = true;

-- Índice para búsqueda de marketplace_listing por sucursal y estado
CREATE INDEX IF NOT EXISTS idx_mktplace_listing_sucursal_activo 
ON public.marketplace_listing (id_sucursal, activo) 
WHERE activo = true;

-- Índice para búsqueda por tenant en marketplace_listing
CREATE INDEX IF NOT EXISTS idx_mktplace_listing_tenant 
ON public.marketplace_listing (id_tenant);

-- Índice para búsqueda de servicios por sucursal
CREATE INDEX IF NOT EXISTS idx_mktplace_servicio_sucursal_activo 
ON public.marketplace_servicio_sucursal (id_sucursal, activo) 
WHERE activo = true;

-- Índice para promociones activas por fecha
CREATE INDEX IF NOT EXISTS idx_mktplace_promo_activo_fecha 
ON public.marketplace_promocion (id_sucursal, activo, fecha_fin) 
WHERE activo = true;

-- Índice para reseñas aprobadas por sucursal
CREATE INDEX IF NOT EXISTS idx_mktplace_review_sucursal_aprobado 
ON public.marketplace_review (id_sucursal, aprobado, created_at DESC) 
WHERE aprobado = true;

-- Índice para coordenadas geográficas (si se implementa búsqueda por distancia)
CREATE INDEX IF NOT EXISTS idx_sucursal_coords 
ON public.sucursal (lat, lng) 
WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mktplace_listing_coords 
ON public.marketplace_listing (lat, lng) 
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================
-- 3. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON CONSTRAINT chk_sucursal_lat_range ON public.sucursal IS 
'Garantiza que la latitud está en el rango válido -90 a 90, o es NULL';

COMMENT ON CONSTRAINT chk_sucursal_lng_range ON public.sucursal IS 
'Garantiza que la longitud está en el rango válido -180 a 180, o es NULL';

-- ============================================
-- 4. BACKFILL: REGISTRAR SUCURSALES SIN COORDS
-- ============================================

-- No modificamos datos aquí, solo registramos en un log virtual
-- El frontend se encarga de degradar gracefully

-- Para obtener lista de sucursales sin coords:
-- SELECT id, nombre, direccion FROM public.sucursal 
-- WHERE (lat IS NULL OR lng IS NULL) AND activa = true;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Migración de Marketplace constraints e índices completada';
END $$;
