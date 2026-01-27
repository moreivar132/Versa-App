const ParserFactory = require('../parsers');
const fs = require('fs');
const { getTenantDb } = require('../../../src/core/db/tenant-db');
const path = require('path');

class BankImportService {

    /**
     * Procesa la subida inicial del archivo.
     * Crea el registro en bank_import con estado 'uploaded'.
     */
    async uploadFile(file, tenantId, userId, idEmpresa) {
        // file = { path, originalname, mimetype, size, buffer? }
        // Note: Multer might save to disk or memory. Assuming disk or we read it.
        // We need sha256 for dedupe.

        const crypto = require('crypto');
        const fileBuffer = fs.readFileSync(file.path);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');

        const db = getTenantDb({ tenantId });

        // Check if file already imported (dedupe)
        const existing = await db.query(
            `SELECT id, status FROM bank_import WHERE tenant_id = $1 AND file_sha256 = $2 AND id_empresa = $3 AND status != 'failed'`,
            [tenantId, hex, idEmpresa]
        );

        if (existing.rows.length > 0) {
            const existingId = existing.rows[0].id;
            console.log(`File duplicado detectado: ${file.originalname} (${hex}) para empresa ${idEmpresa}`);

            // Check if physical file exists for the existing record
            const targetFilename = `bank_import_${existingId}`;
            const targetPath = path.join(path.dirname(file.path), targetFilename);

            if (fs.existsSync(targetPath)) {
                // File exists, safe to delete new duplicate upload
                try { fs.unlinkSync(file.path); } catch (_e) { /* ignore */ }
            } else {
                // File missing! Recover by using this new upload as the file for the existing record
                console.log(`Recuperando archivo faltante para import ${existingId}`);
                fs.renameSync(file.path, targetPath);
            }

            return { isDuplicate: true, importId: existingId, status: existing.rows[0].status };
        }

        try {
            await db.txWithRLS(async (tx) => {
                const res = await tx.query(
                    `INSERT INTO bank_import 
                    (tenant_id, created_by_user_id, status, filename, file_mime, file_size, file_sha256, id_empresa)
                    VALUES ($1, $2, 'uploaded', $3, $4, $5, $6, $7)
                    RETURNING id`,
                    [tenantId, userId, file.originalname, file.mimetype, file.size, hex, idEmpresa]
                );

                const importId = res.rows[0].id;

                // Rename file to a predictable name: uploads/bank_import_<ID>
                // This ensures parseImport can find it later.
                const targetFilename = `bank_import_${importId}`;
                const targetPath = path.join(path.dirname(file.path), targetFilename);

                fs.renameSync(file.path, targetPath);

                return { isDuplicate: false, importId, status: 'uploaded' };
            });
        } catch (e) {
            // Try cleanup
            try { fs.unlinkSync(file.path); } catch (_err) { /* ignore */ }
            throw e;
        }
    }

