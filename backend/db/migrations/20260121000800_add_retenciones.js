/**
 * Migration: Add Retenciones (IRPF)
 * @description Adds IRPF withholding fields to invoices for Spanish tax compliance
 */

exports.up = async function (knex) {
    // 1. Add retention columns
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS retencion_porcentaje NUMERIC(5,2) DEFAULT 0;`);
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS retencion_importe NUMERIC(14,2) DEFAULT 0;`);

    // 2. Add comments
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.retencion_porcentaje IS 'Porcentaje de retención IRPF (ej: 15%, 7%, 1%)';`);
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.retencion_importe IS 'Importe de retención IRPF = base_imponible * retencion_porcentaje / 100';`);

    // 3. Update constraint for totals
    await knex.raw(`ALTER TABLE contabilidad_factura DROP CONSTRAINT IF EXISTS chk_contab_factura_totales;`);
    await knex.raw(`
        ALTER TABLE contabilidad_factura 
            ADD CONSTRAINT chk_contab_factura_totales 
            CHECK (total >= 0 AND base_imponible >= 0 AND iva_importe >= 0 AND retencion_importe >= 0);
    `);

    // 4. Add retention check constraint
    await knex.raw(`
        ALTER TABLE contabilidad_factura 
            ADD CONSTRAINT chk_contab_factura_retencion 
            CHECK (retencion_porcentaje >= 0 AND retencion_porcentaje <= 100);
    `);
};

exports.down = async function (knex) {
    await knex.raw(`ALTER TABLE contabilidad_factura DROP CONSTRAINT IF EXISTS chk_contab_factura_retencion;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP CONSTRAINT IF EXISTS chk_contab_factura_totales;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS retencion_importe;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS retencion_porcentaje;`);
};

exports.config = { transaction: true };
