/**
 * Migration: alter_factura_fiscal
 * 
 * Adds fiscal tracking columns to contabilidad_factura table.
 * Supports withholding (IRPF), tax snapshots, and regime tracking.
 */

exports.up = async function (knex) {
    // Check if columns already exist
    const hasWithholdingType = await knex.schema.hasColumn('contabilidad_factura', 'withholding_type');

    if (hasWithholdingType) {
        console.log('[Migration] Fiscal columns already exist on contabilidad_factura, skipping');
        return;
    }

    await knex.schema.alterTable('contabilidad_factura', (table) => {
        // Fiscal profile references (nullable for backward compatibility)
        table.bigInteger('issuer_fiscal_profile_id')
            .references('id').inTable('fiscal_profile')
            .nullable();
        table.bigInteger('receiver_fiscal_profile_id')
            .references('id').inTable('fiscal_profile')
            .nullable();

        // Tax snapshot: frozen copy of rules applied at invoice time
        table.jsonb('tax_snapshot').nullable();

        // Withholding (IRPF retention)
        table.string('withholding_type', 30).nullable();
        table.decimal('withholding_rate', 5, 2).defaultTo(0);
        table.decimal('withholding_amount', 14, 2).defaultTo(0);

        // VAT regime at invoice time
        table.string('vat_regime_snapshot', 30).nullable();

        // Recargo de equivalencia (surcharge)
        table.decimal('recargo_equivalencia_rate', 5, 2).defaultTo(0);
        table.decimal('recargo_equivalencia_amount', 14, 2).defaultTo(0);
    });

    // Add CHECK constraint for withholding_type
    await knex.raw(`
        ALTER TABLE contabilidad_factura
        ADD CONSTRAINT chk_factura_withholding_type 
            CHECK (withholding_type IS NULL OR withholding_type IN (
                'IRPF_PROFESIONAL', 'IRPF_ALQUILER', 'IRPF_AGRARIO'
            ));
    `);

    // Add index for fiscal profile queries
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_factura_issuer_fiscal 
        ON contabilidad_factura(issuer_fiscal_profile_id) 
        WHERE issuer_fiscal_profile_id IS NOT NULL;
    `);

    console.log('[Migration] ✅ Added fiscal columns to contabilidad_factura');
};

exports.down = async function (knex) {
    // Remove constraint first
    await knex.raw(`
        ALTER TABLE contabilidad_factura 
        DROP CONSTRAINT IF EXISTS chk_factura_withholding_type;
    `);

    await knex.raw(`
        DROP INDEX IF EXISTS idx_factura_issuer_fiscal;
    `);

    await knex.schema.alterTable('contabilidad_factura', (table) => {
        table.dropColumn('issuer_fiscal_profile_id');
        table.dropColumn('receiver_fiscal_profile_id');
        table.dropColumn('tax_snapshot');
        table.dropColumn('withholding_type');
        table.dropColumn('withholding_rate');
        table.dropColumn('withholding_amount');
        table.dropColumn('vat_regime_snapshot');
        table.dropColumn('recargo_equivalencia_rate');
        table.dropColumn('recargo_equivalencia_amount');
    });

    console.log('[Migration] 🗑️ Removed fiscal columns from contabilidad_factura');
};

exports.config = { transaction: true };
