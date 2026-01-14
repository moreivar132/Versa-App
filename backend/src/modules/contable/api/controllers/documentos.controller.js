/**
 * Documentos Controller (Biblioteca de Facturas)
 * Unified listing of all invoice documents with attachments
 * Organized by quarter with filtering capabilities
 * 
 * INCLUDES: Facturas + Orphan Intakes (IA uploads without linked factura)
 */

const pool = require('../../../../../db');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const path = require('path');
const fs = require('fs');

function getEmpresaId(req) {
    return req.headers['x-empresa-id'] || req.query.empresaId;
}

/**
 * GET /api/contabilidad/documentos
 * List all documents (invoices + orphan intakes) filtered by quarter
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const {
            year = new Date().getFullYear(),
            quarter,
            tipo,           // GASTO | INGRESO
            origen,         // ia | manual
            estado,         // PENDIENTE | PAGADA | PARCIAL | VENCIDA
            contactoId,
            categoriaId,
            search,
            hasAttachment,  // true | false | undefined (all)
            limit = 50,
            offset = 0
        } = req.query;

        // Query 1: Get facturas
        let facturasQuery = `
            SELECT 
                f.id,
                'factura' as source_type,
                f.id_empresa::text as id_empresa,
                f.tipo,
                f.numero_factura,
                f.fecha_emision,
                COALESCE(f.fecha_devengo, f.fecha_emision) as fecha_devengo,
                f.total,
                f.estado,
                f.intake_id,
                f.created_at,
                c.id as contacto_id,
                c.nombre as contacto_nombre,
                c.nif_cif as contacto_nif,
                cat.nombre as categoria_nombre,
                e.nombre_legal as empresa_nombre,
                a.id as archivo_id,
                a.file_url as archivo_file_url,
                a.storage_key as archivo_storage_key,
                a.mime_type as archivo_mime_type,
                a.original_name as archivo_original_name,
                a.size_bytes as archivo_size_bytes,
                i.file_url as intake_file_url,
                i.file_storage_key as intake_storage_key,
                i.file_mime as intake_mime,
                i.file_original_name as intake_original_name,
                i.file_size_bytes as intake_size_bytes,
                i.status as intake_status,
                CASE WHEN f.intake_id IS NOT NULL THEN 'IA' ELSE 'MANUAL' END as origen,
                CASE 
                    WHEN a.id IS NOT NULL THEN true 
                    WHEN i.file_url IS NOT NULL THEN true 
                    ELSE false 
                END as has_attachment
            FROM contabilidad_factura f
            LEFT JOIN contabilidad_contacto c ON f.id_contacto = c.id
            LEFT JOIN contable_category cat ON f.id_categoria = cat.id
            LEFT JOIN accounting_empresa e ON f.id_empresa::text = e.id::text
            LEFT JOIN LATERAL (
                SELECT * FROM contabilidad_factura_archivo 
                WHERE id_factura = f.id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) a ON true
            LEFT JOIN accounting_intake i ON f.intake_id = i.id
            WHERE f.id_tenant = $1 AND f.deleted_at IS NULL
        `;
        const facturasParams = [tenantId];
        let paramIdx = 2;

        if (empresaId) {
            facturasQuery += ` AND f.id_empresa::text = $${paramIdx++}`;
            facturasParams.push(empresaId.toString());
        }
        if (year) {
            facturasQuery += ` AND EXTRACT(YEAR FROM COALESCE(f.fecha_devengo, f.fecha_emision)) = $${paramIdx++}`;
            facturasParams.push(parseInt(year));
        }
        if (quarter) {
            facturasQuery += ` AND EXTRACT(QUARTER FROM COALESCE(f.fecha_devengo, f.fecha_emision)) = $${paramIdx++}`;
            facturasParams.push(parseInt(quarter));
        }
        if (tipo) {
            facturasQuery += ` AND f.tipo = $${paramIdx++}`;
            facturasParams.push(tipo.toUpperCase());
        }
        if (origen === 'ia') {
            facturasQuery += ` AND f.intake_id IS NOT NULL`;
        } else if (origen === 'manual') {
            facturasQuery += ` AND f.intake_id IS NULL`;
        }
        if (estado) {
            facturasQuery += ` AND f.estado = $${paramIdx++}`;
            facturasParams.push(estado.toUpperCase());
        }
        if (search) {
            facturasQuery += ` AND (f.numero_factura ILIKE $${paramIdx} OR c.nombre ILIKE $${paramIdx} OR c.nif_cif ILIKE $${paramIdx})`;
            facturasParams.push(`%${search}%`);
            paramIdx++;
        }

        facturasQuery += ` ORDER BY f.fecha_devengo DESC NULLS LAST, f.created_at DESC`;

        // Query 2: Get orphan intakes (only if not filtering manual only)
        let orphanIntakes = [];
        if (origen !== 'manual') {
            let intakesQuery = `
                SELECT 
                    i.id,
                    'intake' as source_type,
                    i.id_empresa::text as id_empresa,
                    'GASTO' as tipo,
                    COALESCE(i.extracted_json->>'numero_factura', 'INTAKE-' || i.id) as numero_factura,
                    COALESCE((i.extracted_json->>'fecha_emision')::date, i.created_at::date) as fecha_emision,
                    COALESCE((i.extracted_json->>'fecha_emision')::date, i.created_at::date) as fecha_devengo,
                    COALESCE((i.extracted_json->>'total')::numeric, 0) as total,
                    CASE 
                        WHEN i.status = 'ready' THEN 'PENDIENTE'
                        WHEN i.status = 'needs_review' THEN 'BORRADOR'
                        WHEN i.status = 'processing' THEN 'PROCESANDO'
                        ELSE 'ERROR'
                    END as estado,
                    i.id as intake_id,
                    i.created_at,
                    NULL::bigint as contacto_id,
                    i.extracted_json->>'proveedor_nombre' as contacto_nombre,
                    i.extracted_json->>'proveedor_nif' as contacto_nif,
                    i.categoria_ui as categoria_nombre,
                    e.nombre_legal as empresa_nombre,
                    NULL::bigint as archivo_id,
                    NULL::text as archivo_file_url,
                    NULL::text as archivo_storage_key,
                    NULL::text as archivo_mime_type,
                    NULL::text as archivo_original_name,
                    NULL::integer as archivo_size_bytes,
                    i.file_url as intake_file_url,
                    i.file_storage_key as intake_storage_key,
                    i.file_mime as intake_mime,
                    i.file_original_name as intake_original_name,
                    i.file_size_bytes as intake_size_bytes,
                    i.status as intake_status,
                    'IA' as origen,
                    CASE WHEN i.file_url IS NOT NULL THEN true ELSE false END as has_attachment
                FROM accounting_intake i
                LEFT JOIN accounting_empresa e ON i.id_empresa::text = e.id::text
                WHERE i.id_tenant = $1 
                  AND i.file_url IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM contabilidad_factura f 
                      WHERE f.intake_id = i.id AND f.deleted_at IS NULL
                  )
            `;
            const intakesParams = [tenantId];
            let intakeParamIdx = 2;

            if (empresaId) {
                intakesQuery += ` AND i.id_empresa::text = $${intakeParamIdx++}`;
                intakesParams.push(empresaId.toString());
            }
            if (year) {
                intakesQuery += ` AND EXTRACT(YEAR FROM COALESCE((i.extracted_json->>'fecha_emision')::date, i.created_at::date)) = $${intakeParamIdx++}`;
                intakesParams.push(parseInt(year));
            }
            if (quarter) {
                intakesQuery += ` AND EXTRACT(QUARTER FROM COALESCE((i.extracted_json->>'fecha_emision')::date, i.created_at::date)) = $${intakeParamIdx++}`;
                intakesParams.push(parseInt(quarter));
            }
            // tipo filter - intakes are always GASTO, so skip if filtering for INGRESO
            if (tipo && tipo.toUpperCase() === 'INGRESO') {
                // Skip intakes query entirely for INGRESO filter
            } else {
                intakesQuery += ` ORDER BY i.created_at DESC`;

                try {
                    const intakesResult = await pool.query(intakesQuery, intakesParams);
                    orphanIntakes = intakesResult.rows;
                } catch (intakeError) {
                    console.warn('[Documentos] Warning: Could not fetch orphan intakes:', intakeError.message);
                    // Continue without intakes
                }
            }
        }

        // Execute facturas query
        const facturasResult = await pool.query(facturasQuery, facturasParams);

        // Combine results in JavaScript
        let allItems = [...facturasResult.rows, ...orphanIntakes];

        // Apply hasAttachment filter
        if (hasAttachment === 'true') {
            allItems = allItems.filter(item => item.has_attachment);
        } else if (hasAttachment === 'false') {
            allItems = allItems.filter(item => !item.has_attachment);
        }

        // Sort by fecha_devengo DESC
        allItems.sort((a, b) => {
            const dateA = new Date(a.fecha_devengo || a.created_at);
            const dateB = new Date(b.fecha_devengo || b.created_at);
            return dateB - dateA;
        });

        const total = allItems.length;

        // Apply pagination
        const paginatedItems = allItems.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        // Calculate stats
        const stats = {
            total_docs: allItems.length,
            total_gastos: allItems.filter(i => i.tipo === 'GASTO').length,
            total_ingresos: allItems.filter(i => i.tipo === 'INGRESO').length,
            total_ia: allItems.filter(i => i.origen === 'IA').length,
            total_manual: allItems.filter(i => i.origen === 'MANUAL').length,
            con_adjunto: allItems.filter(i => i.has_attachment).length,
            sin_adjunto: allItems.filter(i => !i.has_attachment).length
        };

        // Transform results
        const items = paginatedItems.map(row => {
            let fileUrl = row.archivo_file_url || row.intake_file_url;
            let mimeType = row.archivo_mime_type || row.intake_mime;
            let originalName = row.archivo_original_name || row.intake_original_name;
            let storageKey = row.archivo_storage_key || row.intake_storage_key;
            let sizeBytes = row.archivo_size_bytes || row.intake_size_bytes;

            let fileType = null;
            if (mimeType) {
                if (mimeType.includes('pdf')) fileType = 'PDF';
                else if (mimeType.includes('image')) fileType = 'IMG';
                else fileType = 'OTHER';
            }

            const isIntake = row.source_type === 'intake';
            const docId = isIntake ? row.intake_id : row.id;

            return {
                id: isIntake ? -row.id : row.id,
                source_type: row.source_type,
                intake_id: row.intake_id,
                id_empresa: row.id_empresa,
                empresa_nombre: row.empresa_nombre,
                tipo: row.tipo,
                origen: row.origen,
                numero_factura: row.numero_factura,
                fecha_emision: row.fecha_emision,
                fecha_devengo: row.fecha_devengo,
                total: parseFloat(row.total) || 0,
                estado: row.estado,
                intake_status: row.intake_status,
                trimestre: row.fecha_devengo ? Math.ceil((new Date(row.fecha_devengo).getMonth() + 1) / 3) : null,
                anio: row.fecha_devengo ? new Date(row.fecha_devengo).getFullYear() : null,
                contacto: row.contacto_nombre ? {
                    id: row.contacto_id,
                    nombre: row.contacto_nombre,
                    nif: row.contacto_nif
                } : null,
                categoria: row.categoria_nombre,
                has_attachment: row.has_attachment,
                archivo: row.has_attachment ? {
                    id: row.archivo_id,
                    file_url: fileUrl,
                    storage_key: storageKey,
                    mime_type: mimeType,
                    original_name: originalName,
                    size_bytes: sizeBytes,
                    file_type: fileType,
                    preview_url: isIntake
                        ? `/api/contabilidad/documentos/intake/${row.intake_id}/archivo?preview=true`
                        : `/api/contabilidad/documentos/${row.id}/archivo?preview=true`,
                    download_url: isIntake
                        ? `/api/contabilidad/documentos/intake/${row.intake_id}/archivo`
                        : `/api/contabilidad/documentos/${row.id}/archivo`
                } : null
            };
        });

        res.json({
            ok: true,
            data: {
                items,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                stats
            }
        });

    } catch (error) {
        console.error('[Documentos] Error listing documents:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/documentos/:facturaId/archivo
 * Serve document attachment with authentication (for facturas)
 */
