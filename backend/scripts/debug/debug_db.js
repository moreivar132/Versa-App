const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkData() {
    try {
        console.log('--- Compracabecera ---');
        const resCab = await pool.query('SELECT id, id_tenant, id_sucursal, id_proveedor, total FROM compracabecera WHERE id IN (27, 29)');
        console.table(resCab.rows);

        console.log('--- Compralinea ---');
        const resLin = await pool.query('SELECT * FROM compralinea WHERE id_compra IN (27, 29)');
        console.table(resLin.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkData();
