-- ============================================
-- MARKETPLACE AUDIT SCRIPT
-- Diagnóstico de datos para el módulo Marketplace
-- Ejecutar en PostgreSQL/Neon
-- Fecha: 2026-01-15
-- ============================================

-- ============================================
-- 1. DIAGNÓSTICO DE COORDENADAS
-- ============================================

-- 1.1 Sucursales con coords inválidas o nulas
SELECT 
    'SUCURSALES_SIN_COORDS' as check_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as sin_coords,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) as con_coords,
    ROUND(100.0 * COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) / NULLIF(COUNT(*), 0), 2) as pct_sin_coords
FROM public.sucursal
WHERE 1=1; -- Añadir filtro de tenant si es necesario

-- 1.2 Detalle de sucursales sin coordenadas
SELECT 
    'SUCURSAL_SIN_COORDS_DETALLE' as check_type,
    id,
    nombre,
    direccion,
    lat,
    lng,
    tenant_id
FROM public.sucursal
WHERE lat IS NULL 
   OR lng IS NULL 
   OR lat::text !~ '^-?[0-9]+\.?[0-9]*$'
   OR lng::text !~ '^-?[0-9]+\.?[0-9]*$'
ORDER BY id
LIMIT 50;

-- 1.3 Coordenadas fuera de rango
SELECT 
    'COORDS_FUERA_DE_RANGO' as check_type,
    id,
    nombre,
    lat,
    lng,
    CASE 
        WHEN ABS(lat::numeric) > 90 THEN 'LAT_INVALIDA'
        WHEN ABS(lng::numeric) > 180 THEN 'LNG_INVALIDA'
        ELSE 'DESCONOCIDO'
    END as problema
FROM public.sucursal
WHERE (lat IS NOT NULL AND ABS(lat::numeric) > 90)
   OR (lng IS NOT NULL AND ABS(lng::numeric) > 180);

-- ============================================
-- 2. INTEGRIDAD MARKETPLACE_LISTING
-- ============================================

-- 2.1 Listings huérfanos (sin sucursal válida)
SELECT 
    'LISTINGS_HUERFANOS' as check_type,
    ml.id,
    ml.id_sucursal,
    ml.titulo_publico,
    ml.activo
FROM public.marketplace_listing ml
LEFT JOIN public.sucursal s ON s.id = ml.id_sucursal
WHERE s.id IS NULL;

-- 2.2 Sucursales activas sin listing
SELECT 
    'SUCURSALES_SIN_LISTING' as check_type,
    s.id,
    s.nombre,
    s.tenant_id
FROM public.sucursal s
LEFT JOIN public.marketplace_listing ml ON ml.id_sucursal = s.id
WHERE ml.id IS NULL
  AND s.activa = true
ORDER BY s.id
LIMIT 50;

-- 2.3 Stats generales de marketplace_listing
SELECT 
    'MARKETPLACE_LISTING_STATS' as check_type,
    COUNT(*) as total_listings,
    COUNT(*) FILTER (WHERE activo = true) as activos,
    COUNT(*) FILTER (WHERE activo = false) as inactivos,
    COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as sin_coords,
    COUNT(*) FILTER (WHERE titulo_publico IS NULL OR titulo_publico = '') as sin_titulo,
    COUNT(*) FILTER (WHERE fotos_json IS NULL OR fotos_json = '[]') as sin_fotos
FROM public.marketplace_listing;

-- ============================================
-- 3. INTEGRIDAD MARKETPLACE_SERVICIO
-- ============================================

-- 3.1 Servicios huérfanos
SELECT 
    'SERVICIOS_HUERFANOS' as check_type,
    ms.id,
    ms.id_sucursal,
    ms.id_servicio,
    ms.precio
FROM public.marketplace_servicio ms
LEFT JOIN public.sucursal s ON s.id = ms.id_sucursal
WHERE s.id IS NULL;

-- 3.2 Stats de servicios por sucursal
SELECT 
    'SERVICIOS_POR_SUCURSAL' as check_type,
    id_sucursal,
    COUNT(*) as total_servicios,
    COUNT(*) FILTER (WHERE activo = true) as activos,
    AVG(precio)::numeric(10,2) as precio_promedio
FROM public.marketplace_servicio
GROUP BY id_sucursal
ORDER BY total_servicios DESC
LIMIT 20;

-- ============================================
-- 4. INTEGRIDAD DE TENANT
-- ============================================

-- 4.1 Sucursales sin tenant
SELECT 
    'SUCURSALES_SIN_TENANT' as check_type,
    id,
    nombre,
    tenant_id
FROM public.sucursal
WHERE tenant_id IS NULL;

-- 4.2 Marketplace listings sin tenant directo (inferir de sucursal)
SELECT 
    'LISTINGS_TENANT_CHECK' as check_type,
    ml.id,
    ml.id_sucursal,
    s.tenant_id as tenant_from_sucursal,
    CASE 
        WHEN s.tenant_id IS NULL THEN 'SIN_TENANT'
        ELSE 'OK'
    END as status
