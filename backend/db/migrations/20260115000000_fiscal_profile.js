/**
 * Migration: fiscal_profile
 * 
 * Creates the fiscal_profile table for Spanish tax regime tracking.
 * Each accounting_empresa can have one fiscal profile per fiscal year.
 * 
 * @see docs/MODULES/SAAS_FISCAL_ES.md
 */

exports.up = async function (knex) {
    // Check if table already exists
    const exists = await knex.schema.hasTable('fiscal_profile');
    if (exists) {
        console.log('[Migration] fiscal_profile already exists, skipping');
        return;
    }

    await knex.schema.createTable('fiscal_profile', (table) => {
        table.bigIncrements('id').primary();

        // Relationships
        table.bigInteger('id_tenant').notNullable()
            .references('id').inTable('tenant')
            .onDelete('CASCADE');
        table.bigInteger('id_empresa').notNullable()
            .references('id').inTable('accounting_empresa')
            .onDelete('CASCADE');

        // Location & Period
        table.string('country_code', 2).notNullable().defaultTo('ES');
        table.integer('fiscal_year').notNullable();

        // === Type Classification ===
        // legal_form: SL (Sociedad Limitada), SA (Sociedad Anónima), AUTONOMO (Self-employed)
        table.string('legal_form', 20).notNullable();

        // irpf_regime: Only applicable for AUTONOMO
        // DIRECTA_SIMPLIFICADA: Simplified direct estimation (limit 600k€)
        // DIRECTA_NORMAL: Normal direct estimation
        // OBJETIVA_MODULOS: Module-based estimation
        table.string('irpf_regime', 30).nullable();

        // vat_regime: VAT treatment method
        table.string('vat_regime', 30).notNullable().defaultTo('GENERAL');

        // === Control Flags ===
        // is_new_company: Eligible for reduced IS rate (15% first 2 years)
        table.boolean('is_new_company').defaultTo(false);

        // turnover_prev_year: Net turnover from previous year (for micropyme calculation)
        table.decimal('turnover_prev_year', 14, 2).nullable();

        // professional_activity: If true, withholding applies by default on B2B invoices
        table.boolean('professional_activity').defaultTo(false);

        // withholding_applicable: Default withholding behavior for sales
        table.boolean('withholding_applicable').defaultTo(false);

        // iae_epigrafe: IAE tax code (economic activity identifier)
        table.string('iae_epigrafe', 50).nullable();

        // modulos_ack: User acknowledged module system limits
        table.boolean('modulos_ack').defaultTo(false);

        // === Audit ===
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.bigInteger('created_by').references('id').inTable('usuario');
        table.timestamp('updated_at', { useTz: true }).nullable();
        table.bigInteger('updated_by').references('id').inTable('usuario');

        // === Constraints ===
        // One fiscal profile per empresa per year
        table.unique(['id_empresa', 'fiscal_year'], 'ux_fiscal_profile_empresa_year');

        // Index for tenant queries
        table.index(['id_tenant', 'fiscal_year'], 'idx_fiscal_profile_tenant_year');
    });

    // Add CHECK constraints via raw SQL
    await knex.raw(`
        ALTER TABLE fiscal_profile
        ADD CONSTRAINT chk_fiscal_profile_legal_form 
            CHECK (legal_form IN ('SL', 'SA', 'AUTONOMO'));
    `);

    await knex.raw(`
        ALTER TABLE fiscal_profile
        ADD CONSTRAINT chk_fiscal_profile_irpf_regime 
            CHECK (irpf_regime IS NULL OR irpf_regime IN (
                'DIRECTA_SIMPLIFICADA', 'DIRECTA_NORMAL', 'OBJETIVA_MODULOS'
            ));
    `);

    await knex.raw(`
        ALTER TABLE fiscal_profile
        ADD CONSTRAINT chk_fiscal_profile_vat_regime 
            CHECK (vat_regime IN (
                'GENERAL', 'SIMPLIFICADO', 'RECARGO_EQUIVALENCIA', 
                'AGRICULTURA_GANADERIA_PESCA', 'EXENTO'
            ));
    `);

    // Business rule: AUTONOMO must have irpf_regime
    await knex.raw(`
        ALTER TABLE fiscal_profile
        ADD CONSTRAINT chk_fiscal_profile_autonomo_irpf
            CHECK (
                (legal_form != 'AUTONOMO') OR 
                (legal_form = 'AUTONOMO' AND irpf_regime IS NOT NULL)
            );
    `);

    console.log('[Migration] ✅ Created fiscal_profile table');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('fiscal_profile');
    console.log('[Migration] 🗑️ Dropped fiscal_profile table');
};

exports.config = { transaction: true };
