/**
 * Migration: create_subscription_tables
 * Source: backend/migrations/create_subscription_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates subscription management tables for Stripe integration:
 * - plan_suscripcion: catalog of available plans
 * - tenant_suscripcion: per-tenant subscription state
 */

exports.up = async function (knex) {
    console.log('[Migration] Ensuring subscription tables and columns exist (idempotent)...');

    // =========================================================================
    // PLAN_SUSCRIPCION: Create only if not exists (schema_dump may have created it)
    // =========================================================================
    const planTableExists = await knex.schema.hasTable('plan_suscripcion');
    if (!planTableExists) {
        await knex.raw(`
            CREATE TABLE plan_suscripcion (
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
        `);
        console.log('[Migration] ✅ Created plan_suscripcion table');
    } else {
        console.log('[Migration] ℹ️ plan_suscripcion already exists, skipping creation');
        // Add missing columns that may not exist in schema_dump version
        await knex.raw(`
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS nombre TEXT;
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS descripcion TEXT;
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS trial_dias_default INTEGER DEFAULT 15;
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS precio_mensual_stripe_price_id TEXT;
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS precio_anual_stripe_price_id TEXT;
            ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
        `);
    }

    // =========================================================================
    // TENANT_SUSCRIPCION: Handle both fresh DB and schema_dump scenarios
    // =========================================================================
    const tenantSuscripcionExists = await knex.schema.hasTable('tenant_suscripcion');
    if (!tenantSuscripcionExists) {
        // Fresh database without schema_dump - create full table
        await knex.raw(`
            CREATE TABLE tenant_suscripcion (
                id SERIAL PRIMARY KEY,
                id_tenant TEXT NOT NULL,
                plan_id INTEGER NOT NULL,
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                trial_start_at TIMESTAMPTZ,
                trial_end_at TIMESTAMPTZ,
                current_period_start TIMESTAMPTZ,
                current_period_end TIMESTAMPTZ,
                cancel_at TIMESTAMPTZ,
                cancel_at_period_end BOOLEAN DEFAULT false,
                ultima_sync_stripe_at TIMESTAMPTZ,
                start_date TIMESTAMPTZ,
                end_date TIMESTAMPTZ,
                renewal_date TIMESTAMPTZ,
                payment_method_id TEXT,
                subscription_metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('[Migration] ✅ Created tenant_suscripcion table from scratch');
    } else {
        // Table exists (from schema_dump) - add missing columns
        console.log('[Migration] ℹ️ tenant_suscripcion exists, adding missing columns...');
        await knex.raw(`
            -- Stripe-specific columns (missing in schema_dump)
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMPTZ;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMPTZ;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
            ALTER TABLE tenant_suscripcion ADD COLUMN IF NOT EXISTS ultima_sync_stripe_at TIMESTAMPTZ;
        `);
        console.log('[Migration] ✅ Added missing Stripe columns to tenant_suscripcion');
    }

    // =========================================================================
    // INDEXES: Create only after ensuring columns exist
    // =========================================================================
    await knex.raw(`
        -- Safe index creation (columns guaranteed to exist now)
        CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_tenant ON tenant_suscripcion(id_tenant);
        CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_status ON tenant_suscripcion(status);
    `);

    // Only create stripe_subscription_id index if column exists
    const stripeSubColExists = await knex.raw(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenant_suscripcion' 
            AND column_name = 'stripe_subscription_id'
        ) as exists;
    `);

    if (stripeSubColExists.rows[0].exists) {
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_tenant_suscripcion_stripe_sub 
            ON tenant_suscripcion(stripe_subscription_id);
        `);
        console.log('[Migration] ✅ Created idx_tenant_suscripcion_stripe_sub index');
    }

    // =========================================================================
    // TRIGGERS: Idempotent trigger creation
    // =========================================================================
    await knex.raw(`
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
    `);

    // =========================================================================
    // COMMENTS: Safe to re-apply
    // =========================================================================
    await knex.raw(`
        COMMENT ON TABLE plan_suscripcion IS 'Catálogo de planes de suscripción disponibles';
        COMMENT ON TABLE tenant_suscripcion IS 'Estado de suscripción de cada tenant con Stripe';
    `);

    console.log('[Migration] ✅ Subscription tables migration complete (idempotent)');
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
