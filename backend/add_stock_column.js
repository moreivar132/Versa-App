require('dotenv').config();
const pool = require('./db');

async function addStockColumn() {
    try {
        console.log('Adding stock column to producto table...');
        await pool.query(`
            ALTER TABLE producto 
            ADD COLUMN IF NOT EXISTS stock numeric DEFAULT 0;
        `);
        console.log('Column stock added successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        pool.end();
    }
}

addStockColumn();
