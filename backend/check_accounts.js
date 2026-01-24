require('dotenv').config();
const pool = require('./db');

async function check() {
    try {
        const res = await pool.query('SELECT * FROM bank_account WHERE tenant_id = $1', [1]);
        console.log('Accounts for tenant 1:', res.rows.length);
        res.rows.forEach(a => {
            console.log(`- ID: ${a.id}, Name: ${a.display_name}, Source: ${a.source}, Connection: ${a.bank_connection_id}`);
        });

        const connRes = await pool.query('SELECT * FROM bank_connection WHERE tenant_id = $1', [1]);
        console.log('Connections for tenant 1:', connRes.rows.length);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
