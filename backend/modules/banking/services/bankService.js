const pool = require('../../../db');
const crypto = require('crypto');

class BankService {

    /**
     * Confirma la importación: Mueve de staging a production (bank_transaction)
     */
    async commitImport(importId, tenantId, options = {}) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Validate Import
            const importRes = await client.query(
                'SELECT * FROM bank_import WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
                [importId, tenantId]
            );
            if (importRes.rows.length === 0) throw new Error('Import no encontrado');
            const importRec = importRes.rows[0];

            if (importRec.status === 'committed') throw new Error('Import ya procesado');

            const targetAccountId = options.bank_account_id || importRec.bank_account_id;
            if (!targetAccountId) throw new Error('Cuenta bancaria no seleccionada');

            // Verify account ownership and company link
            const accRes = await client.query(
                'SELECT id FROM bank_account WHERE id = $1 AND tenant_id = $2 AND id_empresa = $3',
                [targetAccountId, tenantId, importRec.id_empresa]
            );
            if (accRes.rows.length === 0) throw new Error('Cuenta bancaria no válida para esta empresa');

            // 2. Fetch Staging Rows (only OK ones)
            const rowsRes = await client.query(
                `SELECT * FROM bank_import_row 
                 WHERE bank_import_id = $1 AND status != 'error'
                 ORDER BY row_number`,
                [importId]
            );

            const rows = rowsRes.rows;
            let insertedCount = 0;
            let dupesCount = 0;

            for (const row of rows) {
                const parsed = row.parsed;
                // Generate External ID (Idempotency Key)
                // hash matches provider_transaction_id logic?
                // Just keep it stable.
                const rawString = `${tenantId}|${targetAccountId}|${parsed.booking_date}|${parsed.amount}|${(parsed.description || '').trim().toUpperCase()}|${parsed.balance || ''}`;
                const externalId = crypto.createHash('sha256').update(rawString).digest('hex');

                // Upsert / Insert ignore
                // Using provider_transaction_id as idempotency key

                const insertRes = await client.query(
                    `INSERT INTO bank_transaction 
                    (tenant_id, bank_account_id, provider_transaction_id, source, booking_date, value_date, amount, currency, description, category, running_balance, direction, provider_payload)
                    VALUES ($1, $2, $3, 'manual_import', $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (tenant_id, bank_account_id, provider_transaction_id) DO NOTHING
                    RETURNING id`,
                    [
                        tenantId,
                        targetAccountId,
                        externalId,
                        parsed.booking_date,
                        parsed.value_date || null,
                        parsed.amount,
                        parsed.currency || 'EUR',
                        parsed.description,
                        parsed.category,
                        parsed.balance || null, // running_balance
                        parsed.amount >= 0 ? 'in' : 'out', // direction
                        row.raw // provider_payload (jsonb)
                    ]
                );

                if (insertRes.rowCount > 0) {
                    insertedCount++;
                } else {
                    dupesCount++;
                }
            }

            // 3. Update Import Status
            await client.query(
                `UPDATE bank_import SET 
                    status = 'committed', 
                    bank_account_id = $1,
                    stats = jsonb_set(
                        jsonb_set(COALESCE(stats, '{}'), '{rows_inserted}', to_jsonb($2::int)),
                        '{rows_duplicated}', to_jsonb($3::int)
                    )
                WHERE id = $4`,
                [targetAccountId, insertedCount, dupesCount, importId]
            );

            await client.query('COMMIT');

            return {
                ok: true,
                inserted: insertedCount,
                duplicated: dupesCount,
                total: rows.length
            };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}

module.exports = new BankService();