async function serveArchivo(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const facturaId = parseInt(req.params.facturaId);
        const isPreview = req.query.preview === 'true';

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const facturaCheck = await pool.query(`
            SELECT f.id, f.id_empresa, f.intake_id
            FROM contabilidad_factura f
            WHERE f.id = $1 AND f.id_tenant = $2 AND f.deleted_at IS NULL
        `, [facturaId, tenantId]);

        if (facturaCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Factura no encontrada' });
        }

        const factura = facturaCheck.rows[0];

        if (empresaId && factura.id_empresa?.toString() !== empresaId.toString()) {
            return res.status(403).json({ ok: false, error: 'Acceso denegado a esta empresa' });
        }

        let fileInfo = await pool.query(`
            SELECT file_url, storage_key, mime_type, original_name
            FROM contabilidad_factura_archivo
            WHERE id_factura = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [facturaId]);

        let fileUrl, storageKey, mimeType, originalName;

        if (fileInfo.rows.length > 0) {
            fileUrl = fileInfo.rows[0].file_url;
            storageKey = fileInfo.rows[0].storage_key;
            mimeType = fileInfo.rows[0].mime_type;
            originalName = fileInfo.rows[0].original_name;
        } else if (factura.intake_id) {
            const intakeInfo = await pool.query(`
                SELECT file_url, file_storage_key, file_mime, file_original_name
                FROM accounting_intake
                WHERE id = $1
            `, [factura.intake_id]);

            if (intakeInfo.rows.length > 0) {
                fileUrl = intakeInfo.rows[0].file_url;
                storageKey = intakeInfo.rows[0].file_storage_key;
                mimeType = intakeInfo.rows[0].file_mime;
                originalName = intakeInfo.rows[0].file_original_name;
            }
        }

        if (!fileUrl && !storageKey) {
            return res.status(404).json({ ok: false, error: 'Sin archivo adjunto' });
        }

        return serveFileFromStorage(res, fileUrl, storageKey, mimeType, originalName, isPreview);

    } catch (error) {
        console.error('[Documentos] Error serving archivo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/documentos/intake/:intakeId/archivo
 * Serve document attachment from intake (orphan intakes)
 */
async function serveIntakeArchivo(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const intakeId = parseInt(req.params.intakeId);
        const isPreview = req.query.preview === 'true';

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const intakeCheck = await pool.query(`
            SELECT id, id_empresa, file_url, file_storage_key, file_mime, file_original_name
            FROM accounting_intake
            WHERE id = $1 AND id_tenant = $2
        `, [intakeId, tenantId]);

        if (intakeCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Intake no encontrado' });
        }

        const intake = intakeCheck.rows[0];

        if (empresaId && intake.id_empresa?.toString() !== empresaId.toString()) {
            return res.status(403).json({ ok: false, error: 'Acceso denegado a esta empresa' });
        }

        if (!intake.file_url && !intake.file_storage_key) {
            return res.status(404).json({ ok: false, error: 'Sin archivo adjunto' });
        }

        return serveFileFromStorage(
            res,
            intake.file_url,
            intake.file_storage_key,
            intake.file_mime,
            intake.file_original_name,
            isPreview
        );

    } catch (error) {
        console.error('[Documentos] Error serving intake archivo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * Helper function to serve file from storage
 */
function serveFileFromStorage(res, fileUrl, storageKey, mimeType, originalName, isPreview) {
    let filePath;
    if (storageKey) {
        const egresosPath = path.join(__dirname, '../../../../../uploads/egresos', storageKey);
        const contabPath = path.join(__dirname, '../../../../../uploads/contabilidad', storageKey);

        if (fs.existsSync(egresosPath)) {
            filePath = egresosPath;
        } else if (fs.existsSync(contabPath)) {
            filePath = contabPath;
        }
    }

    if (!filePath && fileUrl) {
        const urlPath = fileUrl.replace(/^\/api\/uploads\//, '').replace(/^\/uploads\//, '');
        filePath = path.join(__dirname, '../../../../../uploads', urlPath);
    }

    if (!filePath || !fs.existsSync(filePath)) {
        console.warn('[Documentos] File NOT found on disk:', filePath, 'URL:', fileUrl);
        if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
            return res.redirect(fileUrl);
        }
        return res.status(404).json({ ok: false, error: 'Archivo no encontrado en servidor' });
    }

    console.log('[Documentos] Serving file:', filePath, 'MIME:', mimeType, 'Preview:', isPreview);

    if (isPreview) {
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
    } else {
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${originalName || 'archivo'}"`);
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
}

module.exports = {
    list,
    serveArchivo,
    serveIntakeArchivo
};
