/**
 * Migration: create_user_dashboard_prefs
 * Source: backend/archive/legacy-migrations/create_user_dashboard_prefs.sql
 * Module: Core/Shared
 * Risk Level: Bajo
 * 
 * Creates user dashboard preferences table for personalized dashboard configuration.
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating user_dashboard_prefs table...');

    await knex.raw(`
        -- =====================================================
        -- TABLA: user_dashboard_prefs
        -- Preferencias del dashboard por usuario/tenant/sucursal
        -- =====================================================
        CREATE TABLE IF NOT EXISTS user_dashboard_prefs (
            id             BIGSERIAL PRIMARY KEY,
            id_tenant      BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_user        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
            id_sucursal    BIGINT NULL REFERENCES sucursal(id) ON DELETE SET NULL,
            page_key       TEXT NOT NULL DEFAULT 'home_dashboard',
            
            -- Preferencias en formato JSON
            prefs_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
            
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            
            -- Constraint de unicidad
            UNIQUE (id_tenant, id_user, id_sucursal, page_key)
        );

        -- Índices
        CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_lookup
        ON user_dashboard_prefs(id_tenant, id_user, page_key);

        CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_sucursal
        ON user_dashboard_prefs(id_tenant, id_user, id_sucursal)
        WHERE id_sucursal IS NOT NULL;

        -- Trigger para updated_at
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

        -- Comentarios
        COMMENT ON TABLE user_dashboard_prefs IS 'Preferencias personalizadas del dashboard por usuario';
        COMMENT ON COLUMN user_dashboard_prefs.page_key IS 'Identificador de la página (ej: home_dashboard, finsaas_dashboard)';
        COMMENT ON COLUMN user_dashboard_prefs.prefs_json IS 'JSON con visible_kpis, order, density, collapsed_sections, legend_mode';
        COMMENT ON COLUMN user_dashboard_prefs.id_sucursal IS 'Sucursal específica (NULL para preferencias globales)';
    `);

    console.log('[Migration] ✅ user_dashboard_prefs table created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping user_dashboard_prefs table...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS trg_dashboard_prefs_updated_at ON user_dashboard_prefs;
        DROP FUNCTION IF EXISTS update_dashboard_prefs_updated_at();
        DROP TABLE IF EXISTS user_dashboard_prefs CASCADE;
    `);

    console.log('[Migration] ✅ user_dashboard_prefs table dropped');
};

exports.config = { transaction: true };
