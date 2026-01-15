/**
 * Fiscal Profile Repository
 * Data access for fiscal profiles and tax rules
 */

const { getTenantDb } = require('../../../../core/db/tenant-db');

class FiscalProfileRepository {
    /**
     * Get fiscal profile by ID
     */
    async getById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM fiscal_profile
            WHERE id = $1
        `, [id]);

        return result.rows[0] || null;
    }

    /**
     * Get fiscal profile by Empresa and Year
     */
    async getByEmpresaAndYear(ctx, empresaId, year) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM fiscal_profile
            WHERE id_empresa = $1 AND fiscal_year = $2
        `, [empresaId, year]);

        return result.rows[0] || null;
    }

    /**
     * Create or Update Fiscal Profile (Upsert)
     * For a given empresa and year, there is only one profile.
     */
    async upsert(ctx, empresaId, year, data) {
        const db = getTenantDb(ctx);
        const userId = ctx.userId;

        const result = await db.query(`
            INSERT INTO fiscal_profile (
                id_tenant, id_empresa, fiscal_year, legal_form, 
                irpf_regime, vat_regime, is_new_company, turnover_prev_year,
                professional_activity, withholding_applicable, iae_epigrafe,
                modulos_ack, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            ON CONFLICT (id_empresa, fiscal_year) 
            DO UPDATE SET
                legal_form = EXCLUDED.legal_form,
                irpf_regime = EXCLUDED.irpf_regime,
                vat_regime = EXCLUDED.vat_regime,
                is_new_company = EXCLUDED.is_new_company,
                turnover_prev_year = EXCLUDED.turnover_prev_year,
                professional_activity = EXCLUDED.professional_activity,
                withholding_applicable = EXCLUDED.withholding_applicable,
                iae_epigrafe = EXCLUDED.iae_epigrafe,
                modulos_ack = EXCLUDED.modulos_ack,
                updated_at = now(),
                updated_by = $13
            RETURNING *
        `, [
            ctx.tenantId, empresaId, year, data.legal_form,
            data.irpf_regime, data.vat_regime, data.is_new_company,
            data.turnover_prev_year, data.professional_activity,
            data.withholding_applicable, data.iae_epigrafe,
            data.modulos_ack, userId
        ]);

        return result.rows[0];
    }

    /**
     * Get active tax rules for a given year
     */
    async getTaxRules(ctx, year, countryCode = 'ES') {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM tax_rules_es
            WHERE fiscal_year = $1 AND country_code = $2 AND active = true
        `, [year, countryCode]);

        return result.rows;
    }
}

module.exports = new FiscalProfileRepository();
