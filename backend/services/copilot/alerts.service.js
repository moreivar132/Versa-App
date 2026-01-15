/**
 * Alerts Evaluation Service
 * Evalúa reglas de alerta y genera eventos
 */

const pool = require('../../db');
const toolsService = require('./tools.service');

/**
 * Evaluar todas las reglas activas
 * (Se ejecutaría en un cron job)
 */
async function evaluateAllRules() {
    const result = await pool.query(`
        SELECT * FROM copilot_alert_rule
        WHERE is_enabled = true
        ORDER BY id_tenant, id_empresa
    `);

    const promises = result.rows.map(rule => evaluateRule(rule));
    await Promise.allSettled(promises);
}

/**
 * Evaluar una regla específica
 */
async function evaluateRule(rule) {
    try {
        const params = rule.params_json;
        const empresaId = rule.id_empresa;

        // Si es regla global (sin empresa), evaluar para todas
        if (!empresaId) {
            // TODO: Implementar evaluación multi-empresa
            return;
        }

        const periodo = getCurrentPeriod(rule.frequency);
        let resultData = null;
        let severity = 'INFO';

        switch (rule.tipo) {
            case 'SIN_ADJUNTO':
                resultData = await checkSinAdjunto(empresaId);
                severity = resultData.count > 5 ? 'WARNING' : 'INFO';
                break;

            case 'SIN_CATEGORIA':
                resultData = await checkSinCategoria(empresaId);
                severity = resultData.count > 5 ? 'WARNING' : 'INFO';
                break;

            case 'GASTO_CATEGORIA_SPIKE':
                resultData = await checkCategoriaSpike(empresaId, periodo, params);
                severity = resultData.found ? 'WARNING' : 'INFO';
                break;

            case 'PROVEEDOR_SPIKE':
                resultData = await checkProveedorSpike(empresaId, periodo, params);
                severity = resultData.found ? 'WARNING' : 'INFO';
                break;

            default:
                console.log(`[Alerts] Unknown rule type: ${rule.tipo}`);
                return;
        }

        // Si hay hallazgos, crear evento
        if (shouldCreateEvent(resultData, rule.tipo)) {
            await createAlertEvent(rule.id, periodo, severity, resultData);
        }

    } catch (error) {
        console.error(`[Alerts] Error evaluating rule ${rule.id}:`, error);
    }
}

/**
 * Verificar facturas sin adjunto
 */
async function checkSinAdjunto(empresaId) {
    const result = await pool.query(`
        SELECT f.id, f.numero_factura, f.fecha_emision, f.total
        FROM contabilidad_factura f
        WHERE f.id_empresa = $1
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
          AND NOT EXISTS (
              SELECT 1 FROM contabilidad_factura_archivo a WHERE a.id_factura = f.id
          )
        ORDER BY f.fecha_emision DESC
        LIMIT 20
    `, [empresaId]);

    return {
        count: result.rows.length,
        items: result.rows.map(r => ({
            factura_id: r.id,
            numero: r.numero_factura,
            fecha: r.fecha_emision,
            total: parseFloat(r.total)
        }))
    };
}

/**
 * Verificar facturas sin categoría
 */
async function checkSinCategoria(empresaId) {
    const result = await pool.query(`
        SELECT id, numero_factura, fecha_emision, total
        FROM contabilidad_factura
        WHERE id_empresa = $1
          AND id_categoria IS NULL
          AND deleted_at IS NULL
          AND estado != 'ANULADA'
        ORDER BY fecha_emision DESC
        LIMIT 20
    `, [empresaId]);

    return {
        count: result.rows.length,
        items: result.rows.map(r => ({
            factura_id: r.id,
            numero: r.numero_factura,
            fecha: r.fecha_emision,
            total: parseFloat(r.total)
        }))
    };
}

/**
 * Detectar spike en categoría
 */
