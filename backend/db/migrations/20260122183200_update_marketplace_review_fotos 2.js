/**
 * Migration: update_marketplace_review_fotos
 * Source: backend/archive/legacy-migrations/update_marketplace_review_fotos.sql
 * Module: Marketplace
 * Risk Level: Bajo
 * 
 * Adds photo support and updated_at tracking to marketplace reviews.
 */

exports.up = async function (knex) {
    console.log('[Migration] Updating marketplace_review for photos...');

    await knex.raw(`
        -- Añadir columna de fotos (array de URLs)
        ALTER TABLE marketplace_review 
        ADD COLUMN IF NOT EXISTS fotos_json JSONB DEFAULT '[]'::jsonb;

        -- Añadir columna de updated_at
        ALTER TABLE marketplace_review 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

        -- Trigger para updated_at (uses existing function if available)
        DO $$
        BEGIN
            -- Check if update_updated_at_column function exists
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_review_updated_at') THEN
                    CREATE TRIGGER update_marketplace_review_updated_at
                    BEFORE UPDATE ON marketplace_review
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END IF;
        END$$;

        COMMENT ON COLUMN marketplace_review.fotos_json IS 'Array de URLs de fotos subidas por el cliente con la reseña';
    `);

    console.log('[Migration] ✅ marketplace_review updated for photos');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Reverting marketplace_review changes...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS update_marketplace_review_updated_at ON marketplace_review;
        ALTER TABLE marketplace_review DROP COLUMN IF EXISTS updated_at;
        ALTER TABLE marketplace_review DROP COLUMN IF EXISTS fotos_json;
    `);

    console.log('[Migration] ✅ marketplace_review reverted');
};

exports.config = { transaction: true };
