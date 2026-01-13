-- Migración: Crear tabla de configuración de órdenes de trabajo
-- =====================================================

-- Tabla: ordenconfigtenant
-- Configuración de diseño de documentos de órdenes de trabajo por tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS ordenconfigtenant (
  id              BIGSERIAL PRIMARY KEY,
  id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre_plantilla TEXT NOT NULL DEFAULT 'Por defecto',
  nombre_taller   TEXT NOT NULL DEFAULT 'GOVERSA',
  logo_url        TEXT NULL,
  color_primario  TEXT NOT NULL DEFAULT '#ff652b',
  cabecera_html   TEXT NULL,
  pie_html        TEXT NULL,
  condiciones_html TEXT NULL,
  mostrar_logo    BOOLEAN NOT NULL DEFAULT true,
  mostrar_matricula BOOLEAN NOT NULL DEFAULT true,
  mostrar_kilometraje BOOLEAN NOT NULL DEFAULT true,
  mostrar_tecnico BOOLEAN NOT NULL DEFAULT true,
  mostrar_precios BOOLEAN NOT NULL DEFAULT true,
  mostrar_iva     BOOLEAN NOT NULL DEFAULT true,
  mostrar_firma_cliente BOOLEAN NOT NULL DEFAULT true,
  config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  es_por_defecto  BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por      BIGINT NULL REFERENCES usuario(id)
);

-- Índice único para la configuración por defecto por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordenconfigtenant_default
ON ordenconfigtenant(id_tenant)
WHERE es_por_defecto = true;

COMMENT ON TABLE ordenconfigtenant IS 'Configuración de diseño de documentos de órdenes de trabajo por tenant';

-- Insertar configuración por defecto para cada tenant existente
INSERT INTO ordenconfigtenant (id_tenant, nombre_taller, color_primario, es_por_defecto)
SELECT id, 'GOVERSA', '#ff652b', true
FROM tenant
WHERE id NOT IN (SELECT id_tenant FROM ordenconfigtenant WHERE es_por_defecto = true)
ON CONFLICT DO NOTHING;
