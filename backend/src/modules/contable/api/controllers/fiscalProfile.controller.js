/**
 * Fiscal Profile Controller
 * Manages fiscal configuration for companies
 */

const fiscalProfileRepo = require('../../infra/repos/fiscalProfile.repo');
const {
    LegalForm,
    IrpfRegime,
    requiresIrpfRegime
} = require('../../domain/fiscalProfile.enums');

class FiscalProfileController {

    /**
     * Get fiscal config for a specific company and year
     * GET /empresas/:id/fiscal-config?year=2026
     */
    async getFiscalConfig(req, res) {
        try {
            const { id } = req.params; // empresaId
            const { year } = req.query;
            const tenantId = req.user.id_tenant;

            if (!year) {
                return res.status(400).json({
                    error: 'Year parameter is required'
                });
            }

            // 1. Get Profile
            const profile = await fiscalProfileRepo.getByEmpresaAndYear(tenantId, id, parseInt(year));

            // 2. Get Rules for context (optional, but useful for frontend limits)
            const rules = await fiscalProfileRepo.getTaxRules(parseInt(year));

            res.json({
                profile: profile || null, // null means not configured yet
                rules: rules.reduce((acc, rule) => {
                    acc[rule.rule_type] = rule.payload;
                    return acc;
                }, {})
            });

        } catch (error) {
            console.error('Error getting fiscal config:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Upsert fiscal config
     * POST /empresas/:id/fiscal-config
     */
    async upsertFiscalConfig(req, res) {
        try {
            const { id } = req.params; // empresaId
            const tenantId = req.user.id_tenant;
            const userId = req.user.id;
            const data = req.body;

            // Basic Validation
            if (!data.fiscal_year || !data.legal_form || !data.vat_regime) {
                return res.status(400).json({
                    error: 'Missing required fields: fiscal_year, legal_form, vat_regime'
                });
            }

            // Autonomous Validation
            if (data.legal_form === LegalForm.AUTONOMO && !data.irpf_regime) {
                return res.status(400).json({
                    error: 'IRPF Regime is required for AUTONOMO'
                });
            }

            // Modulos Limits Check (Soft Validation / Warning Acknowledgment)
            if (data.irpf_regime === IrpfRegime.OBJETIVA_MODULOS) {
                if (!data.modulos_ack) {
                    // In a real scenario, check limits against tax rules here if needed
                    // For now, we trust the frontend sent modulos_ack = true if warning was shown
                }
            }

            // Corporate Validation
            if (data.legal_form !== LegalForm.AUTONOMO) {
                // Ensure irpf_regime is null for SL/SA
                data.irpf_regime = null;
            }

            const profile = await fiscalProfileRepo.upsert(
                tenantId,
                id,
                data.fiscal_year,
                data,
                userId
            );

            res.json(profile);

        } catch (error) {
            console.error('Error saving fiscal config:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new FiscalProfileController();