async function checkCategoriaSpike(empresaId, periodo, params) {
    const threshold = params.threshold_multiplier || 1.5;
    const categories = await toolsService.getSpendByCategory(
        empresaId,
        periodo.inicio,
        periodo.fin,
        10
    );

    // Obtener periodo anterior
    const prevPeriodo = getPreviousPeriod(periodo);
    const prevCategories = await toolsService.getSpendByCategory(
        empresaId,
        prevPeriodo.inicio,
        prevPeriodo.fin,
        10
    );

    const spikes = [];

    for (const cat of categories.items) {
        const prevCat = prevCategories.items.find(p => p.categoria_id === cat.categoria_id);
        if (prevCat && prevCat.total > 0) {
            const multiplier = cat.total / prevCat.total;
            if (multiplier >= threshold) {
                spikes.push({
                    categoria: cat.categoria,
                    current: cat.total,
                    previous: prevCat.total,
                    multiplier: multiplier.toFixed(2),
                    variation_pct: (((cat.total - prevCat.total) / prevCat.total) * 100).toFixed(1)
                });
            }
        }
    }

    return {
        found: spikes.length > 0,
        count: spikes.length,
        items: spikes
    };
}

/**
 * Detectar spike en proveedor
 */
async function checkProveedorSpike(empresaId, periodo, params) {
    const threshold = params.threshold_multiplier || 1.5;
    const vendors = await toolsService.getSpendByVendor(
        empresaId,
        periodo.inicio,
        periodo.fin,
        10
    );

    const prevPeriodo = getPreviousPeriod(periodo);
    const prevVendors = await toolsService.getSpendByVendor(
        empresaId,
        prevPeriodo.inicio,
        prevPeriodo.fin,
        10
    );

    const spikes = [];

    for (const vendor of vendors.items) {
        const prevVendor = prevVendors.items.find(p => p.contacto_id === vendor.contacto_id);
        if (prevVendor && prevVendor.total > 0) {
            const multiplier = vendor.total / prevVendor.total;
            if (multiplier >= threshold) {
                spikes.push({
                    proveedor: vendor.proveedor,
                    current: vendor.total,
                    previous: prevVendor.total,
                    multiplier: multiplier.toFixed(2)
                });
            }
        }
    }

    return {
        found: spikes.length > 0,
        count: spikes.length,
        items: spikes
    };
}

/**
 * Determinar si crear evento basado en resultados
 */
function shouldCreateEvent(resultData, tipoRegla) {
    if (!resultData) return false;

    if (tipoRegla === 'SIN_ADJUNTO' || tipoRegla === 'SIN_CATEGORIA') {
        return resultData.count > 0;
    }

    return resultData.found === true;
}

/**
 * Crear evento de alerta
 */
async function createAlertEvent(ruleId, periodo, severity, resultData) {
    await pool.query(`
        INSERT INTO copilot_alert_event (
            rule_id, periodo_inicio, periodo_fin, severity, result_json, status
        ) VALUES ($1, $2, $3, $4, $5, 'NEW')
    `, [
        ruleId,
        periodo.inicio,
        periodo.fin,
        severity,
        JSON.stringify(resultData)
    ]);
}

/**
 * Obtener periodo actual según frecuencia
 */
function getCurrentPeriod(frequency) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (frequency === 'MONTHLY') {
        const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const lastDayStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
        return { inicio: firstDay, fin: lastDayStr };
    }

    if (frequency === 'WEEKLY') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
            inicio: weekAgo.toISOString().split('T')[0],
            fin: now.toISOString().split('T')[0]
        };
    }

    // Daily
    return {
        inicio: now.toISOString().split('T')[0],
        fin: now.toISOString().split('T')[0]
    };
}

/**
 * Obtener periodo anterior
 */
function getPreviousPeriod(periodo) {
    const startDate = new Date(periodo.inicio);
    const endDate = new Date(periodo.fin);
    const duration = endDate - startDate;

    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setTime(prevStart.getTime() - duration);

    return {
        inicio: prevStart.toISOString().split('T')[0],
        fin: prevEnd.toISOString().split('T')[0]
    };
}

module.exports = {
    evaluateAllRules,
    evaluateRule
};
