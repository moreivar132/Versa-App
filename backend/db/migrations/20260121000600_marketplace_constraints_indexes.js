/**
 * Migration: Marketplace Constraints & Indexes
 * @description Data integrity constraints and performance indexes for marketplace
 */

exports.up = async function (knex) {
    // 1. Coordinate constraints for sucursal
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sucursal_lat_range') THEN
                ALTER TABLE public.sucursal ADD CONSTRAINT chk_sucursal_lat_range CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sucursal_lng_range') THEN
                ALTER TABLE public.sucursal ADD CONSTRAINT chk_sucursal_lng_range CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));
            END IF;
        END $$;
    `);

    // 2. Coordinate constraints for marketplace_listing
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_mktplace_listing_lat_range') THEN
                ALTER TABLE public.marketplace_listing ADD CONSTRAINT chk_mktplace_listing_lat_range CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_mktplace_listing_lng_range') THEN
                ALTER TABLE public.marketplace_listing ADD CONSTRAINT chk_mktplace_listing_lng_range CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));
            END IF;
        END $$;
    `);

    // 3. Performance indexes
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_sucursal_activa ON public.sucursal (activa) WHERE activa = true;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_listing_sucursal_activo ON public.marketplace_listing (id_sucursal, activo) WHERE activo = true;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_listing_tenant ON public.marketplace_listing (id_tenant);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_servicio_sucursal_activo ON public.marketplace_servicio_sucursal (id_sucursal, activo) WHERE activo = true;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_promo_activo_fecha ON public.marketplace_promocion (id_sucursal, activo, fecha_fin) WHERE activo = true;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_review_sucursal_aprobado ON public.marketplace_review (id_sucursal, aprobado, created_at DESC) WHERE aprobado = true;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_sucursal_coords ON public.sucursal (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_mktplace_listing_coords ON public.marketplace_listing (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;`);

    // 4. Add comments
    await knex.raw(`COMMENT ON CONSTRAINT chk_sucursal_lat_range ON public.sucursal IS 'Garantiza que la latitud está en el rango válido -90 a 90';`);
    await knex.raw(`COMMENT ON CONSTRAINT chk_sucursal_lng_range ON public.sucursal IS 'Garantiza que la longitud está en el rango válido -180 a 180';`);
};

exports.down = async function (knex) {
    // Drop indexes
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_listing_coords;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_sucursal_coords;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_review_sucursal_aprobado;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_promo_activo_fecha;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_servicio_sucursal_activo;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_listing_tenant;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_mktplace_listing_sucursal_activo;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_sucursal_activa;`);

    // Drop constraints
    await knex.raw(`ALTER TABLE public.marketplace_listing DROP CONSTRAINT IF EXISTS chk_mktplace_listing_lng_range;`);
    await knex.raw(`ALTER TABLE public.marketplace_listing DROP CONSTRAINT IF EXISTS chk_mktplace_listing_lat_range;`);
    await knex.raw(`ALTER TABLE public.sucursal DROP CONSTRAINT IF EXISTS chk_sucursal_lng_range;`);
    await knex.raw(`ALTER TABLE public.sucursal DROP CONSTRAINT IF EXISTS chk_sucursal_lat_range;`);
};

exports.config = { transaction: true };
