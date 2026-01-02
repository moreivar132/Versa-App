-- =====================================================
-- MIGRACIÓN: Sistema de Ledger de Ingresos
-- Descripción: Crea tabla income_event como fuente de
--              verdad para todos los ingresos del sistema
-- Fecha: 2025-12-29
-- =====================================================

-- =====================================================
-- 1. TABLA: income_event
-- Ledger central de todos los ingresos (Marketplace + CRM)
-- =====================================================
CREATE TABLE IF NOT EXISTS income_event (
  id             BIGSERIAL PRIMARY KEY,
  id_tenant      BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  id_sucursal    BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
  
  -- Clasificación del ingreso
  origen         TEXT NOT NULL CHECK (origen IN ('marketplace','crm','subscription','manual')),
  origin_type    TEXT NOT NULL, -- 'cita','orden','venta','factura','manual'
  origin_id      BIGINT NULL,   -- ID de la entidad origen (cita, orden, venta, etc)
  
  -- Cliente (opcional, para reportes)
  id_cliente     BIGINT NULL REFERENCES clientefinal(id) ON DELETE SET NULL,
  
  -- Monto
  amount         NUMERIC(14,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'EUR',
  
  -- Estado del ingreso
  status         TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded','canceled')),
  
  -- Idempotencia: provider + reference debe ser único por tenant
  provider       TEXT NOT NULL DEFAULT 'internal', -- 'stripe','cash','transfer','card','internal'
  reference      TEXT NOT NULL, -- Clave única: ej "stripe:cs_live_xxx" o "orden:123:pago:456"
  
  -- Metadata adicional (JSON)
  metadata       JSONB NULL,
  description    TEXT NULL,
  
  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para garantizar idempotencia
CREATE UNIQUE INDEX IF NOT EXISTS ux_income_event_reference 
ON income_event(id_tenant, reference);

-- Índices para reportes por fecha
CREATE INDEX IF NOT EXISTS idx_income_event_tenant_fecha 
ON income_event(id_tenant, created_at DESC);

-- Índice para filtrar por origen y status
CREATE INDEX IF NOT EXISTS idx_income_event_origen_status 
ON income_event(origen, status);

-- Índice por sucursal
CREATE INDEX IF NOT EXISTS idx_income_event_sucursal 
ON income_event(id_sucursal, created_at DESC);

-- Índice para status paid (el más común en reportes)
CREATE INDEX IF NOT EXISTS idx_income_event_paid 
ON income_event(id_tenant, created_at DESC) 
WHERE status = 'paid';

-- Índice para reportes por origen específico
CREATE INDEX IF NOT EXISTS idx_income_event_marketplace 
ON income_event(id_tenant, id_sucursal, created_at DESC) 
WHERE origen = 'marketplace' AND status = 'paid';

CREATE INDEX IF NOT EXISTS idx_income_event_crm 
ON income_event(id_tenant, id_sucursal, created_at DESC) 
WHERE origen = 'crm' AND status = 'paid';

-- Comentarios
COMMENT ON TABLE income_event IS 'Ledger central de ingresos - fuente de verdad para reportes financieros';
COMMENT ON COLUMN income_event.origen IS 'Origen del ingreso: marketplace, crm, subscription, manual';
COMMENT ON COLUMN income_event.origin_type IS 'Tipo de entidad origen: cita, orden, venta, factura, manual';
COMMENT ON COLUMN income_event.reference IS 'Clave única para idempotencia (ej: stripe:cs_xxx, orden:123:pago:456)';
COMMENT ON COLUMN income_event.provider IS 'Proveedor del pago: stripe, cash, transfer, card, internal';

-- =====================================================
-- 2. TRIGGER para updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_income_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_income_event_updated_at ON income_event;
CREATE TRIGGER trg_income_event_updated_at
BEFORE UPDATE ON income_event
FOR EACH ROW
EXECUTE FUNCTION update_income_event_updated_at();

-- =====================================================
-- 3. MODIFICAR plan_suscripcion para Feature Gating
-- =====================================================
DO $$
BEGIN
    -- Añadir columna incluye_marketplace si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_suscripcion' AND column_name = 'incluye_marketplace'
    ) THEN
        ALTER TABLE plan_suscripcion 
        ADD COLUMN incluye_marketplace BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Añadir columna incluye_crm si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_suscripcion' AND column_name = 'incluye_crm'
    ) THEN
        ALTER TABLE plan_suscripcion 
        ADD COLUMN incluye_crm BOOLEAN NOT NULL DEFAULT true;
    END IF;

    -- Añadir columna features_json si no existe (para futuras expansiones)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_suscripcion' AND column_name = 'features_json'
    ) THEN
        ALTER TABLE plan_suscripcion 
        ADD COLUMN features_json JSONB NULL DEFAULT '{}'::jsonb;
    END IF;
END$$;

-- =====================================================
-- 4. ACTUALIZAR planes existentes con features
-- =====================================================
-- BASIC: Solo CRM, sin Marketplace
UPDATE plan_suscripcion 
SET incluye_marketplace = false, 
    incluye_crm = true,
    features_json = '{"max_usuarios": 2, "max_sucursales": 1}'::jsonb
WHERE nombre = 'BASIC';

-- PRO: CRM + Marketplace
UPDATE plan_suscripcion 
SET incluye_marketplace = true, 
    incluye_crm = true,
    features_json = '{"max_usuarios": 6, "max_sucursales": 3}'::jsonb
WHERE nombre = 'PRO';

-- FLEET: Todo incluido
UPDATE plan_suscripcion 
SET incluye_marketplace = true, 
    incluye_crm = true,
    features_json = '{"max_usuarios": -1, "max_sucursales": -1, "api_access": true}'::jsonb
WHERE nombre = 'FLEET';

-- =====================================================
-- 5. VISTA para reportes rápidos de ingresos
-- =====================================================
CREATE OR REPLACE VIEW v_income_summary AS
SELECT 
    ie.id_tenant,
    ie.id_sucursal,
    s.nombre AS sucursal_nombre,
    ie.origen,
    ie.status,
    DATE_TRUNC('day', ie.created_at) AS fecha,
    COUNT(*) AS num_eventos,
    SUM(ie.amount) AS total_amount,
    ie.currency
FROM income_event ie
JOIN sucursal s ON ie.id_sucursal = s.id
GROUP BY ie.id_tenant, ie.id_sucursal, s.nombre, ie.origen, ie.status, DATE_TRUNC('day', ie.created_at), ie.currency;

COMMENT ON VIEW v_income_summary IS 'Vista resumida de ingresos por día, origen y sucursal';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
