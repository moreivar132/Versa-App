/**
 * Unit Tests: Fiscal Profile Enums & Helpers
 * 
 * Tests for the Spanish fiscal regime domain layer.
 */

const {
    LegalForm,
    IrpfRegime,
    VatRegime,
    WithholdingType,
    TaxRuleType,
    TaxModel,
    requiresIrpfRegime,
    isSubjectToIS,
    getApplicableTaxModels
} = require('../../../src/modules/contable/domain/fiscalProfile.enums');

describe('Fiscal Profile Enums', () => {
    describe('LegalForm', () => {
        it('should have all Spanish legal forms', () => {
            expect(LegalForm.SL).toBe('SL');
            expect(LegalForm.SA).toBe('SA');
            expect(LegalForm.AUTONOMO).toBe('AUTONOMO');
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(LegalForm)).toBe(true);
        });
    });

    describe('IrpfRegime', () => {
        it('should have all IRPF regimes', () => {
            expect(IrpfRegime.DIRECTA_SIMPLIFICADA).toBe('DIRECTA_SIMPLIFICADA');
            expect(IrpfRegime.DIRECTA_NORMAL).toBe('DIRECTA_NORMAL');
            expect(IrpfRegime.OBJETIVA_MODULOS).toBe('OBJETIVA_MODULOS');
        });
    });

    describe('VatRegime', () => {
        it('should have all VAT regimes', () => {
            expect(VatRegime.GENERAL).toBe('GENERAL');
            expect(VatRegime.SIMPLIFICADO).toBe('SIMPLIFICADO');
            expect(VatRegime.RECARGO_EQUIVALENCIA).toBe('RECARGO_EQUIVALENCIA');
            expect(VatRegime.AGRICULTURA_GANADERIA_PESCA).toBe('AGRICULTURA_GANADERIA_PESCA');
            expect(VatRegime.EXENTO).toBe('EXENTO');
        });
    });

    describe('WithholdingType', () => {
        it('should have all withholding types', () => {
            expect(WithholdingType.IRPF_PROFESIONAL).toBe('IRPF_PROFESIONAL');
            expect(WithholdingType.IRPF_ALQUILER).toBe('IRPF_ALQUILER');
            expect(WithholdingType.IRPF_AGRARIO).toBe('IRPF_AGRARIO');
        });
    });

    describe('TaxRuleType', () => {
        it('should have IS rate type', () => {
            expect(TaxRuleType.IS_RATE).toBe('IS_RATE');
        });

        it('should have all VAT rate types', () => {
            expect(TaxRuleType.VAT_STANDARD_RATE).toBe('VAT_STANDARD_RATE');
            expect(TaxRuleType.VAT_REDUCED_RATE).toBe('VAT_REDUCED_RATE');
            expect(TaxRuleType.VAT_SUPER_REDUCED_RATE).toBe('VAT_SUPER_REDUCED_RATE');
        });

        it('should have regime limit types', () => {
            expect(TaxRuleType.MODULOS_LIMITS).toBe('MODULOS_LIMITS');
            expect(TaxRuleType.DIRECTA_SIMPLIFICADA_LIMITS).toBe('DIRECTA_SIMPLIFICADA_LIMITS');
        });
    });
});

describe('Fiscal Profile Helpers', () => {
    describe('requiresIrpfRegime()', () => {
        it('should return true for AUTONOMO', () => {
            expect(requiresIrpfRegime(LegalForm.AUTONOMO)).toBe(true);
        });

        it('should return false for SL', () => {
            expect(requiresIrpfRegime(LegalForm.SL)).toBe(false);
        });

        it('should return false for SA', () => {
            expect(requiresIrpfRegime(LegalForm.SA)).toBe(false);
        });
    });

    describe('isSubjectToIS()', () => {
        it('should return true for SL', () => {
            expect(isSubjectToIS(LegalForm.SL)).toBe(true);
        });

        it('should return true for SA', () => {
            expect(isSubjectToIS(LegalForm.SA)).toBe(true);
        });

        it('should return false for AUTONOMO', () => {
            expect(isSubjectToIS(LegalForm.AUTONOMO)).toBe(false);
        });
    });

    describe('getApplicableTaxModels()', () => {
        it('should return IS models for SL with general VAT', () => {
            const profile = {
                legal_form: LegalForm.SL,
                vat_regime: VatRegime.GENERAL,
                withholding_applicable: false
            };

            const models = getApplicableTaxModels(profile);

            expect(models).toContain(TaxModel.IVA_303);
            expect(models).toContain(TaxModel.IVA_390);
            expect(models).toContain(TaxModel.IS_200);
            expect(models).toContain(TaxModel.IS_202);
            expect(models).not.toContain(TaxModel.IRPF_130);
        });

        it('should return IRPF 130 for AUTONOMO with directa simplificada', () => {
            const profile = {
                legal_form: LegalForm.AUTONOMO,
                irpf_regime: IrpfRegime.DIRECTA_SIMPLIFICADA,
                vat_regime: VatRegime.GENERAL,
                withholding_applicable: false
            };

            const models = getApplicableTaxModels(profile);

            expect(models).toContain(TaxModel.IRPF_130);
            expect(models).not.toContain(TaxModel.IRPF_131);
            expect(models).not.toContain(TaxModel.IS_200);
        });

        it('should return IRPF 131 for AUTONOMO with modulos', () => {
            const profile = {
                legal_form: LegalForm.AUTONOMO,
                irpf_regime: IrpfRegime.OBJETIVA_MODULOS,
                vat_regime: VatRegime.GENERAL,
                withholding_applicable: false
            };

            const models = getApplicableTaxModels(profile);

            expect(models).toContain(TaxModel.IRPF_131);
            expect(models).not.toContain(TaxModel.IRPF_130);
        });

        it('should include withholding models when applicable', () => {
            const profile = {
                legal_form: LegalForm.SL,
                vat_regime: VatRegime.GENERAL,
                withholding_applicable: true
            };

            const models = getApplicableTaxModels(profile);

            expect(models).toContain(TaxModel.IRPF_111);
            expect(models).toContain(TaxModel.IRPF_190);
        });

        it('should not include VAT models for exempt entities', () => {
            const profile = {
                legal_form: LegalForm.AUTONOMO,
                irpf_regime: IrpfRegime.DIRECTA_SIMPLIFICADA,
                vat_regime: VatRegime.EXENTO,
                withholding_applicable: false
            };

            const models = getApplicableTaxModels(profile);

            expect(models).not.toContain(TaxModel.IVA_303);
            expect(models).not.toContain(TaxModel.IVA_390);
        });
    });
});
