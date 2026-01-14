/**
 * Egresos Controller (FinSaaS)
 * Gestión de facturas de gasto con OCR/IA
 */

const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const pool = require('../../../../../db');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Configuración
const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/36rl75e3n7tk51rake23huc18s4uw7eo';
const WEBHOOK_SECRET = process.env.MAKE_WEBHOOK_SECRET || 'versa-finsaas-secret-2026';
const CALLBACK_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

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

function generateSignature(payload) {
    return crypto.createHmac('sha256', WEBHOOK_SECRET)
        .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
        .digest('hex');
}

/**
 * POST /api/finsaas/egresos/intakes
 */
async function createIntake(req, res) {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ ok: false, error: err.message });

        try {
            const tenantId = getEffectiveTenant(req);
            const empresaId = getEmpresaId(req);
            if (!tenantId || !empresaId) {
                return res.status(400).json({ ok: false, error: 'Tenant o Empresa no especificada' });
            }

            const userId = req.user?.id;
            const { categoria_ui, metodo_pago_hint, contiene_factura } = req.body;
            const idempotencyKey = crypto.randomUUID();

            let fileData = null;
            if (req.file) {
                fileData = {
                    storage_key: req.file.filename,
                    url: `/uploads/egresos/${req.file.filename}`,
                    mime: req.file.mimetype,
                    original_name: req.file.originalname,
                    size: req.file.size
                };
            }

            const intakeResult = await pool.query(`
                INSERT INTO accounting_intake (
                    id_tenant, id_empresa, created_by, idempotency_key, status, source,
                    file_storage_key, file_url, file_mime, file_original_name, file_size_bytes,
                    categoria_ui, metodo_pago_hint
                ) VALUES ($1, $2, $3, $4, 'processing', 'portal', $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `, [
                tenantId, empresaId, userId, idempotencyKey,
                fileData?.storage_key, fileData?.url, fileData?.mime, fileData?.original_name, fileData?.size,
                categoria_ui, metodo_pago_hint
            ]);

            const intakeId = intakeResult.rows[0].id;

            // Fetch empresa data for manifest
            let empresaData = null;
            if (empresaId) {
                const empresaRes = await pool.query(`
                    SELECT id, nombre_legal, nombre_comercial, nif_cif, email, telefono, 
                           direccion, codigo_postal, ciudad, provincia, pais
                    FROM accounting_empresa 
                    WHERE id = $1 AND id_tenant = $2
                `, [empresaId, tenantId]);

                if (empresaRes.rows.length > 0) {
                    empresaData = empresaRes.rows[0];
                }
            }

            // Fetch user email
            let userEmail = '';
            if (userId) {
                const userRes = await pool.query(`SELECT email FROM usuario WHERE id = $1`, [userId]);
                if (userRes.rows.length > 0) {
                    userEmail = userRes.rows[0].email;
                }
            }

            const manifest = {
                schema_version: '1.0',
                tenant_id: tenantId,
                empresa_id: empresaId,
                empresa_name: empresaData?.nombre_comercial || empresaData?.nombre_legal || 'Sin nombre',
                empresa_email: empresaData?.email || '',
                empresa_nif: empresaData?.nif_cif || '',
                user_id: userId,
                user_email: userEmail,
                intake_id: `ink_${intakeId}`,
                idempotency_key: idempotencyKey,
                source: 'portal',
                callback_url: `${CALLBACK_BASE_URL}/api/contabilidad/intakes/${intakeId}/ocr-result`,
                empresa: empresaData ? {
                    nombre_legal: empresaData.nombre_legal,
                    nombre_comercial: empresaData.nombre_comercial,
                    nif: empresaData.nif_cif,
                    email: empresaData.email,
                    telefono: empresaData.telefono,
                    direccion: empresaData.direccion,
                    codigo_postal: empresaData.codigo_postal,
                    ciudad: empresaData.ciudad,
                    provincia: empresaData.provincia,
                    pais: empresaData.pais
                } : null,
                document: {
                    tipo: 'gasto',
                    moneda: 'EUR',
                    categoria_ui: categoria_ui || 'otros',
                    contiene_factura: contiene_factura !== 'false'
                },
                file_meta: fileData ? { filename: fileData.original_name, mime: fileData.mime } : null
            };

            sendToMake(intakeId, manifest, fileData).catch(err => {
                console.error('[Egresos] Error enviando a Make:', err);
                pool.query(`UPDATE accounting_intake SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message, intakeId]);
            });

            console.log(`[Egresos] Intake ${intakeId} creado. Empresa:`, empresaData?.nombre_legal || 'N/A');
            console.log(`[Egresos] User email:`, userEmail);
            console.log(`[Egresos] Callback: ${manifest.callback_url}`);

            res.status(201).json({ ok: true, intake_id: intakeId, status: 'processing' });

        } catch (error) {
            console.error('[Egresos] Error en createIntake:', error);
            res.status(500).json({ ok: false, error: error.message });
        }
    });
}

async function sendToMake(intakeId, manifest, fileData) {
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    if (fileData && fileData.storage_key) {
        const filePath = path.join(uploadDir, fileData.storage_key);
        if (fs.existsSync(filePath)) {
            formData.append('file', fs.createReadStream(filePath), {
                filename: fileData.original_name,
                contentType: fileData.mime
            });
        }
    }

    const signature = generateSignature(JSON.stringify(manifest));
    await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'X-Versa-Signature': signature,
            ...formData.getHeaders()
        },
        body: formData
    });
}

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

        let gastoId = null;
        if (intake.status !== 'processing') {
            const draft = await pool.query(
                `SELECT id FROM contabilidad_factura WHERE (intake_id = $1 OR notas LIKE $2) AND id_tenant = $3 LIMIT 1`,
                [intake.id, `%Intake ${intake.id})%`, tenantId]
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
                gasto_id: gastoId
            }
        };

        console.log('[getIntake] Returning:', JSON.stringify(response).substring(0, 200));
        res.json(response);
    } catch (error) {
        console.error('[getIntake] Error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/finsaas/intakes/:id/ocr-result
 * Callback de Make - Resiliente a status vacío
 */
async function ocrResultCallback(req, res) {
    const client = await pool.connect();
    try {
        const intakeId = parseInt(req.params.id);
        let { status, extracted, validation, trace_id, error_code, error_message, file_url } = req.body;

        console.log('[OCR Callback] Received for intake:', intakeId);
        console.log('[OCR Callback] Raw status:', status);
        console.log('[OCR Callback] Extracted:', extracted ? 'YES' : 'NO');

        // ===================================================================
        // ROBUST DATA PARSING - Fix datos de Make.com
        // ===================================================================

        if (extracted) {
            // 1. Parsear LINEAS (puede venir como string JSON sucio o array)
            if (extracted.lineas) {
                if (typeof extracted.lineas === 'string') {
                    try {
                        console.log('[OCR] Parsing lineas from string:', extracted.lineas.substring(0, 100));
                        // Intentar limpiar saltos de línea y formatear correctamente
                        // Caso común: "{...}, {...}" sin corchetes
                        let cleaned = extracted.lineas.trim();

                        // Si empieza con { y no con [, asumimos que es una lista de objetos separados por comas
                        if (cleaned.startsWith('{') && !cleaned.startsWith('[')) {
                            cleaned = `[${cleaned}]`;
                        }

                        // Reemplazar saltos de línea internos que rompen JSON
                        cleaned = cleaned.replace(/\n/g, ' ').replace(/\r/g, '');

                        extracted.lineas = JSON.parse(cleaned);
                        console.log('[OCR] Lineas parsed successfully:', extracted.lineas.length, 'items');
                    } catch (e) {
                        console.error('[OCR] Error parsing lineas, trying aggressive regex fix:', e.message);
                        // Intento desesperado: usar regex para extraer objetos
                        try {
                            const matches = extracted.lineas.match(/\{.*?\}/g);
                            if (matches) {
                                extracted.lineas = matches.map(m => JSON.parse(m));
                                console.log('[OCR] Regex recovery success:', extracted.lineas.length, 'items');
                            } else {
                                extracted.lineas = [];
                            }
                        } catch (e2) {
                            console.error('[OCR] Regex recovery failed:', e2.message);
                            extracted.lineas = [];
                        }
                    }
                } else if (!Array.isArray(extracted.lineas)) {
                    // Si es un objeto único, convertirlo en array
                    if (typeof extracted.lineas === 'object') {
                        console.warn('[OCR] Lineas was object, converting to array');
                        extracted.lineas = [extracted.lineas];
                    } else {
                        console.warn('[OCR] Lineas invalid type, resetting');
                        extracted.lineas = [];
                    }
                }
            }

            // 2. Convertir números que vienen como strings
            const parseNum = (val) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    // Manejar formato "1.000,50" -> "1000.50" (Europeo) vs "1,000.50" (US) se vuelve complejo
                    // Asumimos formato estándar de programación "1000.50" si es posible, o limpiamos todo menos dígitos y punto
                    // Limpieza simple: reemplazar coma por punto si hay solo una coma y está al final (decimal)
                    let cleaned = val.trim();
                    if (cleaned.indexOf(',') > -1 && cleaned.indexOf('.') === -1) {
                        // Solo comas (formato "10,50")
                        cleaned = cleaned.replace(',', '.');
                    } else {
                        // Mezcla o formato US "1,000.00" -> quitar comas
                        cleaned = cleaned.replace(/,/g, '');
                    }
                    const parsed = parseFloat(cleaned);
                    return isNaN(parsed) ? 0 : parsed;
                }
                return 0;
            };

            ['total', 'base_imponible', 'iva_porcentaje', 'iva_importe'].forEach(field => {
                if (extracted[field] !== undefined) {
                    extracted[field] = parseNum(extracted[field]);
                }
            });

            if (validation) {
                ['total_esperado', 'iva_calculado'].forEach(field => {
                    if (validation[field] !== undefined) {
                        validation[field] = parseNum(validation[field]);
                    }
                });

                // Convertir booleans que vienen como strings
                if (typeof validation.check_total === 'string') {
                    validation.check_total = validation.check_total.toLowerCase() === 'true';
                }
                if (typeof validation.check_iva === 'string') {
                    validation.check_iva = validation.check_iva.toLowerCase() === 'true';
                }
            }
        }

        // 3. Determinar STATUS si viene vacío
        if (!status || status.trim() === '') {
            if (extracted) {
                // Si tiene validation checks, usarlos para determinar status
                if (validation?.check_total && validation?.check_iva) {
                    status = 'extracted';
                } else {
                    status = 'needs_review';
                }
                console.log('[OCR] Status was empty, auto-determined:', status);
            } else {
                status = 'failed';
            }
        }

        console.log('[OCR] Final status:', status);
        console.log('[OCR] Final extracted:', JSON.stringify(extracted).substring(0, 200));

        await client.query('BEGIN');

        const intakeCheck = await client.query(`SELECT * FROM accounting_intake WHERE id = $1 FOR UPDATE`, [intakeId]);
        if (intakeCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, error: 'Intake no encontrado' });
        }
        const intake = intakeCheck.rows[0];

        // Determinar dbStatus basado en el status ya parseado
        let dbStatus = 'processing';
        if (extracted) {
            // Mapear status de Make a nuestros estados internos
            if (status === 'extracted') {
                dbStatus = 'ready';  // OCR exitoso, datos validados
            } else if (status === 'needs_review') {
                dbStatus = 'needs_review';  // OCR completado pero necesita revisión
            } else if (status === 'failed') {
                dbStatus = 'failed';
            } else {
                // Fallback: usar validation para determinar
                dbStatus = (validation?.check_total && validation?.check_iva) ? 'ready' : 'needs_review';
            }
        } else {
            dbStatus = 'failed';  // Sin extracted data = failed
        }

        console.log('[OCR] Final dbStatus for DB:', dbStatus);

        let gastoId = null;

        // Crear borrador automático si es exitoso
        if ((dbStatus === 'ready' || dbStatus === 'needs_review') && extracted) {
            // Use SAVEPOINT to isolate borrador creation errors
            await client.query('SAVEPOINT borrador_creation');
            try {
                const provNombre = extracted.proveedor_nombre || extracted.proveedor || extracted.supplier_name;
                const provNif = extracted.proveedor_nif || extracted.cif_nif || extracted.supplier_nif;
                const numFactura = extracted.numero_factura || extracted.invoice_number || 'BORRADOR-' + intake.id;

                // Fecha: intentar parsear
                let fecha = new Date();
                if (extracted.fecha_emision || extracted.date) {
                    const d = new Date(extracted.fecha_emision || extracted.date);
                    if (!isNaN(d.getTime())) fecha = d;
                }

                const parseNum = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
                    return 0;
                };

                const total = parseNum(extracted.total);
                const baseImp = parseNum(extracted.base_imponible);
                const ivaPct = parseNum(extracted.iva_porcentaje || 21);
                const ivaImp = parseNum(extracted.iva_importe || (total - baseImp));

                let contactoId = null;
                // Intentar buscar contacto por NIF
                if (provNif) {
                    // Buscar incluyendo contactos borrados, o activos
                    const cRows = await client.query(`SELECT id FROM contabilidad_contacto WHERE id_tenant=$1 AND nif_cif=$2 LIMIT 1`, [intake.id_tenant, provNif]);
                    if (cRows.rows.length > 0) contactoId = cRows.rows[0].id;
                }

                if (!contactoId && provNombre) {
                    // Crear nuevo contacto si no existe existe
                    // TODO: Mejorar búsqueda por nombre similar
                    const newContact = await client.query(`
                        INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif, created_by)
                        VALUES ($1, $2, 'PROVEEDOR', $3, $4, $5)
                        RETURNING id
                    `, [intake.id_tenant, intake.id_empresa, provNombre, provNif, intake.created_by]);
                    if (newContact.rows.length > 0) contactoId = newContact.rows[0].id;
                }

                console.log('[OCR] Creating factura with:', {
                    proveedor: provNombre,
                    nif: provNif,
                    numero: numFactura,
                    total, baseImp, ivaPct, ivaImp
                });

                const facturaRes = await client.query(`
                    INSERT INTO contabilidad_factura (
                        id_tenant, id_empresa, tipo, id_contacto, numero_factura, 
                        fecha_emision, fecha_devengo, fecha_vencimiento,
                        base_imponible, iva_porcentaje, iva_importe, total,
                        estado, notas, intake_id, created_by
                    ) VALUES ($1, $2, 'GASTO', $3, $4, $5, $5, $6, $7, $8, $9, $10, 'PENDIENTE', $11, $12, $13)
                    RETURNING id
                `, [
                    intake.id_tenant, intake.id_empresa,
                    contactoId, numFactura, fecha, fecha, // Vencimiento = Emision por defecto
                    baseImp, ivaPct, ivaImp, total,
                    `Generado por OCR (Intake ${intake.id})`, intake.id, intake.created_by
                ]);
                gastoId = facturaRes.rows[0].id;

                console.log('[OCR] ✅ Factura created with ID:', gastoId);

                // Si Make nos devuelve la URL del archivo (ej. procesada o la misma), usarla si no teníamos una
                const finalFileUrl = file_url || intake.file_url;

                if (finalFileUrl) {
                    console.log('[OCR] Attaching file:', finalFileUrl);
                    await client.query(`
                        INSERT INTO contabilidad_factura_archivo (id_factura, file_url, storage_key, mime_type, size_bytes, original_name, created_by)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [gastoId, finalFileUrl, intake.file_storage_key, intake.file_mime, intake.file_size_bytes, intake.file_original_name, intake.created_by]);
                    console.log('[OCR] ✅ File attached');
                }
                // Release savepoint on success
                await client.query('RELEASE SAVEPOINT borrador_creation');
            } catch (err) {
                // Rollback to savepoint - this recovers the transaction to a good state
                await client.query('ROLLBACK TO SAVEPOINT borrador_creation');
                console.error('[Egresos] ⚠️ Error creating borrador (recovered):', err.message);
                gastoId = null;
            }
        }

        // Update intake
        const query = `
            UPDATE accounting_intake 
            SET status = $1, 
                extracted_json = $2, 
                validation_json = $3, 
                trace_id = $4,
                error_code = $5, 
                error_message = $6, 
                file_url = COALESCE($7, file_url), 
                updated_at = NOW()
            WHERE id = $8
        `;

        const params = [
            dbStatus,
            extracted ? JSON.stringify(extracted) : null,
            validation ? JSON.stringify(validation) : null,
            trace_id,
            error_code,
            error_message,
            file_url || null,
            intakeId
        ];

        await client.query(query, params);

        console.log('[OCR] Intake updated. Status:', dbStatus, 'Gasto ID:', gastoId);

        await client.query('COMMIT');
        res.json({ ok: true, received: true, gasto_id: gastoId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Egresos] Callback error:', error);
        res.status(500).json({ ok: false, error: error.message });
    } finally {
        client.release();
    }
}

