/**
 * Migration: Add Empresa to Archivos
 * @description Adds id_empresa to contabilidad_factura_archivo for multi-empresa support
 */

exports.up = async function (knex) {
    // 1. Add column
    await knex.raw(`
        ALTER TABLE contabilidad_factura_archivo 
        ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);
    `);

    // 2. Backfill from existing invoices
    await knex.raw(`
        UPDATE contabilidad_factura_archivo a
        SET id_empresa = f.id_empresa
        FROM contabilidad_factura f
        WHERE a.id_factura = f.id AND a.id_empresa IS NULL;
    `);

    // 3. Create index
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_contab_factura_archivo_empresa 
        ON contabilidad_factura_archivo(id_empresa);
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_contab_factura_archivo_empresa;`);
    await knex.raw(`ALTER TABLE contabilidad_factura_archivo DROP COLUMN IF EXISTS id_empresa;`);
};

exports.config = { transaction: true };
