-- =====================================================
-- MIGRACIÓN: Preferencias de Dashboard por Usuario
-- Descripción: Crea tabla para persistir configuración
--              personalizada del dashboard por usuario
-- Fecha: 2026-01-08
-- =====================================================

-- =====================================================
-- 1. TABLA: user_dashboard_prefs
-- Preferencias del dashboard por usuario/tenant/sucursal
-- =====================================================
CREATE TABLE IF NOT EXISTS user_dashboard_prefs (
  id             BIGSERIAL PRIMARY KEY,
  id_tenant      BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  id_user        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  id_sucursal    BIGINT NULL REFERENCES sucursal(id) ON DELETE SET NULL,
  page_key       TEXT NOT NULL DEFAULT 'home_dashboard',
  
  -- Preferencias en formato JSON
  -- Esquema esperado:
  -- {
  --   "visible_kpis": ["ingresos_global", "egresos_global", ...],
  --   "order": ["ingresos_global", "egresos_global", ...],
  --   "density": "compacto" | "normal",
  --   "collapsed_sections": ["operacion"],
  --   "legend_mode": "chips" | "popover"
  -- }
  prefs_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint de unicidad: una preferencia por usuario/tenant/sucursal/página
  UNIQUE (id_tenant, id_user, id_sucursal, page_key)
);

-- =====================================================
-- 2. ÍNDICES para consultas frecuentes
-- =====================================================

-- Índice principal para búsqueda de preferencias
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_lookup
ON user_dashboard_prefs(id_tenant, id_user, page_key);

-- Índice para preferencias por sucursal específica
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_sucursal
ON user_dashboard_prefs(id_tenant, id_user, id_sucursal)
WHERE id_sucursal IS NOT NULL;

-- =====================================================
-- 3. TRIGGER para updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_dashboard_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dashboard_prefs_updated_at ON user_dashboard_prefs;
CREATE TRIGGER trg_dashboard_prefs_updated_at
BEFORE UPDATE ON user_dashboard_prefs
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_prefs_updated_at();

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================
COMMENT ON TABLE user_dashboard_prefs IS 'Preferencias personalizadas del dashboard por usuario';
COMMENT ON COLUMN user_dashboard_prefs.page_key IS 'Identificador de la página (ej: home_dashboard, finsaas_dashboard)';
COMMENT ON COLUMN user_dashboard_prefs.prefs_json IS 'JSON con visible_kpis, order, density, collapsed_sections, legend_mode';
COMMENT ON COLUMN user_dashboard_prefs.id_sucursal IS 'Sucursal específica (NULL para preferencias globales del usuario)';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
