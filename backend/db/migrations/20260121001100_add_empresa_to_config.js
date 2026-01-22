/**
 * Migration: Add Empresa to Config
 * @description Adds id_empresa to facturaconfigtenant for multi-empresa support
 */

exports.up = async function (knex) {
    // 1. Add id_empresa column
    await knex.raw(`
        ALTER TABLE facturaconfigtenant 
        ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES accounting_empresa(id);
    `);

    // 2. Add unique constraint for tenant+empresa combination
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_facturaconfig_tenant_empresa 
        ON facturaconfigtenant (id_tenant, id_empresa) 
        WHERE id_empresa IS NOT NULL;
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_facturaconfig_tenant_empresa;`);
    await knex.raw(`ALTER TABLE facturaconfigtenant DROP COLUMN IF EXISTS id_empresa;`);
};

exports.config = { transaction: true };