/**
 * POST /api/finsaas/egresos
 * Confirmación final de gasto
 */
async function createGasto(req, res) {
    const client = await pool.connect();
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const userId = req.user?.id;
        const { intake_id, proveedor_nombre, proveedor_nif, proveedor_id, numero_factura, fecha_emision, fecha_vencimiento, base_imponible, iva_porcentaje, iva_importe, total, categoria, concepto, estado = 'PENDIENTE', gasto_id } = req.body;

        if (!empresaId) return res.status(400).json({ ok: false, error: 'Empresa no especificada' });

        await client.query('BEGIN');

        let contactoId = proveedor_id;
        if (!contactoId && proveedor_nombre) {
            const provCheck = await client.query('SELECT id FROM contabilidad_contacto WHERE id_tenant=$1 AND nif_cif=$2 LIMIT 1', [tenantId, proveedor_nif]);
            if (provCheck.rows.length > 0) contactoId = provCheck.rows[0].id;
            else {
                const newC = await client.query(`INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif, created_by) VALUES ($1, $2, 'PROVEEDOR', $3, $4, $5) RETURNING id`, [tenantId, empresaId, proveedor_nombre, proveedor_nif, userId]);
                contactoId = newC.rows[0].id;
            }
        }

        let finalId = gasto_id;
        if (finalId) {
            await client.query(`
                UPDATE contabilidad_factura SET
                    id_contacto=$1, id_empresa=$2, numero_factura=$3, fecha_emision=$4, fecha_devengo=$4, fecha_vencimiento=$5, base_imponible=$6, iva_porcentaje=$7, iva_importe=$8, total=$9, notas=$10, updated_at=NOW(), updated_by=$11
                WHERE id=$12 AND id_tenant=$13
             `, [contactoId, empresaId, numero_factura, fecha_emision, fecha_vencimiento, base_imponible, iva_porcentaje, iva_importe || (total - base_imponible), total, concepto, userId, finalId, tenantId]);
        } else {
            const ins = await client.query(`
                INSERT INTO contabilidad_factura (id_tenant, id_empresa, tipo, id_contacto, numero_factura, fecha_emision, fecha_devengo, fecha_vencimiento, base_imponible, iva_porcentaje, iva_importe, total, estado, notas, intake_id, created_by)
                VALUES ($1, $2, 'GASTO', $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
            `, [tenantId, empresaId, contactoId, numero_factura, fecha_emision || new Date(), fecha_vencimiento, base_imponible || 0, iva_porcentaje || 0, iva_importe || (total - base_imponible), total || 0, estado, concepto, intake_id, userId]);
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

async function listGastos(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = getEmpresaId(req);
        const { estado, limit = 50, offset = 0 } = req.query;

        let query = `SELECT g.*, c.nombre as contacto_nombre FROM contabilidad_factura g LEFT JOIN contabilidad_contacto c ON g.id_contacto = c.id WHERE g.id_tenant = $1 AND g.tipo = 'GASTO' AND g.deleted_at IS NULL`;
        const params = [tenantId];
        let pIdx = 2;

        if (empresaId) { query += ` AND g.id_empresa = $${pIdx++}`; params.push(empresaId); }
        if (estado) { query += ` AND g.estado = $${pIdx++}`; params.push(estado); }

        query += ` ORDER BY g.fecha_emision DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);
        const countRes = await pool.query(`SELECT COUNT(*) FROM contabilidad_factura WHERE id_tenant = $1 AND tipo='GASTO' AND deleted_at IS NULL ${empresaId ? 'AND id_empresa=$2' : ''}`, empresaId ? [tenantId, empresaId] : [tenantId]);

        res.json({ ok: true, data: { items: result.rows, total: parseInt(countRes.rows[0].count) } });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = { createIntake, getIntake, ocrResultCallback, createGasto, listGastos };