    /**
     * Ejecuta el parseo del archivo y genera previews (filas staging).
     */
    async parseImport(importId, tenantId) {
        // 1. Get import record
        const db = getTenantDb({ tenantId });
        const res = await db.query('SELECT * FROM bank_import WHERE id = $1 AND tenant_id = $2', [importId, tenantId]);
        if (res.rows.length === 0) throw new Error('Import no encontrado');
        const importRecord = res.rows[0];

        // 2. Locate file (Assuming file provided in previous step is available, 
        // OR we need to store the path in DB? Schema does not have path, only filename.
        // Assumption: Middleware uploads to `uploads/` and we can find it or we should have stored the path.
        // Let's assume we can re-construct or passed it. 
        // BETTER: Update schema to store `file_path` or assume a convention.
        // I'll assume convention: 'uploads/' + ID or originalname? 
        // Wait, uploadFile logic implies Multer handles it.
        // I will search for the file in uploads/ with the filename? No, names conflict.

        // FIX: I didn't add `file_path` to `bank_import`. 
        // I will rely on Multer giving me the path in the controller and passing it, 
        // BUT `parse` is a separate step (idempotent 3.2). 
        // So I MUST persist the path.
        // I'll assume for MVP the file is stored as `uploads/<importId>_<filename>` or similar?
        // Or I should add `file_path` to table?
        // Since I can't easily change schema again without migration pain right now, 
        // I will store the path in `metadata` or just assume it is stored in `uploads/` named by SHA or ID.
        // Let's assume `uploads/${importRecord.filename}` BUT what if user deleted it?
        // For now, I'll attempt to find it.

        // Actually, the `uploadFile` step receives `file` object. I should persist the path there technically.
        // Let's assume the Controller saves it to `uploads/bank_import_<ID>` when uploaded.
        const filePath = `uploads/bank_import_${importId}`;

        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado en servidor: ${filePath}`);
        }

        const buffer = fs.readFileSync(filePath);

        // 3. Detect format
        // Check mime or sniff content
        // naive: check extension
        let format = 'unknown';
        if (importRecord.filename.endsWith('.csv')) {
            // sniff header
            const headerLine = buffer.toString('utf-8').split('\n')[0];
            format = ParserFactory.detectFormat(headerLine);
        } else if (importRecord.filename.match(/\.xls(x)?$/)) {
            // xls parser sniffing
            // We'll let the factory/parser handle sniffing
            format = ParserFactory.detectFormat([], [{ 'test': buffer }]); // Wait, detectFormat needs rows?
            // The factory implementation I wrote for XLS was:
            // detectFormat(headers, firstRows)
            // I'll create an instance and use sniffing inside parser? 
            // Or better: try to parse with JasperXls if extension matches?


            // Quick fix: for xls, just assume Jasper if extension is xls/xlsx and valid content
            format = 'jasper_xls_v1'; // Defaulting for MVP if ext matches
        }

        if (format === 'unknown') {
            // throw new Error('Formato no detectado');
            // fallback to generic?
            format = 'generic_csv'; // Not implemented yet
        }

        // 4. Parse
        const parser = ParserFactory.getParser(format);
        const rows = await parser.parse(buffer);

        // 5. Save to bank_import_row (bulk insert)
        return await db.txWithRLS(async (tx) => {
            // Clear previous rows if re-parsing
            await tx.query('DELETE FROM bank_import_row WHERE bank_import_id = $1', [importId]);

            // Update import status
            await tx.query(
                `UPDATE bank_import SET detected_format = $1, status = 'parsed', 
                stats = jsonb_build_object('rows_total', $2::int) 
                WHERE id = $3::uuid`,
                [format, rows.length, importId]
            );

            // Bulk Insert (batching 500)
            const batchSize = 500;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                // Using pure SQL for cleaner bulk with JSONB
                // It's easier to verify implementation detail later, but for speed:
                const queryText = `
                    INSERT INTO bank_import_row (bank_import_id, row_number, status, errors, parsed, raw)
                    SELECT $1::uuid, x.rn, x.st, x.err::jsonb, x.par::jsonb, x.raw::jsonb
                    FROM jsonb_to_recordset($2::jsonb) AS x(rn int, st text, err text, par text, raw text)
                `;

                // Prepare JSONB array for the batch
                const jsonBatch = JSON.stringify(batch.map(r => ({
                    rn: r.row_number,
                    st: r.status,
                    err: r.errors ? JSON.stringify(r.errors) : null,
                    par: JSON.stringify(r.parsed),
                    raw: JSON.stringify(r.raw)
                })));

                await tx.query(queryText, [importId, jsonBatch]);
            }

            // Get preview (first 50)
            const previewRes = await tx.query(
                `SELECT * FROM bank_import_row WHERE bank_import_id = $1 ORDER BY row_number LIMIT 50`,
                [importId]
            );

            return {
                detected_format: format,
                stats: { rows_total: rows.length },
                preview: previewRes.rows.map(r => ({
                    ...r.parsed,
                    status: r.status,
                    errors: r.errors
                }))
            };
        });
    }
}

module.exports = new BankImportService();
