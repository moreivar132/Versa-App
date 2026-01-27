/**
 * Migration: add_stripe_customer_to_client
 * Source: backend/archive/legacy-migrations/add_stripe_customer_to_client.sql
 * Module: Core/Shared
 * Risk Level: Bajo
 * 
 * Adds Stripe customer columns to clientefinal_auth for payment method management.
 */

exports.up = async function (knex) {
    console.log('[Migration] Adding Stripe customer columns to clientefinal_auth...');

    await knex.raw(`
        -- Añadir stripe_customer_id a clientefinal_auth
        ALTER TABLE clientefinal_auth 
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

        -- Índice único para stripe_customer_id
        CREATE UNIQUE INDEX IF NOT EXISTS idx_clientefinal_auth_stripe_customer_id 
        ON clientefinal_auth(stripe_customer_id) 
        WHERE stripe_customer_id IS NOT NULL;

        -- Guardar el ID del método de pago predeterminado
        ALTER TABLE clientefinal_auth 
        ADD COLUMN IF NOT EXISTS stripe_default_payment_method_id TEXT;

        -- Comentarios
        COMMENT ON COLUMN clientefinal_auth.stripe_customer_id IS 'ID del Customer en Stripe para gestión de payment methods';
        COMMENT ON COLUMN clientefinal_auth.stripe_default_payment_method_id IS 'ID del PaymentMethod predeterminado en Stripe';
    `);

    console.log('[Migration] ✅ Stripe customer columns added to clientefinal_auth');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Removing Stripe customer columns from clientefinal_auth...');

    await knex.raw(`
        DROP INDEX IF EXISTS idx_clientefinal_auth_stripe_customer_id;
        ALTER TABLE clientefinal_auth DROP COLUMN IF EXISTS stripe_default_payment_method_id;
        ALTER TABLE clientefinal_auth DROP COLUMN IF EXISTS stripe_customer_id;
    `);

    console.log('[Migration] ✅ Stripe customer columns removed');
};

exports.config = { transaction: true };
