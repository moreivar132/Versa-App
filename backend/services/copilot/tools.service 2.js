/**
 * Copilot Tools Service
 * Herramientas predefinidas para obtener datos contables
 * ANTI-ALUCINACIÓN: Solo datos reales de DB
 */

const { getTenantDb } = require('../../src/core/db/tenant-db');

/**
 * Tool 1: Obten gasto por categoría
 */
async function getSpendByCategory(empresaId, dateFrom, dateTo, limit = 10, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getSpendByCategory');
    const db = getTenantDb({ tenantId });

    const result = await db.query(`
        SELECT 
            cc.id,
            cc.codigo,
            cc.nombre as categoria,
            COUNT(f.id) as num_facturas,
            SUM(f.total) as total_gasto,
            AVG(f.total) as promedio_factura,
            MIN(f.total) as min_factura,
            MAX(f.total) as max_factura
        FROM contabilidad_factura f
        JOIN contable_category cc ON cc.id = f.id_categoria
        WHERE f.id_empresa = $1
          AND f.tipo = 'GASTO'
          AND f.fecha_devengo BETWEEN $2 AND $3
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
        GROUP BY cc.id, cc.codigo, cc.nombre
        ORDER BY total_gasto DESC
        LIMIT $4
    `, [empresaId, dateFrom, dateTo, limit]);

    const totalResult = await db.query(`
        SELECT 
            SUM(f.total) as total_general,
            COUNT(f.id) as total_facturas
        FROM contabilidad_factura f
        WHERE f.id_empresa = $1
          AND f.tipo = 'GASTO'
          AND f.fecha_devengo BETWEEN $2 AND $3
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
    `, [empresaId, dateFrom, dateTo]);

    return {
        summary: {
            total: parseFloat(totalResult.rows[0]?.total_general || 0),
            count: parseInt(totalResult.rows[0]?.total_facturas || 0),
            num_categories: result.rows.length
        },
        items: result.rows.map(row => ({
            categoria_id: row.id,
            categoria: row.categoria,
            codigo: row.codigo,
            total: parseFloat(row.total_gasto),
            num_facturas: parseInt(row.num_facturas),
            promedio: parseFloat(row.promedio_factura),
            min: parseFloat(row.min_factura),
            max: parseFloat(row.max_factura)
        })),
        metadata: {
            empresa_id: empresaId,
            periodo: { inicio: dateFrom, fin: dateTo },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 2: Obtener gasto por proveedor
 */
async function getSpendByVendor(empresaId, dateFrom, dateTo, limit = 10, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getSpendByVendor');
    const db = getTenantDb({ tenantId });

    const result = await db.query(`
        SELECT 
            c.id,
            c.nombre as proveedor,
            c.nif_cif,
            COUNT(f.id) as num_facturas,
            SUM(f.total) as total_gasto,
            AVG(f.total) as promedio_factura
        FROM contabilidad_factura f
        JOIN contabilidad_contacto c ON c.id = f.id_contacto
        WHERE f.id_empresa = $1
          AND f.tipo = 'GASTO'
          AND f.fecha_devengo BETWEEN $2 AND $3
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
        GROUP BY c.id, c.nombre, c.nif_cif
        ORDER BY total_gasto DESC
        LIMIT $4
    `, [empresaId, dateFrom, dateTo, limit]);

    return {
        summary: {
            num_vendors: result.rows.length,
            total: result.rows.reduce((sum, r) => sum + parseFloat(r.total_gasto), 0)
        },
        items: result.rows.map(row => ({
            contacto_id: row.id,
            proveedor: row.proveedor,
            nif_cif: row.nif_cif,
            total: parseFloat(row.total_gasto),
            num_facturas: parseInt(row.num_facturas),
            promedio: parseFloat(row.promedio_factura)
        })),
        metadata: {
            empresa_id: empresaId,
            periodo: { inicio: dateFrom, fin: dateTo },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 3: Top facturas (mayores gastos/ingresos)
 */
async function getTopInvoices(empresaId, dateFrom, dateTo, tipo = 'GASTO', limit = 20, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getTopInvoices');
    const db = getTenantDb({ tenantId });

    const result = await db.query(`
        SELECT 
            f.id,
            f.numero_factura,
            f.fecha_emision,
            f.fecha_devengo,
            f.total,
            f.estado,
            c.nombre as contacto_nombre,
            cc.nombre as categoria
        FROM contabilidad_factura f
        LEFT JOIN contabilidad_contacto c ON c.id = f.id_contacto
        LEFT JOIN contable_category cc ON cc.id = f.id_categoria
        WHERE f.id_empresa = $1
          AND f.tipo = $2
          AND f.fecha_devengo BETWEEN $3 AND $4
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
        ORDER BY f.total DESC
        LIMIT $5
    `, [empresaId, tipo, dateFrom, dateTo, limit]);

    return {
        summary: {
            count: result.rows.length,
            total: result.rows.reduce((sum, r) => sum + parseFloat(r.total), 0)
        },
        items: result.rows.map(row => ({
            factura_id: row.id,
            numero: row.numero_factura,
            fecha_emision: row.fecha_emision,
            fecha_devengo: row.fecha_devengo,
            total: parseFloat(row.total),
            estado: row.estado,
            contacto: row.contacto_nombre,
            categoria: row.categoria
        })),
        metadata: {
            empresa_id: empresaId,
            tipo,
            periodo: { inicio: dateFrom, fin: dateTo },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 4: Detectar gastos anómalos (outliers)
 */
async function getOutliers(empresaId, dateFrom, dateTo, threshold = 2.0, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getOutliers');
    const db = getTenantDb({ tenantId });

    // Primero obtener promedio y desviación estándar
    const statsResult = await db.query(`
        SELECT 
            AVG(total) as avg_total,
            STDDEV(total) as stddev_total
        FROM contabilidad_factura
        WHERE id_empresa = $1
          AND tipo = 'GASTO'
          AND fecha_devengo BETWEEN $2 AND $3
          AND deleted_at IS NULL
          AND estado != 'ANULADA'
    `, [empresaId, dateFrom, dateTo]);

    const avg = parseFloat(statsResult.rows[0]?.avg_total || 0);
    const stddev = parseFloat(statsResult.rows[0]?.stddev_total || 0);
    const upperBound = avg + (threshold * stddev);

    if (stddev === 0) {
        return {
            summary: { outliers_found: 0, avg, threshold_used: threshold },
            items: [],
            metadata: { empresa_id: empresaId, periodo: { inicio: dateFrom, fin: dateTo } }
        };
    }

    // Obtener facturas que excedan el límite
    const result = await db.query(`
        SELECT 
            f.id,
            f.numero_factura,
            f.fecha_emision,
            f.total,
            c.nombre as contacto_nombre,
            cc.nombre as categoria,
            ($4 - f.total) / $5 as z_score
        FROM contabilidad_factura f
        LEFT JOIN contabilidad_contacto c ON c.id = f.id_contacto
        LEFT JOIN contable_category cc ON cc.id = f.id_categoria
        WHERE f.id_empresa = $1
          AND f.tipo = 'GASTO'
          AND f.fecha_devengo BETWEEN $2 AND $3
          AND f.total > $6
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
        ORDER BY f.total DESC
        LIMIT 10
    `, [empresaId, dateFrom, dateTo, avg, stddev, upperBound]);

    return {
        summary: {
            outliers_found: result.rows.length,
            avg,
            stddev,
            threshold_used: threshold,
            upper_bound: upperBound
        },
        items: result.rows.map(row => ({
            factura_id: row.id,
            numero: row.numero_factura,
            fecha: row.fecha_emision,
            total: parseFloat(row.total),
            contacto: row.contacto_nombre,
            categoria: row.categoria,
            z_score: Math.abs(parseFloat(row.z_score)),
            multiplier: (parseFloat(row.total) / avg).toFixed(2)
        })),
        metadata: {
            empresa_id: empresaId,
            periodo: { inicio: dateFrom, fin: dateTo },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 5: Resumen IVA (repercutido vs soportado)
 */
async function getIVASummary(empresaId, year, quarter, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getIVASummary');
    const db = getTenantDb({ tenantId });

    const quarterStart = `${year}-${(quarter * 3 - 2).toString().padStart(2, '0')}-01`;
    const quarterEndMonth = quarter * 3;
    const lastDay = new Date(year, quarterEndMonth, 0).getDate();
    const quarterEnd = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDay}`;

    const result = await db.query(`
        SELECT 
            tipo,
            SUM(base_imponible) as base_total,
            SUM(iva_importe) as iva_total,
            SUM(total) as total,
            COUNT(*) as num_facturas
        FROM contabilidad_factura
        WHERE id_empresa = $1
          AND fecha_devengo BETWEEN $2 AND $3
          AND deleted_at IS NULL
          AND estado != 'ANULADA'
        GROUP BY tipo
    `, [empresaId, quarterStart, quarterEnd]);

    const ingresos = result.rows.find(r => r.tipo === 'INGRESO') || {};
    const gastos = result.rows.find(r => r.tipo === 'GASTO') || {};

    const ivaRepercutido = parseFloat(ingresos.iva_total || 0);
    const ivaSoportado = parseFloat(gastos.iva_total || 0);
    const saldo = ivaRepercutido - ivaSoportado;

    return {
        summary: {
            year,
            quarter,
            iva_repercutido: ivaRepercutido,
            iva_soportado: ivaSoportado,
            saldo_iva: saldo,
            estado_saldo: saldo > 0 ? 'A PAGAR' : 'A FAVOR'
        },
        ingresos: {
            base: parseFloat(ingresos.base_total || 0),
            iva: ivaRepercutido,
            total: parseFloat(ingresos.total || 0),
            num_facturas: parseInt(ingresos.num_facturas || 0)
        },
        gastos: {
            base: parseFloat(gastos.base_total || 0),
            iva: ivaSoportado,
            total: parseFloat(gastos.total || 0),
            num_facturas: parseInt(gastos.num_facturas || 0)
        },
        metadata: {
            empresa_id: empresaId,
            periodo: { inicio: quarterStart, fin: quarterEnd },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 6: Resultado contable (ingresos - gastos)
 */
async function getProfitLoss(empresaId, dateFrom, dateTo, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getProfitLoss');
    const db = getTenantDb({ tenantId });

    const result = await db.query(`
        SELECT 
            tipo,
            SUM(total) as total,
            SUM(base_imponible) as base,
            COUNT(*) as num_facturas
        FROM contabilidad_factura
        WHERE id_empresa = $1
          AND fecha_devengo BETWEEN $2 AND $3
          AND deleted_at IS NULL
          AND estado != 'ANULADA'
        GROUP BY tipo
    `, [empresaId, dateFrom, dateTo]);

    const ingresos = result.rows.find(r => r.tipo === 'INGRESO') || {};
    const gastos = result.rows.find(r => r.tipo === 'GASTO') || {};

    const totalIngresos = parseFloat(ingresos.total || 0);
    const totalGastos = parseFloat(gastos.total || 0);
    const resultado = totalIngresos - totalGastos;

    return {
        summary: {
            ingresos: totalIngresos,
            gastos: totalGastos,
            resultado,
            estado: resultado >= 0 ? 'BENEFICIO' : 'PÉRDIDA',
            margen_pct: totalIngresos > 0 ? ((resultado / totalIngresos) * 100).toFixed(2) : 0
        },
        ingresos: {
            total: totalIngresos,
            base: parseFloat(ingresos.base || 0),
            num_facturas: parseInt(ingresos.num_facturas || 0)
        },
        gastos: {
            total: totalGastos,
            base: parseFloat(gastos.base || 0),
            num_facturas: parseInt(gastos.num_facturas || 0)
        },
        metadata: {
            empresa_id: empresaId,
            periodo: { inicio: dateFrom, fin: dateTo },
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 7: Buscar documentos por texto
 */
async function searchDocuments(empresaId, query, filters = {}, tenantId) {
    if (!tenantId) throw new Error('TenantID required for searchDocuments');
    const db = getTenantDb({ tenantId });

    let conditions = ['f.id_empresa = $1', 'f.deleted_at IS NULL'];
    let params = [empresaId];
    let paramCount = 2;

    if (query) {
        conditions.push(`(f.numero_factura ILIKE $${paramCount} OR c.nombre ILIKE $${paramCount})`);
        params.push(`%${query}%`);
        paramCount++;
    }

    if (filters.tipo) {
        conditions.push(`f.tipo = $${paramCount}`);
        params.push(filters.tipo);
        paramCount++;
    }

    if (filters.estado) {
        conditions.push(`f.estado = $${paramCount}`);
        params.push(filters.estado);
        paramCount++;
    }

    const result = await db.query(`
        SELECT 
            f.id,
            f.numero_factura,
            f.fecha_emision,
            f.total,
            f.estado,
            f.tipo,
            c.nombre as contacto_nombre,
            cc.nombre as categoria
        FROM contabilidad_factura f
        LEFT JOIN contabilidad_contacto c ON c.id = f.id_contacto
        LEFT JOIN contable_category cc ON cc.id = f.id_categoria
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.fecha_emision DESC
        LIMIT 20
    `, params);

    return {
        summary: { results_found: result.rows.length },
        items: result.rows.map(row => ({
            factura_id: row.id,
            numero: row.numero_factura,
            fecha: row.fecha_emision,
            total: parseFloat(row.total),
            estado: row.estado,
            tipo: row.tipo,
            contacto: row.contacto_nombre,
            categoria: row.categoria
        })),
        metadata: {
            empresa_id: empresaId,
            search_query: query,
            filters,
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 8: Problemas de higiene (sin categoría, sin adjunto)
 */
async function getHygieneIssues(empresaId, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getHygieneIssues');
    const db = getTenantDb({ tenantId });

    const sinCategoriaResult = await db.query(`
        SELECT COUNT(*) as count
        FROM contabilidad_factura
        WHERE id_empresa = $1
          AND id_categoria IS NULL
          AND deleted_at IS NULL
          AND estado != 'ANULADA'
    `, [empresaId]);

    const sinAdjuntoResult = await db.query(`
        SELECT COUNT(*) as count
        FROM contabilidad_factura f
        WHERE f.id_empresa = $1
          AND f.deleted_at IS NULL
          AND f.estado != 'ANULADA'
          AND NOT EXISTS (
              SELECT 1 FROM contabilidad_factura_archivo a WHERE a.id_factura = f.id
          )
    `, [empresaId]);

    return {
        summary: {
            sin_categoria: parseInt(sinCategoriaResult.rows[0].count),
            sin_adjunto: parseInt(sinAdjuntoResult.rows[0].count),
            total_issues: parseInt(sinCategoriaResult.rows[0].count) + parseInt(sinAdjuntoResult.rows[0].count)
        },
        items: [],
        metadata: {
            empresa_id: empresaId,
            query_executed_at: new Date().toISOString()
        }
    };
}

/**
 * Tool 9: Facturas impagadas
 */
async function getUnpaidInvoices(empresaId, daysOverdue = 30, tenantId) {
    if (!tenantId) throw new Error('TenantID required for getUnpaidInvoices');
    const db = getTenantDb({ tenantId });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const result = await db.query(`
        SELECT 
            f.id,
            f.numero_factura,
            f.fecha_emision,
            f.fecha_vencimiento,
            f.total,
            f.total_pagado,
            (f.total - f.total_pagado) as pendiente,
            c.nombre as contacto_nombre,
            EXTRACT(DAY FROM (CURRENT_DATE - f.fecha_vencimiento)) as dias_vencido
        FROM contabilidad_factura f
        LEFT JOIN contabilidad_contacto c ON c.id = f.id_contacto
        WHERE f.id_empresa = $1
          AND f.estado IN ('PENDIENTE', 'PARCIAL')
          AND f.fecha_vencimiento  < $2
          AND f.deleted_at IS NULL
        ORDER BY f.fecha_vencimiento ASC
        LIMIT 20
    `, [empresaId, cutoffStr]);

    return {
        summary: {
            count: result.rows.length,
            total_pendiente: result.rows.reduce((sum, r) => sum + parseFloat(r.pendiente), 0)
        },
        items: result.rows.map(row => ({
            factura_id: row.id,
            numero: row.numero_factura,
            fecha_emision: row.fecha_emision,
            fecha_vencimiento: row.fecha_vencimiento,
            total: parseFloat(row.total),
            pagado: parseFloat(row.total_pagado),
            pendiente: parseFloat(row.pendiente),
            contacto: row.contacto_nombre,
            dias_vencido: parseInt(row.dias_vencido)
        })),
        metadata: {
            empresa_id: empresaId,
            days_overdue_threshold: daysOverdue,
            query_executed_at: new Date().toISOString()
        }
    };
}

module.exports = {
    getSpendByCategory,
    getSpendByVendor,
    getTopInvoices,
    getOutliers,
    getIVASummary,
    getProfitLoss,
    searchDocuments,
    getHygieneIssues,
    getUnpaidInvoices
};
