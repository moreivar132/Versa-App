const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkPermissionIssue() {
    try {
        const testId = 29;
        const testTenant = 1;

        console.log(`Checking purchase ${testId} for tenant ${testTenant}...`);

        const res = await pool.query(`
            SELECT c.*, p.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM compracabecera c
            LEFT JOIN proveedor p ON c.id_proveedor = p.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
            WHERE c.id = $1 AND c.id_tenant = $2
        `, [testId, testTenant]);

        if (res.rows.length === 0) {
            console.log('Result: NOT FOUND with tenant constraint');

            const checkGlobal = await pool.query('SELECT id, id_tenant FROM compracabecera WHERE id = $1', [testId]);
            console.log('Global check:', checkGlobal.rows);
        } else {
            console.log('Result: FOUND');
            console.log(res.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkPermissionIssue();
