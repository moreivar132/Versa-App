/**
 * Fiscal Profile Enums
 * 
 * Constants for Spanish fiscal regime types.
 * Used for validation and type-safety across the contable module.
 * 
 * @module contable/domain/fiscalProfile.enums
 */

/**
 * Legal form of the fiscal entity
 * - SL: Sociedad Limitada (Limited Company)
 * - SA: Sociedad Anónima (Public Limited Company)
 * - AUTONOMO: Self-employed / Freelancer
 */
const LegalForm = Object.freeze({
    SL: 'SL',
    SA: 'SA',
    AUTONOMO: 'AUTONOMO'
});

/**
 * IRPF regime for autonomous workers
 * Only applicable when legal_form = AUTONOMO
 */
const IrpfRegime = Object.freeze({
    /** Simplified direct estimation - max 600k€ turnover */
    DIRECTA_SIMPLIFICADA: 'DIRECTA_SIMPLIFICADA',
    /** Normal direct estimation - no limits */
    DIRECTA_NORMAL: 'DIRECTA_NORMAL',
    /** Module-based estimation (estimación objetiva) */
    OBJETIVA_MODULOS: 'OBJETIVA_MODULOS'
});

/**
 * VAT regime
 */
const VatRegime = Object.freeze({
    /** Standard VAT regime */
    GENERAL: 'GENERAL',
    /** Simplified VAT regime */
    SIMPLIFICADO: 'SIMPLIFICADO',
    /** Equivalence surcharge (retail) */
    RECARGO_EQUIVALENCIA: 'RECARGO_EQUIVALENCIA',
    /** Agriculture, livestock, fishing */
    AGRICULTURA_GANADERIA_PESCA: 'AGRICULTURA_GANADERIA_PESCA',
    /** Exempt activities */
    EXENTO: 'EXENTO'
});

/**
 * Withholding types for invoices
 */
const WithholdingType = Object.freeze({
    /** Professional services (15% / 7% new) */
    IRPF_PROFESIONAL: 'IRPF_PROFESIONAL',
    /** Rental income (19%) */
    IRPF_ALQUILER: 'IRPF_ALQUILER',
    /** Agricultural activities */
    IRPF_AGRARIO: 'IRPF_AGRARIO'
});

/**
 * Tax rule types for tax_rules_es table
 */
const TaxRuleType = Object.freeze({
    /** Corporate tax rates */
    IS_RATE: 'IS_RATE',
    /** Professional withholding rate */
    IRPF_WITHHOLDING_RATE_PROFESSIONAL: 'IRPF_WITHHOLDING_RATE_PROFESSIONAL',
    /** Rental withholding rate */
    IRPF_WITHHOLDING_RATE_RENT: 'IRPF_WITHHOLDING_RATE_RENT',
    /** Agricultural withholding rate */
    IRPF_WITHHOLDING_RATE_AGRICULTURAL: 'IRPF_WITHHOLDING_RATE_AGRICULTURAL',
    /** Quarterly payment (direct estimation) */
    IRPF_PAGO_FRACCIONADO_DIRECTA: 'IRPF_PAGO_FRACCIONADO_DIRECTA',
    /** Quarterly payment (modules) */
    IRPF_PAGO_FRACCIONADO_MODULOS: 'IRPF_PAGO_FRACCIONADO_MODULOS',
    /** Module system limits */
    MODULOS_LIMITS: 'MODULOS_LIMITS',
    /** Simplified direct estimation limits */
    DIRECTA_SIMPLIFICADA_LIMITS: 'DIRECTA_SIMPLIFICADA_LIMITS',
    /** Standard VAT rate (21%) */
    VAT_STANDARD_RATE: 'VAT_STANDARD_RATE',
    /** Reduced VAT rate (10%) */
    VAT_REDUCED_RATE: 'VAT_REDUCED_RATE',
    /** Super-reduced VAT rate (4%) */
    VAT_SUPER_REDUCED_RATE: 'VAT_SUPER_REDUCED_RATE',
    /** Zero VAT rate (exports, etc.) */
    VAT_ZERO_RATE: 'VAT_ZERO_RATE'
});

/**
 * Tax model types for reporting obligations
 */
const TaxModel = Object.freeze({
    // Corporate Tax
    IS_200: 'IS_200', // Annual IS declaration
    IS_202: 'IS_202', // IS quarterly payment

    // VAT
    IVA_303: 'IVA_303', // Quarterly VAT
    IVA_390: 'IVA_390', // Annual VAT summary

    // IRPF Quarterly Payments
    IRPF_130: 'IRPF_130', // Direct estimation
    IRPF_131: 'IRPF_131', // Modules

    // Withholdings
    IRPF_111: 'IRPF_111', // Quarterly withholdings (salaries/professionals)
    IRPF_115: 'IRPF_115', // Quarterly withholdings (rentals)
    IRPF_190: 'IRPF_190', // Annual 111 summary
    IRPF_180: 'IRPF_180'  // Annual 115 summary
});

/**
 * Helper to check if legal form requires IRPF regime selection
 */
function requiresIrpfRegime(legalForm) {
    return legalForm === LegalForm.AUTONOMO;
}

/**
 * Helper to check if a company is subject to Corporate Tax (IS)
 */
function isSubjectToIS(legalForm) {
    return legalForm === LegalForm.SL || legalForm === LegalForm.SA;
}

/**
 * Get applicable tax models based on fiscal profile
 */
function getApplicableTaxModels(profile) {
    const models = [];

    // VAT is always applicable (unless exempt)
    if (profile.vat_regime !== VatRegime.EXENTO) {
        models.push(TaxModel.IVA_303, TaxModel.IVA_390);
    }

    // Corporate entities: IS
    if (isSubjectToIS(profile.legal_form)) {
        models.push(TaxModel.IS_200, TaxModel.IS_202);
    }

    // Autonomous: IRPF
    if (profile.legal_form === LegalForm.AUTONOMO) {
        if (profile.irpf_regime === IrpfRegime.OBJETIVA_MODULOS) {
            models.push(TaxModel.IRPF_131);
        } else {
            models.push(TaxModel.IRPF_130);
        }
    }

    // Withholdings (if applicable)
    if (profile.withholding_applicable) {
        models.push(TaxModel.IRPF_111, TaxModel.IRPF_190);
    }

    return models;
}

module.exports = {
    LegalForm,
    IrpfRegime,
    VatRegime,
    WithholdingType,
    TaxRuleType,
    TaxModel,
    requiresIrpfRegime,
    isSubjectToIS,
    getApplicableTaxModels
};
