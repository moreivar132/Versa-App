/**
 * Migration: add_config_to_estadoorden
 * Source: backend/archive/legacy-migrations/add_config_to_estadoorden.sql
 * Module: Manager
 * Risk Level: Bajo
 * 
 * Adds configuration columns to estadoorden table:
 * - color: hex color for display
 * - id_tenant: for custom states per tenant
 * - orden: display order
 */

exports.up = async function (knex) {
    console.log('[Migration] Adding config columns to estadoorden...');

    await knex.raw(`
        -- Agregar columna color
        ALTER TABLE estadoorden 
        ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';

        -- Agregar columna id_tenant
        ALTER TABLE estadoorden 
        ADD COLUMN IF NOT EXISTS id_tenant BIGINT REFERENCES tenant(id) ON DELETE CASCADE;

        -- Agregar columna orden
        ALTER TABLE estadoorden 
        ADD COLUMN IF NOT EXISTS orden INT DEFAULT 1;

        -- Actualizar colores por defecto para estados existentes
        UPDATE estadoorden SET color = '#eab308', orden = 1 WHERE codigo = 'ABIERTA' AND color = '#6b7280';
        UPDATE estadoorden SET color = '#3b82f6', orden = 2 WHERE codigo = 'EN_PROGRESO' AND color = '#6b7280';
        UPDATE estadoorden SET color = '#f97316', orden = 3 WHERE codigo = 'RECAMBIO' AND color = '#6b7280';
        UPDATE estadoorden SET color = '#22c55e', orden = 4 WHERE codigo = 'COMPLETADA' AND color = '#6b7280';
        UPDATE estadoorden SET color = '#a855f7', orden = 5 WHERE codigo = 'ENTREGADA' AND color = '#6b7280';
        UPDATE estadoorden SET color = '#ef4444', orden = 6 WHERE codigo = 'CANCELADA' AND (color = '#6b7280' OR color IS NULL);
        UPDATE estadoorden SET color = '#9ca3af', orden = 0 WHERE codigo = 'PRESUPUESTO' AND (color = '#6b7280' OR color IS NULL);

        -- Índice para búsqueda por tenant
        CREATE INDEX IF NOT EXISTS idx_estadoorden_tenant ON estadoorden(id_tenant);

        COMMENT ON COLUMN estadoorden.color IS 'Color hex del estado para visualización';
        COMMENT ON COLUMN estadoorden.id_tenant IS 'Tenant al que pertenece este estado (NULL = global del sistema)';
        COMMENT ON COLUMN estadoorden.orden IS 'Orden de visualización del estado';
    `);

    console.log('[Migration] ✅ Config columns added to estadoorden');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Removing config columns from estadoorden...');

    await knex.raw(`
        DROP INDEX IF EXISTS idx_estadoorden_tenant;
        ALTER TABLE estadoorden DROP COLUMN IF EXISTS orden;
        ALTER TABLE estadoorden DROP COLUMN IF EXISTS id_tenant;
        ALTER TABLE estadoorden DROP COLUMN IF EXISTS color;
    `);

    console.log('[Migration] ✅ Config columns removed from estadoorden');
};

exports.config = { transaction: true };
