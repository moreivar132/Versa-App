require('dotenv').config();
const pool = require('./db');

async function checkProductSchema() {
    try {
        console.log('--- Checking PRODUCTO columns ---');
        const prodCols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'producto';
        `);
        console.log(prodCols.rows.map(r => r.column_name));

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkProductSchema();
