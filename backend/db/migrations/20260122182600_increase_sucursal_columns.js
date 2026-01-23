/**
 * Migration: increase_sucursal_columns
 * Source: backend/archive/legacy-migrations/increase_sucursal_columns.sql
 * Module: Manager
 * Risk Level: Bajo
 * 
 * Increases column sizes in sucursal table to prevent overflow errors.
 */

exports.up = async function (knex) {
    console.log('[Migration] Increasing sucursal column sizes...');

    await knex.raw(`
        -- Increase column sizes for sucursal table to prevent overflow errors
        ALTER TABLE sucursal
        ALTER COLUMN telefono TYPE VARCHAR(255);
        
        -- Change direccion_iframe to TEXT if it exists
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sucursal' AND column_name = 'direccion_iframe'
            ) THEN
                ALTER TABLE sucursal ALTER COLUMN direccion_iframe TYPE TEXT;
            END IF;
        END $$;
    `);

    console.log('[Migration] ✅ Sucursal column sizes increased');
};

exports.down = async function (knex) {
    console.log('[Migration] ⚠️ Column size reduction is risky - skipping');
    // Reducing column sizes could cause data loss, so we don't reverse this
    return Promise.resolve();
};

exports.config = { transaction: true };
