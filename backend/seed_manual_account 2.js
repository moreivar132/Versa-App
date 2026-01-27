require('dotenv').config();
const pool = require('./db');

async function create() {
    try {
        const tenantId = 1;

        // Check if already exists
        const existing = await pool.query('SELECT id FROM bank_account WHERE tenant_id = $1 AND display_name = $2', [tenantId, 'Cuenta Principal (Manual)']);

        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO bank_account (tenant_id, provider_account_id, display_name, currency, source, bank_connection_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [tenantId, 'manual_001', 'Cuenta Principal (Manual)', 'EUR', 'manual', null]);
            console.log('Manual account created.');
        } else {
            console.log('Account already exists.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

create();
