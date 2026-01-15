/**
 * Insights Generator Service
 * Genera insights automáticos sin IA (queries directas)
 */

const toolsService = require('./tools.service');

/**
 * Generar todos los insights para un periodo
 * @param {number} empresaId 
 * @param {object} period - { type: 'month'|'quarter'|'year', year, month?, quarter? }
 * @returns {Array} - Array de insight cards
 */
async function generateInsights(empresaId, period) {
    const { dateFrom, dateTo } = calculatePeriodDates(period);
    const { dateFrom: prevFrom, dateTo: prevTo } = calculatePreviousPeriod(period);

    const insights = [];

    try {
        // Insight 1: Top categorías
        const categories = await toolsService.getSpendByCategory(empresaId, dateFrom, dateTo, 5);
        const prevCategories = await toolsService.getSpendByCategory(empresaId, prevFrom, prevTo, 5);

        insights.push({
            type: 'top_categories',
            title: 'Top Categorías de Gasto',
            icon: 'category',
            data: {
                items: categories.items,
                total: categories.summary.total,
                variation_pct: calculateVariation(categories.summary.total, prevCategories.summary.total)
            },
            actions: [
                { label: 'Ver detalle', type: 'filter', filter: { tipo: 'GASTO' } }
            ]
        });

        // Insight 2: Top proveedores
        const vendors = await toolsService.getSpendByVendor(empresaId, dateFrom, dateTo, 5);
        const prevVendors = await toolsService.getSpendByVendor(empresaId, prevFrom, prevTo, 5);

        insights.push({
            type: 'top_vendors',
            title: 'Top Proveedores',
            icon: 'groups',
            data: {
                items: vendors.items,
                total: vendors.summary.total,
                variation_pct: calculateVariation(vendors.summary.total, prevVendors.summary.total)
            },
            actions: [
                { label: 'Ver contactos', type: 'navigate', url: '/src/verticals/finsaas/pages/contactos.html' }
            ]
        });

        // Insight 3: Gastos anómalos
        const outliers = await toolsService.getOutliers(empresaId, dateFrom, dateTo, 2.0);

        if (outliers.summary.outliers_found > 0) {
            insights.push({
                type: 'outliers',
                title: 'Gastos Anómalos Detectados',
                icon: 'warning',
                severity: 'warning',
                data: {
                    count: outliers.summary.outliers_found,
                    items: outliers.items.slice(0, 3),
                    avg: outliers.summary.avg
                },
                actions: [
                    { label: 'Revisar', type: 'chat', question: '¿Qué gastos son anómalos este periodo?' }
                ]
            });
        }

        // Insight 4: Higiene contable
        const hygiene = await toolsService.getHygieneIssues(empresaId);

        if (hygiene.summary.total_issues > 0) {
            insights.push({
                type: 'hygiene',
                title: 'Higiene Contable',
                icon: 'cleaning_services',
                severity: hygiene.summary.total_issues > 10 ? 'warning' : 'info',
                data: {
                    sin_categoria: hygiene.summary.sin_categoria,
                    sin_adjunto: hygiene.summary.sin_adjunto
                },
                actions: [
                    { label: 'Corregir', type: 'navigate', url: '/src/verticals/finsaas/pages/documentos.html' }
                ]
            });
        }

        // Insight 5: Resumen IVA (solo si es trimestre o año)
        if (period.type === 'quarter' || period.type === 'year') {
            const ivaData = period.type === 'quarter'
                ? await toolsService.getIVASummary(empresaId, period.year, period.quarter)
                : await getIVAForYear(empresaId, period.year);

            insights.push({
                type: 'iva_summary',
                title: 'Resumen IVA',
                icon: 'account_balance',
                data: ivaData,
                actions: [
                    { label: 'Ver trimestres', type: 'navigate', url: '/src/verticals/finsaas/pages/trimestres.html' }
                ]
            });
        }

        // Insight 6: Resultado (ingresos - gastos)
        const profitLoss = await toolsService.getProfitLoss(empresaId, dateFrom, dateTo);

        insights.push({
            type: 'profit_loss',
            title: 'Resultado del Periodo',
            icon: profitLoss.summary.resultado >= 0 ? 'trending_up' : 'trending_down',
            severity: profitLoss.summary.resultado >= 0 ? 'success' : 'warning',
            data: profitLoss,
            actions: [
                { label: 'Analizar', type: 'chat', question: '¿Por qué tengo este resultado?' }
            ]
        });

    } catch (error) {
        console.error('[Insights] Error generating insights:', error);
    }

    return insights;
}

/**
 * Calcular fechas from/to para un periodo
 */
function calculatePeriodDates(period) {
    const { type, year, month, quarter } = period;

    if (type === 'month') {
        const dateFrom = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const dateTo = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
        return { dateFrom, dateTo };
    }

    if (type === 'quarter') {
        const startMonth = (quarter * 3 - 2);
        const endMonth = quarter * 3;
        const dateFrom = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, endMonth, 0).getDate();
        const dateTo = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay}`;
        return { dateFrom, dateTo };
    }

    if (type === 'year') {
        return {
            dateFrom: `${year}-01-01`,
            dateTo: `${year}-12-31`
        };
    }

    throw new Error(`Invalid period type: ${type}`);
}

/**
 * Calcular periodo anterior
 */
function calculatePreviousPeriod(period) {
    const { type, year, month, quarter } = period;

    if (type === 'month') {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        return calculatePeriodDates({ type: 'month', year: prevYear, month: prevMonth });
    }

    if (type === 'quarter') {
        const prevQuarter = quarter === 1 ? 4 : quarter - 1;
        const prevYear = quarter === 1 ? year - 1 : year;
        return calculatePeriodDates({ type: 'quarter', year: prevYear, quarter: prevQuarter });
    }

    if (type === 'year') {
        return calculatePeriodDates({ type: 'year', year: year - 1 });
    }

    throw new Error(`Invalid period type: ${type}`);
}

/**
 * Calcular variación porcentual
 */
function calculateVariation(current, previous) {
    if (!previous || previous === 0) return 0;
    return (((current - previous) / previous) * 100).toFixed(1);
}

/**
 * Obtener IVA acumulado anual
 */
async function getIVAForYear(empresaId, year) {
    const q1 = await toolsService.getIVASummary(empresaId, year, 1);
    const q2 = await toolsService.getIVASummary(empresaId, year, 2);
    const q3 = await toolsService.getIVASummary(empresaId, year, 3);
    const q4 = await toolsService.getIVASummary(empresaId, year, 4);

    return {
        summary: {
            year,
            iva_repercutido: q1.summary.iva_repercutido + q2.summary.iva_repercutido + q3.summary.iva_repercutido + q4.summary.iva_repercutido,
            iva_soportado: q1.summary.iva_soportado + q2.summary.iva_soportado + q3.summary.iva_soportado + q4.summary.iva_soportado,
            saldo_iva: q1.summary.saldo_iva + q2.summary.saldo_iva + q3.summary.saldo_iva + q4.summary.saldo_iva
        },
        by_quarter: [q1, q2, q3, q4]
    };
}

module.exports = {
    generateInsights,
    calculatePeriodDates,
    calculatePreviousPeriod
};
