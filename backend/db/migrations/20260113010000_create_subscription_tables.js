/**
 * Migration: create_subscription_tables
 * Source: backend/migrations/create_subscription_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates subscription management tables for Stripe integration:
 * - plan_suscripcion: catalog of available plans
 * - tenant_suscripcion: per-tenant subscription state
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating subscription tables...');

    await knex.raw(`
        -- Tabla plan_suscripcion (catálogo de planes)
        CREATE TABLE IF NOT EXISTS plan_suscripcion (
            id SERIAL PRIMARY KEY,
            nombre TEXT UNIQUE NOT NULL,
            descripcion TEXT,
            trial_dias_default INTEGER DEFAULT 15,
            precio_mensual_stripe_price_id TEXT,
            precio_anual_stripe_price_id TEXT,
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
            status TEXT NOT NULL,
            trial_start_at TIMESTAMPTZ,
            trial_end_at TIMESTAMPTZ,
            current_period_start TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            cancel_at TIMESTAMPTZ,
            cancel_at_period_end BOOLEAN DEFAULT false,
            ultima_sync_stripe_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id)
        );

        -- Índices
        CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_tenant ON tenant_suscripcion(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_stripe_sub ON tenant_suscripcion(stripe_subscription_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_status ON tenant_suscripcion(status);

        -- Trigger para actualizar updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_plan_suscripcion_updated_at ON plan_suscripcion;
        CREATE TRIGGER update_plan_suscripcion_updated_at
            BEFORE UPDATE ON plan_suscripcion
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_tenant_suscripcion_updated_at ON tenant_suscripcion;
        CREATE TRIGGER update_tenant_suscripcion_updated_at
            BEFORE UPDATE ON tenant_suscripcion
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        COMMENT ON TABLE plan_suscripcion IS 'Catálogo de planes de suscripción disponibles';
        COMMENT ON TABLE tenant_suscripcion IS 'Estado de suscripción de cada tenant con Stripe';
    `);

    console.log('[Migration] ✅ Subscription tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping subscription tables...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS update_tenant_suscripcion_updated_at ON tenant_suscripcion;
        DROP TRIGGER IF EXISTS update_plan_suscripcion_updated_at ON plan_suscripcion;
        DROP TABLE IF EXISTS tenant_suscripcion CASCADE;
        DROP TABLE IF EXISTS plan_suscripcion CASCADE;
    `);

    console.log('[Migration] ✅ Subscription tables dropped');
};

exports.config = { transaction: true };