FROM public.marketplace_listing ml
JOIN public.sucursal s ON s.id = ml.id_sucursal
WHERE s.tenant_id IS NULL
LIMIT 20;

-- ============================================
-- 5. PROMOCIONES MARKETPLACE
-- ============================================

-- 5.1 Promociones expiradas aún activas
SELECT 
    'PROMOS_EXPIRADAS_ACTIVAS' as check_type,
    id,
    id_sucursal,
    titulo,
    fecha_fin,
    activo
FROM public.marketplace_promocion
WHERE activo = true
  AND fecha_fin < CURRENT_DATE
ORDER BY fecha_fin DESC
LIMIT 20;

-- 5.2 Stats de promociones
SELECT 
    'PROMOCIONES_STATS' as check_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE activo = true) as activas,
    COUNT(*) FILTER (WHERE fecha_fin >= CURRENT_DATE AND activo = true) as vigentes,
    COUNT(*) FILTER (WHERE fecha_fin < CURRENT_DATE) as expiradas
FROM public.marketplace_promocion;

-- ============================================
-- 6. RESEÑAS MARKETPLACE
-- ============================================

-- 6.1 Stats de reseñas
SELECT 
    'REVIEWS_STATS' as check_type,
    COUNT(*) as total_reviews,
    AVG(rating)::numeric(3,2) as rating_promedio,
    COUNT(*) FILTER (WHERE aprobado = true) as aprobadas,
    COUNT(*) FILTER (WHERE aprobado = false) as pendientes
FROM public.marketplace_review;

-- 6.2 Sucursales con más reseñas
SELECT 
    'TOP_SUCURSALES_REVIEWS' as check_type,
    id_sucursal,
    COUNT(*) as total_reviews,
    AVG(rating)::numeric(3,2) as rating_promedio
FROM public.marketplace_review
WHERE aprobado = true
GROUP BY id_sucursal
ORDER BY total_reviews DESC
LIMIT 10;

-- ============================================
-- 7. RESERVAS MARKETPLACE
-- ============================================

-- 7.1 Stats de reservas
SELECT 
    'RESERVAS_STATS' as check_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE estado = 'CONFIRMADA') as confirmadas,
    COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as pendientes,
    COUNT(*) FILTER (WHERE estado = 'CANCELADA') as canceladas,
    COUNT(*) FILTER (WHERE estado = 'COMPLETADA') as completadas
FROM public.marketplace_reserva;

-- 7.2 Reservas recientes
SELECT 
    'RESERVAS_ULTIMAS_24H' as check_type,
    COUNT(*) as total
FROM public.marketplace_reserva
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- ============================================
-- 8. ÍNDICES RECOMENDADOS
-- ============================================

-- 8.1 Verificar índices existentes en tablas marketplace
SELECT 
    'INDICES_MARKETPLACE' as check_type,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 'marketplace_%'
ORDER BY tablename, indexname;

-- ============================================
-- 9. SUGERENCIAS DE CLEANUP
-- ============================================

-- 9.1 Datos para limpiar/actualizar
SELECT 
    'DATOS_A_LIMPIAR' as check_type,
    'Sucursales sin coords' as tipo,
    COUNT(*) as cantidad
FROM public.sucursal WHERE lat IS NULL OR lng IS NULL
UNION ALL
SELECT 
    'DATOS_A_LIMPIAR',
    'Listings inactivos obsoletos (>1 año)',
    COUNT(*)
FROM public.marketplace_listing 
WHERE activo = false AND updated_at < NOW() - INTERVAL '1 year'
UNION ALL
SELECT 
    'DATOS_A_LIMPIAR',
    'Promociones expiradas hace >6 meses',
    COUNT(*)
FROM public.marketplace_promocion
WHERE fecha_fin < NOW() - INTERVAL '6 months';

-- ============================================
-- 10. RESUMEN EJECUTIVO
-- ============================================

SELECT 
    'RESUMEN' as check_type,
    json_build_object(
        'total_sucursales', (SELECT COUNT(*) FROM public.sucursal),
        'sucursales_activas', (SELECT COUNT(*) FROM public.sucursal WHERE activa = true),
        'marketplace_listings', (SELECT COUNT(*) FROM public.marketplace_listing),
        'listings_activos', (SELECT COUNT(*) FROM public.marketplace_listing WHERE activo = true),
        'servicios_marketplace', (SELECT COUNT(*) FROM public.marketplace_servicio),
        'promociones_activas', (SELECT COUNT(*) FROM public.marketplace_promocion WHERE activo = true AND fecha_fin >= CURRENT_DATE),
        'reviews_aprobadas', (SELECT COUNT(*) FROM public.marketplace_review WHERE aprobado = true),
        'reservas_pendientes', (SELECT COUNT(*) FROM public.marketplace_reserva WHERE estado = 'PENDIENTE')
    ) as data;

-- ============================================
-- FIN DEL AUDIT
-- ============================================
