/**
 * Egresos Controller (FinSaaS)
 * Gestión de facturas de gasto con OCR/IA usando OpenAI GPT-4 Vision
 * 
 * REFACTORED: Removed Make.com dependency, now uses direct OpenAI API calls
 */

const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const pool = require('../../../../../db');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// OpenAI OCR Service (direct integration)
const { analyzeInvoice } = require('../../../../../services/openaiOcrService');

// Directorio uploads
const uploadDir = path.join(__dirname, '../../../../../uploads/egresos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG, HEIC.'));
        }
    }
}).single('archivo');

function getEmpresaId(req) {
    return req.headers['x-empresa-id'] || req.query.empresaId;
}

/**
 * POST /api/contabilidad/egresos/intakes
 * Upload file and process with OpenAI GPT-4 Vision (synchronous)
 */
async function createIntake(req, res) {
    console.log('[Egresos] createIntake called');
    upload(req, res, async (err) => {
        console.log('[Egresos] Multer callback, err:', err ? err.message : 'none');
        if (err) return res.status(400).json({ ok: false, error: err.message });

        const client = await pool.connect();
        try {
            const tenantId = getEffectiveTenant(req);
            const empresaId = getEmpresaId(req);
            if (!tenantId || !empresaId) {
                return res.status(400).json({ ok: false, error: 'Tenant o Empresa no especificada' });
            }

            const userId = req.user?.id;
            const { categoria_ui, metodo_pago_hint } = req.body;
            const idempotencyKey = crypto.randomUUID();

            // File data
            let fileData = null;
            let filePath = null;
            if (req.file) {
                fileData = {
                    storage_key: req.file.filename,
                    url: `/uploads/egresos/${req.file.filename}`,
                    mime: req.file.mimetype,
                    original_name: req.file.originalname,
                    size: req.file.size
                };
                filePath = path.join(uploadDir, req.file.filename);
            }

            if (!fileData) {
                return res.status(400).json({ ok: false, error: 'No se proporcionó archivo' });
            }

            console.log(`[Egresos] Processing intake for tenant ${tenantId}, empresa ${empresaId}`);
            console.log(`[Egresos] File: ${fileData.original_name} (${fileData.mime})`);

            await client.query('BEGIN');

            // Create intake record with 'processing' status
            const intakeResult = await client.query(`
                INSERT INTO accounting_intake (
                    id_tenant, id_empresa, created_by, idempotency_key, status, source,
                    file_storage_key, file_url, file_mime, file_original_name, file_size_bytes,
                    categoria_ui, metodo_pago_hint
                ) VALUES ($1, $2, $3, $4, 'processing', 'portal', $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `, [
                tenantId, empresaId, userId, idempotencyKey,
                fileData.storage_key, fileData.url, fileData.mime, fileData.original_name, fileData.size,
                categoria_ui, metodo_pago_hint
            ]);

            const intakeId = intakeResult.rows[0].id;
            console.log(`[Egresos] Intake ${intakeId} created, starting OpenAI analysis...`);

            // Call OpenAI directly (synchronous)
            const { extracted, validation, error: ocrError } = await analyzeInvoice(filePath, fileData.mime);

            let dbStatus = 'failed';
            let gastoId = null;

            if (ocrError) {
                console.error(`[Egresos] OpenAI error for intake ${intakeId}:`, ocrError);
                await client.query(`
                    UPDATE accounting_intake 
                    SET status = 'failed', error_message = $1, updated_at = NOW()
                    WHERE id = $2
                `, [ocrError, intakeId]);
            } else if (extracted) {
                // Determine status based on validation
                if (validation?.confidence === 'high' && validation?.check_total && validation?.check_iva) {
                    dbStatus = 'ready';
                } else {
                    dbStatus = 'needs_review';
                }

                console.log(`[Egresos] OCR successful for intake ${intakeId}, status: ${dbStatus}`);

                // Update intake with extracted data
                await client.query(`
                    UPDATE accounting_intake 
                    SET status = $1, 
                        extracted_json = $2, 
                        validation_json = $3, 
                        updated_at = NOW()
                    WHERE id = $4
                `, [dbStatus, JSON.stringify(extracted), JSON.stringify(validation), intakeId]);

                // Create borrador factura
                await client.query('SAVEPOINT create_borrador');
                try {
                    const provNombre = extracted.proveedor_nombre;
                    const provNif = extracted.proveedor_nif;
                    const numFactura = extracted.numero_factura || 'BORRADOR-' + intakeId;
                    const fecha = extracted.fecha_emision || new Date().toISOString().split('T')[0];

                    const total = extracted.total || 0;
                    const baseImp = extracted.base_imponible || 0;
                    const ivaPct = extracted.iva_porcentaje || 21;
                    const ivaImp = extracted.iva_importe || (total - baseImp);

                    // Find or create contacto
                    let contactoId = null;
                    if (provNif) {
                        const cRows = await client.query(
                            `SELECT id FROM contabilidad_contacto WHERE id_tenant=$1 AND nif_cif=$2 LIMIT 1`,
                            [tenantId, provNif]
                        );
                        if (cRows.rows.length > 0) {
                            contactoId = cRows.rows[0].id;
                        }
                    }

                    if (!contactoId && provNombre) {
                        const newContact = await client.query(`
                            INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif, created_by)
                            VALUES ($1, $2, 'PROVEEDOR', $3, $4, $5)
                            RETURNING id
                        `, [tenantId, empresaId, provNombre, provNif, userId]);
                        if (newContact.rows.length > 0) {
                            contactoId = newContact.rows[0].id;
                        }
                    }

                    // Create factura
                    const facturaRes = await client.query(`
                        INSERT INTO contabilidad_factura (
                            id_tenant, id_empresa, tipo, id_contacto, numero_factura, 
                            fecha_emision, fecha_devengo, fecha_vencimiento,
                            base_imponible, iva_porcentaje, iva_importe, total,
                            estado, notas, intake_id, created_by
                        ) VALUES ($1, $2, 'GASTO', $3, $4, $5, $5, $6, $7, $8, $9, $10, 'PENDIENTE', $11, $12, $13)
                        RETURNING id
                    `, [
                        tenantId, empresaId,
                        contactoId, numFactura, fecha, extracted.fecha_vencimiento || fecha,
                        baseImp, ivaPct, ivaImp, total,
                        `Generado por OCR (Intake ${intakeId})\n${extracted.concepto || ''}`.trim(),
                        intakeId, userId
                    ]);
                    gastoId = facturaRes.rows[0].id;

                    console.log(`[Egresos] ✅ Factura borrador created with ID: ${gastoId}`);

                    // Attach file
                    await client.query(`
                        INSERT INTO contabilidad_factura_archivo (id_factura, file_url, storage_key, mime_type, size_bytes, original_name, created_by)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [gastoId, fileData.url, fileData.storage_key, fileData.mime, fileData.size, fileData.original_name, userId]);

                    await client.query('RELEASE SAVEPOINT create_borrador');
                } catch (borradorError) {
                    await client.query('ROLLBACK TO SAVEPOINT create_borrador');
                    console.error(`[Egresos] ⚠️ Error creating borrador (recovered):`, borradorError.message);
                    gastoId = null;
                }
            }

            await client.query('COMMIT');

            // Return response immediately with extracted data
            res.status(201).json({
                ok: true,
                intake_id: intakeId,
                status: dbStatus,
                gasto_id: gastoId,
                extracted: extracted,
                validation: validation
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[Egresos] Error en createIntake:', error);
            res.status(500).json({ ok: false, error: error.message });
        } finally {
            client.release();
        }
    });
}

/**
 * GET /api/contabilidad/egresos/intakes/:id
 * Get intake status and data
 */
async function getIntake(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const intakeId = parseInt(req.params.id);

        console.log('[getIntake] Request for intake:', intakeId, 'tenant:', tenantId);

        const result = await pool.query(`SELECT * FROM accounting_intake WHERE id = $1 AND id_tenant = $2`, [intakeId, tenantId]);

        if (result.rows.length === 0) {
            console.log('[getIntake] Not found:', intakeId);
            return res.status(404).json({ ok: false, error: 'Not found' });
        }

        const intake = result.rows[0];
        console.log('[getIntake] Found intake with status:', intake.status);

        // Find associated gasto/borrador
        let gastoId = null;
        if (intake.status !== 'processing') {
            const draft = await pool.query(
                `SELECT id FROM contabilidad_factura WHERE intake_id = $1 AND id_tenant = $2 LIMIT 1`,
                [intake.id, tenantId]
            );
            if (draft.rows.length > 0) gastoId = draft.rows[0].id;
        }

        const response = {
            ok: true,
            data: {
                id: intake.id,
                status: intake.status,
                extracted: intake.extracted_json,
                validation: intake.validation_json,
                file_url: intake.file_url,
                gasto_id: gastoId,
                error_message: intake.error_message
            }
        };

        res.json(response);
    } catch (error) {
        console.error('[getIntake] Error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/egresos
 * Create or update gasto from confirmed data
 */
async function createGasto(req, res) {
    const client = await pool.connect();
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const userId = req.user?.id;
        const {
            intake_id, proveedor_nombre, proveedor_nif, proveedor_id,
            numero_factura, fecha_emision, fecha_vencimiento,
            base_imponible, iva_porcentaje, iva_importe, total,
            categoria, concepto, estado = 'PENDIENTE', gasto_id
        } = req.body;

        if (!empresaId) return res.status(400).json({ ok: false, error: 'Empresa no especificada' });

        // Normalize estado to uppercase and validate
        const allowedEstados = ['PENDIENTE', 'PAGADA', 'PARCIAL', 'ANULADA'];
        let normalizedEstado = (estado || 'PENDIENTE').toUpperCase();
        if (!allowedEstados.includes(normalizedEstado)) {
            normalizedEstado = 'PENDIENTE';
        }

        await client.query('BEGIN');

        // Find or create contacto
        let contactoId = proveedor_id;
        if (!contactoId && proveedor_nombre) {
            if (proveedor_nif) {
                const provCheck = await client.query(
                    'SELECT id FROM contabilidad_contacto WHERE id_tenant=$1 AND nif_cif=$2 LIMIT 1',
                    [tenantId, proveedor_nif]
                );
                if (provCheck.rows.length > 0) {
                    contactoId = provCheck.rows[0].id;
                }
            }

            if (!contactoId) {
                const newC = await client.query(`
                    INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif, created_by)
                    VALUES ($1, $2, 'PROVEEDOR', $3, $4, $5) RETURNING id
                `, [tenantId, empresaId, proveedor_nombre, proveedor_nif, userId]);
                contactoId = newC.rows[0].id;
            }
        }

        let finalId = gasto_id;
        const calcIvaImporte = iva_importe || (total - base_imponible);

        if (finalId) {
            // Update existing
            await client.query(`
                UPDATE contabilidad_factura SET
                    id_contacto=$1, id_empresa=$2, numero_factura=$3, 
                    fecha_emision=$4, fecha_devengo=$4, fecha_vencimiento=$5,
                    base_imponible=$6, iva_porcentaje=$7, iva_importe=$8, total=$9,
                    notas=$10, estado=$11, updated_at=NOW(), updated_by=$12
                WHERE id=$13 AND id_tenant=$14
            `, [
                contactoId, empresaId, numero_factura,
                fecha_emision, fecha_vencimiento || fecha_emision,
                base_imponible || 0, iva_porcentaje || 0, calcIvaImporte, total || 0,
                concepto, normalizedEstado, userId, finalId, tenantId
            ]);
        } else {
            // CHECK DUPLICATES: Prevent creating if exists same provider + number + empresa (and it's not a draft update)
            const dupCheck = await client.query(`
                SELECT id FROM contabilidad_factura 
                WHERE id_tenant=$1 AND id_empresa=$2 AND id_contacto=$3 AND numero_factura=$4 AND tipo='GASTO'
                LIMIT 1
            `, [tenantId, empresaId, contactoId, numero_factura]);

            if (dupCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    ok: false,
                    error: `Ya existe la factura ${numero_factura} para este proveedor.`
                });
            }

            // Create new
            const ins = await client.query(`
                INSERT INTO contabilidad_factura (
                    id_tenant, id_empresa, tipo, id_contacto, numero_factura,
                    fecha_emision, fecha_devengo, fecha_vencimiento,
                    base_imponible, iva_porcentaje, iva_importe, total,
                    estado, notas, intake_id, created_by
                ) VALUES ($1, $2, 'GASTO', $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
            `, [
                tenantId, empresaId, contactoId, numero_factura,
                fecha_emision || new Date(), fecha_vencimiento,
                base_imponible || 0, iva_porcentaje || 0, calcIvaImporte, total || 0,
                normalizedEstado, concepto, intake_id, userId
            ]);
            finalId = ins.rows[0].id;
        }

        await client.query('COMMIT');
        res.status(201).json({ ok: true, data: { id: finalId } });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Egresos] Create gasto error:', error);
        res.status(500).json({ ok: false, error: error.message });
    } finally {
        client.release();
    }
}

/**
 * GET /api/contabilidad/egresos
 * List gastos
 */
async function listGastos(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const { estado, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT g.*, c.nombre as contacto_nombre 
            FROM contabilidad_factura g 
            LEFT JOIN contabilidad_contacto c ON g.id_contacto = c.id 
            WHERE g.id_tenant = $1 AND g.tipo = 'GASTO' AND g.deleted_at IS NULL
        `;
        const params = [tenantId];
        let pIdx = 2;

        if (empresaId) {
            query += ` AND g.id_empresa = $${pIdx++}`;
            params.push(empresaId);
        }
        if (estado) {
            query += ` AND g.estado = $${pIdx++}`;
            params.push(estado);
        }

        query += ` ORDER BY g.fecha_emision DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Count total
        let countQuery = `SELECT COUNT(*) FROM contabilidad_factura WHERE id_tenant = $1 AND tipo='GASTO' AND deleted_at IS NULL`;
        const countParams = [tenantId];
        if (empresaId) {
            countQuery += ' AND id_empresa=$2';
            countParams.push(empresaId);
        }
        const countRes = await pool.query(countQuery, countParams);

        res.json({
            ok: true,
            data: {
                items: result.rows,
                total: parseInt(countRes.rows[0].count)
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    createIntake,
    getIntake,
    createGasto,
    listGastos
};
