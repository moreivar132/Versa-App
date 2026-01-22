/**
 * Migration: Unique NIF/CIF Constraint
 * @description Ensures no duplicate NIF/CIF within the same tenant
 */

exports.up = async function (knex) {
    // 1. Handle existing duplicates - keep most recent, deactivate others
    await knex.raw(`
        WITH duplicates AS (
            SELECT id, nif_cif, id_tenant,
                   ROW_NUMBER() OVER (
                       PARTITION BY id_tenant, UPPER(TRIM(nif_cif)) 
                       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                   ) as rn
            FROM contabilidad_contacto
            WHERE nif_cif IS NOT NULL 
              AND nif_cif != '' 
              AND deleted_at IS NULL
        )
        UPDATE contabilidad_contacto c
        SET activo = false,
            notas = COALESCE(notas, '') || ' [DESACTIVADO: NIF/CIF duplicado]',
            updated_at = now()
        FROM duplicates d
        WHERE c.id = d.id AND d.rn > 1;
    `);

    // 2. Create unique index on tenant + normalized NIF/CIF
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS ux_contacto_tenant_nif 
            ON contabilidad_contacto (id_tenant, UPPER(TRIM(nif_cif)))
            WHERE nif_cif IS NOT NULL 
              AND nif_cif != '' 
              AND deleted_at IS NULL 
              AND activo = true;
    `);

    await knex.raw(`COMMENT ON INDEX ux_contacto_tenant_nif IS 'Ensures unique NIF/CIF per tenant for active contacts';`);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS ux_contacto_tenant_nif;`);
    // Note: Deactivated duplicates are not reactivated as this could cause data integrity issues
};

exports.config = { transaction: true };
