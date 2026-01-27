/**
 * Migration: add_sucursal_contact_info
 * Source: backend/archive/legacy-migrations/add_sucursal_contact_info.sql
 * Module: Manager
 * Risk Level: Bajo
 * 
 * Adds contact info columns to sucursal table.
 */

exports.up = async function (knex) {
    console.log('[Migration] Adding contact info columns to sucursal...');

    await knex.raw(`
        -- Add phone and email columns to sucursal table
        ALTER TABLE sucursal
        ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
        ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);

    console.log('[Migration] ✅ Contact info columns added to sucursal');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Removing contact info columns from sucursal...');

    await knex.raw(`
        ALTER TABLE sucursal DROP COLUMN IF EXISTS email;
        ALTER TABLE sucursal DROP COLUMN IF EXISTS telefono;
    `);

    console.log('[Migration] ✅ Contact info columns removed from sucursal');
};

exports.config = { transaction: true };
