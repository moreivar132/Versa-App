/**
 * Seed: Spanish Tax Rules 2025-2026
 * 
 * Populates tax_rules_es with current Spanish tax rates and limits.
 * Data sourced from AEAT (Agencia Tributaria).
 * 
 * Run with: npx knex seed:run --specific=seed_tax_rules_es_2026.js
 */

const { TaxRuleType } = require('../../src/modules/contable/domain/fiscalProfile.enums');

exports.seed = async function (knex) {
    // Years to seed
    const years = [2025, 2026];

    for (const year of years) {
        const rules = [
            // ===== CORPORATE TAX (IS) =====
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IS_RATE,
                payload: JSON.stringify({
                    general: 25,
                    nueva_creacion: {
                        rate: 15,
                        duration_years: 2,
                        description: 'Tipo reducido para entidades de nueva creación (primeros 2 periodos con base positiva)'
                    },
                    micropyme: {
                        base_reducida: {
                            hasta: 300000,
                            rate: 17
                        },
                        resto: {
                            rate: 20
                        },
                        requisitos: {
                            cifra_negocio_max: 1000000,
                            plantilla_media_max: null
                        }
                    },
                    cooperativas: 20,
                    entidades_sin_animo_lucro: 10
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/impuesto-sobre-sociedades.html',
                active: true
            },

            // ===== IRPF WITHHOLDINGS =====
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IRPF_WITHHOLDING_RATE_PROFESSIONAL,
                payload: JSON.stringify({
                    standard: 15,
                    nuevo_autonomo: {
                        rate: 7,
                        duration_years: 3,
                        description: 'Tipo reducido primeros 3 años de actividad'
                    },
                    cursos_conferencias: 15,
                    recaudadores_mediadores: 7
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IRPF_WITHHOLDING_RATE_RENT,
                payload: JSON.stringify({
                    standard: 19,
                    arrendamiento_negocio: 19,
                    subarrendamiento: 19
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/retenciones-arrendamiento-inmuebles.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IRPF_WITHHOLDING_RATE_AGRICULTURAL,
                payload: JSON.stringify({
                    general: 2,
                    ganaderia_engorde: 1,
                    forestal: 2
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/retenciones-agrarias.html',
                active: true
            },

            // ===== QUARTERLY PAYMENTS =====
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IRPF_PAGO_FRACCIONADO_DIRECTA,
                payload: JSON.stringify({
                    modelo: 130,
                    calculo: {
                        tipo_fijo: 20,
                        sobre: 'rendimiento_neto_acumulado',
                        deducciones: ['retenciones_soportadas', 'pagos_fraccionados_anteriores']
                    },
                    plazos: {
                        T1: { inicio: '04-01', fin: '04-20' },
                        T2: { inicio: '07-01', fin: '07-20' },
                        T3: { inicio: '10-01', fin: '10-20' },
                        T4: { inicio: '01-01', fin: '01-30' }
                    }
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI02.shtml',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.IRPF_PAGO_FRACCIONADO_MODULOS,
                payload: JSON.stringify({
                    modelo: 131,
                    calculo: {
                        sobre: 'cuotas_modulos_trimestre',
                        tipo: 'segun_modulo'
                    },
                    plazos: {
                        T1: { inicio: '04-01', fin: '04-20' },
                        T2: { inicio: '07-01', fin: '07-20' },
                        T3: { inicio: '10-01', fin: '10-20' },
                        T4: { inicio: '01-01', fin: '01-30' }
                    }
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI03.shtml',
                active: true
            },

            // ===== REGIME LIMITS =====
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.DIRECTA_SIMPLIFICADA_LIMITS,
                payload: JSON.stringify({
                    volumen_rendimientos_max: 600000,
                    exclusiones: [
                        'otra_actividad_en_modulos',
                        'determinacion_rendimiento_neto_reduccion'
                    ],
                    gastos_dificil_justificacion: {
                        porcentaje: 5,
                        limite: 2000
                    }
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/irpf/estimacion-directa-simplificada.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.MODULOS_LIMITS,
                payload: JSON.stringify({
                    volumen_rendimientos_conjunto: 250000,
                    volumen_rendimientos_agricola_forestal_ganadera: 250000,
                    volumen_compras: 250000,
                    excluye_compras: ['inmovilizado'],
                    personal_asalariado_max: null,
                    actividades_excluidas: [
                        'profesionales',
                        'fabricacion',
                        'construccion',
                        'mayoristas'
                    ],
                    renuncia_efectos: {
                        duracion_minima_anos: 3
                    }
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/irpf/estimacion-objetiva.html',
                active: true
            },

            // ===== VAT RATES =====
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.VAT_STANDARD_RATE,
                payload: JSON.stringify({
                    rate: 21,
                    applicable_to: ['general', 'default']
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/iva.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.VAT_REDUCED_RATE,
                payload: JSON.stringify({
                    rate: 10,
                    applicable_to: [
                        'alimentos_humano_animal',
                        'agua',
                        'medicamentos_veterinarios',
                        'vivienda_nueva',
                        'transporte_viajeros',
                        'hosteleria',
                        'servicios_limpieza_municipal',
                        'espectaculos',
                        'servicios_funerarios'
                    ]
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/iva/tipos-impositivos.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.VAT_SUPER_REDUCED_RATE,
                payload: JSON.stringify({
                    rate: 4,
                    applicable_to: [
                        'pan_comun',
                        'leche',
                        'queso',
                        'huevos',
                        'frutas_verduras',
                        'libros_periodicos',
                        'medicamentos_humanos',
                        'vehiculos_movilidad_reducida',
                        'protesis',
                        'vivienda_proteccion_oficial'
                    ]
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/iva/tipos-impositivos.html',
                active: true
            },
            {
                country_code: 'ES',
                fiscal_year: year,
                rule_type: TaxRuleType.VAT_ZERO_RATE,
                payload: JSON.stringify({
                    rate: 0,
                    applicable_to: [
                        'exportaciones',
                        'entregas_intracomunitarias',
                        'transporte_internacional',
                        'zonas_francas'
                    ]
                }),
                source: 'https://sede.agenciatributaria.gob.es/Sede/iva/exenciones.html',
                active: true
            }
        ];

        // Upsert each rule
        for (const rule of rules) {
            await knex('tax_rules_es')
                .insert(rule)
                .onConflict(['country_code', 'fiscal_year', 'rule_type'])
                .merge({
                    payload: rule.payload,
                    source: rule.source,
                    active: rule.active,
                    updated_at: knex.fn.now()
                });
        }

        console.log(`[Seed] ✅ Seeded ${rules.length} tax rules for fiscal year ${year}`);
    }
};
