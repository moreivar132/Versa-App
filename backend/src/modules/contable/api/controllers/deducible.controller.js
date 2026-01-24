/**
 * Deducible Controller
 * Handles deducible validation for expense invoices
 * - PATCH /facturas/:id/deducible - Update deducible status
 * - GET /facturas/export.csv - Export invoices to CSV
 */

/**
 * Update deducible status of an invoice
 * Only TENANT_ADMIN with contabilidad.deducible.approve permission can do this
 */
async function updateDeducibleStatus(req, res) {
    const { id } = req.params;
    const { deducible_status, deducible_reason } = req.body;
    const userId = req.user?.id;
    // Get tenantId from multiple sources
    const tenantId = req.user?.id_tenant || req.ctx?.tenantId;

    console.log('[updateDeducibleStatus] userId:', userId, 'tenantId:', tenantId, 'facturaId:', id);

    if (!tenantId) {
        return res.status(400).json({ error: 'Contexto de tenant no encontrado' });
    }

    // Validate input
    const validStatuses = ['pending', 'deducible', 'no_deducible'];
    if (!validStatuses.includes(deducible_status)) {
        return res.status(400).json({
            error: 'Estado inválido',
            valid_values: validStatuses
        });
    }

    try {
        await req.db.txWithRLS(async (tx) => {

            // Get current state for audit log - only check tenant, not empresa
            // TENANT_ADMIN can update any invoice in their tenant
            const currentResult = await tx.query(`
                SELECT id, id_tenant, id_empresa, deducible_status, deducible_reason, 
                       deducible_checked_by, deducible_checked_at, numero_factura, tipo
                FROM contabilidad_factura 
                WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
            `, [id, tenantId]);

            if (currentResult.rows.length === 0) {
                throw { status: 404, message: 'Factura no encontrada' };
            }

            const current = currentResult.rows[0];

            // Update deducible status
            const updateResult = await tx.query(`
                UPDATE contabilidad_factura
                SET deducible_status = $1,
                deducible_reason = $2,
                deducible_checked_by = $3,
                deducible_checked_at = NOW(),
                updated_at = NOW(),
                updated_by = $3
                WHERE id = $4 AND id_tenant = $5
                RETURNING id, numero_factura, deducible_status, deducible_reason, 
                          deducible_checked_by, deducible_checked_at
            `, [deducible_status, deducible_reason, userId, id, tenantId]);

            // Write audit log
            await tx.query(`
                INSERT INTO accounting_audit_log 
                (id_tenant, id_empresa, entity_type, entity_id, action, before_json, after_json, performed_by)
                VALUES ($1, $2, 'contabilidad_factura', $3, 'SET_DEDUCIBLE_STATUS', $4, $5, $6)
            `, [
                tenantId,
                current.id_empresa,
                id,
                JSON.stringify({
                    deducible_status: current.deducible_status,
                    deducible_reason: current.deducible_reason
                }),
                JSON.stringify({
                    deducible_status: deducible_status,
                    deducible_reason: deducible_reason
                }),
                userId
            ]);

            res.json({
                message: 'Estado de deducibilidad actualizado',
                factura: updateResult.rows[0]
            });
        });

    } catch (error) {
        console.error('[ERROR updateDeducibleStatus]:', error);
        if (error.status) {
            res.status(error.status).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al actualizar estado de deducibilidad' });
        }
    }
}

/**
 * Get audit history for a specific invoice's deducible changes
 */
