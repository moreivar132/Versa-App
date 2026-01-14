/**
 * Migration: tax_rules_es
 * 
 * Creates the tax_rules_es catalog table for storing Spanish tax rules.
 * Stores rates, limits, and conditions by fiscal year with JSONB payloads.
 * 
 * Rule types:
 * - IS_RATE: Corporate tax rates
 * - IRPF_WITHHOLDING_RATE_*: Personal income tax withholding rates
 * - *_LIMITS: Regime eligibility limits
 * - VAT_*_RATE: VAT rates by type
 */

exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('tax_rules_es');
    if (exists) {
        console.log('[Migration] tax_rules_es already exists, skipping');
        return;
    }

    await knex.schema.createTable('tax_rules_es', (table) => {
        table.bigIncrements('id').primary();

        // Scope
        table.string('country_code', 2).notNullable().defaultTo('ES');
        table.integer('fiscal_year').notNullable();

        // Rule identification
        table.string('rule_type', 50).notNullable();

        // Rule data (flexible structure per rule_type)
        table.jsonb('payload').notNullable();

        // Documentation
        table.text('source').nullable(); // AEAT URL or reference
        table.text('notes').nullable();

        // Status
        table.boolean('active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).nullable();

        // Unique per country/year/type
        table.unique(['country_code', 'fiscal_year', 'rule_type'], 'ux_tax_rules_es_type_year');

        // Index for queries
        table.index(['country_code', 'fiscal_year', 'active'], 'idx_tax_rules_es_active');
    });

    // Add CHECK constraint for valid rule_types
    await knex.raw(`
        ALTER TABLE tax_rules_es
        ADD CONSTRAINT chk_tax_rules_es_type 
            CHECK (rule_type IN (
                'IS_RATE',
                'IRPF_WITHHOLDING_RATE_PROFESSIONAL',
                'IRPF_WITHHOLDING_RATE_RENT',
                'IRPF_WITHHOLDING_RATE_AGRICULTURAL',
                'IRPF_PAGO_FRACCIONADO_DIRECTA',
                'IRPF_PAGO_FRACCIONADO_MODULOS',
                'MODULOS_LIMITS',
                'DIRECTA_SIMPLIFICADA_LIMITS',
                'VAT_STANDARD_RATE',
                'VAT_REDUCED_RATE',
                'VAT_SUPER_REDUCED_RATE',
                'VAT_ZERO_RATE'
            ));
    `);

    console.log('[Migration] ✅ Created tax_rules_es table');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('tax_rules_es');
    console.log('[Migration] 🗑️ Dropped tax_rules_es table');
};

exports.config = { transaction: true };
