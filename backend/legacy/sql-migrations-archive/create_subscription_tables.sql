-- migrations/create_subscription_tables.sql
-- Script SQL para crear las tablas de suscripción
-- IMPORTANTE: Estas tablas YA EXISTEN según tu descripción, este es solo un archivo de referencia

-- Tabla plan_suscripcion (catálogo de planes)
CREATE TABLE IF NOT EXISTS plan_suscripcion (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,                    -- BASIC, PRO, FLEET, etc.
  descripcion TEXT,
  trial_dias_default INTEGER DEFAULT 15,          -- ej. 15 días
  precio_mensual_stripe_price_id TEXT,            -- price_id de Stripe (mensual)
  precio_anual_stripe_price_id TEXT,              -- price_id de Stripe (anual)
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla tenant_suscripcion (estado de suscripción por tenant)
CREATE TABLE IF NOT EXISTS tenant_suscripcion (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plan_suscripcion(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,                           -- 'trialing', 'active', 'past_due', 'canceled', etc.
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  ultima_sync_stripe_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint para evitar duplicados por tenant
  CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_tenant ON tenant_suscripcion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_stripe_sub ON tenant_suscripcion(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_status ON tenant_suscripcion(status);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a plan_suscripcion
DROP TRIGGER IF EXISTS update_plan_suscripcion_updated_at ON plan_suscripcion;
CREATE TRIGGER update_plan_suscripcion_updated_at
    BEFORE UPDATE ON plan_suscripcion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a tenant_suscripcion
DROP TRIGGER IF EXISTS update_tenant_suscripcion_updated_at ON tenant_suscripcion;
CREATE TRIGGER update_tenant_suscripcion_updated_at
    BEFORE UPDATE ON tenant_suscripcion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios de documentación
COMMENT ON TABLE plan_suscripcion IS 'Catálogo de planes de suscripción disponibles';
COMMENT ON TABLE tenant_suscripcion IS 'Estado de suscripción de cada tenant con Stripe';

COMMENT ON COLUMN plan_suscripcion.nombre IS 'Nombre único del plan (BASIC, PRO, FLEET)';
COMMENT ON COLUMN plan_suscripcion.trial_dias_default IS 'Días de prueba gratuita por defecto';
COMMENT ON COLUMN plan_suscripcion.precio_mensual_stripe_price_id IS 'Price ID de Stripe para facturación mensual';
COMMENT ON COLUMN plan_suscripcion.precio_anual_stripe_price_id IS 'Price ID de Stripe para facturación anual';

COMMENT ON COLUMN tenant_suscripcion.status IS 'Estado de la suscripción en Stripe (trialing, active, past_due, canceled, etc.)';
COMMENT ON COLUMN tenant_suscripcion.stripe_customer_id IS 'ID del cliente en Stripe';
COMMENT ON COLUMN tenant_suscripcion.stripe_subscription_id IS 'ID de la suscripción en Stripe';
COMMENT ON COLUMN tenant_suscripcion.trial_start_at IS 'Fecha de inicio del período de prueba';
COMMENT ON COLUMN tenant_suscripcion.trial_end_at IS 'Fecha de fin del período de prueba';
COMMENT ON COLUMN tenant_suscripcion.current_period_start IS 'Fecha de inicio del período de facturación actual';
COMMENT ON COLUMN tenant_suscripcion.current_period_end IS 'Fecha de fin del período de facturación actual';
COMMENT ON COLUMN tenant_suscripcion.cancel_at IS 'Fecha de cancelación programada';
COMMENT ON COLUMN tenant_suscripcion.cancel_at_period_end IS 'Si la suscripción se cancelará al final del período actual';
COMMENT ON COLUMN tenant_suscripcion.ultima_sync_stripe_at IS 'Última vez que se sincronizó con Stripe vía webhook';