async function getDeducibleHistory(req, res) {
    const { id } = req.params;
    const tenantId = req.user.id_tenant;

    try {
        const result = await req.db.query(`
            SELECT al.*, u.nombre as performed_by_nombre, u.email as performed_by_email
            FROM accounting_audit_log al
            LEFT JOIN usuario u ON al.performed_by = u.id
            WHERE al.id_tenant = $1 
              AND al.entity_type = 'contabilidad_factura'
              AND al.entity_id = $2
              AND al.action = 'SET_DEDUCIBLE_STATUS'
            ORDER BY al.performed_at DESC
            LIMIT 20
        `, [tenantId, id]);

        res.json({ history: result.rows });

    } catch (error) {
        console.error('[ERROR getDeducibleHistory]:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
}

/**
 * Export invoices to CSV
 * Query params: empresa_id, year, quarter, deducible_status, tipo
 */
async function exportCSV(req, res) {
    // Get tenantId from multiple sources
    const tenantId = req.user?.id_tenant || req.ctx?.tenantId;
    const userId = req.user?.id;

    console.log('[DeducibleCSV] Export request:', {
        query: req.query,
        tenantId,
        user: req.user?.id
    });

    if (!tenantId) {
        return res.status(400).json({ error: 'Contexto de tenant no encontrado' });
    }

    const {
        empresa_id,
        year,
        anio,
        quarter,
        trimestre,
        deducible_status,
        tipo = 'GASTO',
        estado // Payment status
    } = req.query;

    // Normalize params
    const filterYear = year || anio;
    const filterQuarter = quarter || trimestre;

    // Check if user can export multi-empresa - for now allow all authenticated users
    // The permission is already checked by the route middleware
    const canExportMulti = true; // TENANT_ADMIN already passed RBAC check

    try {
        // Build query
        let query = `
            SELECT 
                f.id,
                $1::bigint as tenant_id,
                f.id_empresa,
                COALESCE(e.nombre_legal, e.nombre_comercial) as empresa_nombre,
                c.nombre as proveedor,
                c.nif_cif,
                f.numero_factura,
                f.fecha_emision,
                f.fecha_devengo,
                f.fecha_vencimiento,
                f.base_imponible,
                f.retencion_porcentaje,
                f.retencion_importe,
                f.iva_porcentaje,
                f.iva_importe,
                f.total,
                f.notas,
                cat.nombre as categoria,
                f.estado as estado_pago,
                f.deducible_status,
                f.deducible_reason,
                f.deducible_checked_at,
                u.email as deducible_checked_by_email,
                CASE WHEN f.intake_id IS NOT NULL THEN 'IA' ELSE 'manual' END as origen,
                EXISTS(SELECT 1 FROM contabilidad_factura_archivo WHERE id_factura = f.id) as file_attached
            FROM contabilidad_factura f
            LEFT JOIN accounting_empresa e ON f.id_empresa = e.id
            LEFT JOIN contabilidad_contacto c ON f.id_contacto = c.id
            LEFT JOIN contable_category cat ON f.id_categoria = cat.id
            LEFT JOIN usuario u ON f.deducible_checked_by = u.id
            WHERE f.id_tenant = $1
              AND f.deleted_at IS NULL
              AND f.tipo = $2
        `;

        const params = [tenantId, tipo];
        let paramIndex = 3;

        // Only filter by empresa_id if it's a valid non-empty value
        const empresaIdNum = parseInt(empresa_id);
        if (empresa_id && empresa_id !== '' && !isNaN(empresaIdNum)) {
            query += ` AND f.id_empresa = $${paramIndex}`;
            params.push(empresaIdNum);
            paramIndex++;
        }

        // Only filter by year if it's a valid number
        const yearNum = parseInt(filterYear);
        if (filterYear && !isNaN(yearNum)) {
            query += ` AND EXTRACT(YEAR FROM f.fecha_devengo) = $${paramIndex}`;
            params.push(yearNum);
            paramIndex++;
        }

        // Only filter by quarter if it's a valid number
        const quarterNum = parseInt(filterQuarter);
        if (filterQuarter && !isNaN(quarterNum)) {
            query += ` AND EXTRACT(QUARTER FROM f.fecha_devengo) = $${paramIndex}`;
            params.push(quarterNum);
            paramIndex++;
        }

        if (estado && estado !== '') {
            query += ` AND f.estado = $${paramIndex}`;
            params.push(estado);
            paramIndex++;
        }

        if (deducible_status && deducible_status !== '') {
            if (deducible_status === 'pending') {
                query += ` AND (f.deducible_status = 'pending' OR f.deducible_status IS NULL)`;
            } else if (deducible_status === 'validated') {
                query += ` AND f.deducible_status IN ('deducible', 'no_deducible')`;
            } else {
                query += ` AND f.deducible_status = $${paramIndex}`;
                params.push(deducible_status);
                paramIndex++;
            }
        }

        query += ` ORDER BY f.fecha_devengo DESC, f.id DESC`;

        const result = await req.db.query(query, params);

        // Generate CSV content
        const csvSeparator = ';'; // Spain standard
        const headers = [
            'tenant_id',
            'empresa_id',
            'empresa_nombre',
            'proveedor',
            'nif_cif',
            'numero_factura',
            'fecha_emision',
            'fecha_devengo',
            'fecha_vencimiento',     // Added
            'base_imponible',
            'retencion_porcentaje',  // Added
            'retencion_importe',     // Added
            'iva_porcentaje',
            'iva_importe',
            'total',
            'categoria',
            'estado_pago',
            'deducible_status',
            'deducible_reason',
            'deducible_checked_at',
            'deducible_checked_by_email',
            'origen',
            'file_attached',
            'notas'                  // Added
        ];

        // Escape CSV field
        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(csvSeparator) || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        // Format date for CSV
        const formatDate = (date) => {
            if (!date) return '';
            return new Date(date).toISOString().split('T')[0];
        };

        let csvContent = headers.join(csvSeparator) + '\n';

        for (const row of result.rows) {
            const values = [
                row.tenant_id,
                row.id_empresa,
                escapeCSV(row.empresa_nombre),
                escapeCSV(row.proveedor),
                escapeCSV(row.nif_cif),
                escapeCSV(row.numero_factura),
                formatDate(row.fecha_emision),
                formatDate(row.fecha_devengo),
                formatDate(row.fecha_vencimiento),
                row.base_imponible,
                row.retencion_porcentaje,
                row.retencion_importe,
                row.iva_porcentaje,
                row.iva_importe,
                row.total,
                escapeCSV(row.categoria),
                escapeCSV(row.estado_pago),
                escapeCSV(row.deducible_status),
                escapeCSV(row.deducible_reason),
                row.deducible_checked_at ? new Date(row.deducible_checked_at).toISOString() : '',
                escapeCSV(row.deducible_checked_by_email),
                row.origen,
                row.file_attached ? 'true' : 'false',
                escapeCSV(row.notas)
            ];
            csvContent += values.join(csvSeparator) + '\n';
        }

        // Generate filename
        const statusSuffix = deducible_status || 'all';
        const empresaSuffix = empresa_id || 'multi';
        const quarterSuffix = quarter ? `Q${quarter}` : 'full_year';
        const yearSuffix = year || new Date().getFullYear();
        const filename = `facturas_${tipo.toLowerCase()}_${quarterSuffix}_${yearSuffix}_empresa_${empresaSuffix}_${statusSuffix}.csv`;

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Add BOM for Excel compatibility with UTF-8
        res.send('\ufeff' + csvContent);

    } catch (error) {
        console.error('[ERROR exportCSV]:', error);
        res.status(500).json({ error: 'Error al generar CSV' });
    }
}

module.exports = {
    updateDeducibleStatus,
    getDeducibleHistory,
    exportCSV
};
