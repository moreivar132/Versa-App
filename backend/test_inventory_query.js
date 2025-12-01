require('dotenv').config();
const pool = require('./db');

async function testQuery() {
    try {
        // Get a tenant ID
        const userRes = await pool.query('SELECT id_tenant FROM usuario LIMIT 1');
        if (userRes.rows.length === 0) {
            console.log('No users found');
            return;
        }
        const id_tenant = userRes.rows[0].id_tenant;
        console.log('Testing with id_tenant:', id_tenant);

        const query = `
            SELECT p.*, pr.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id_tenant = $1
            ORDER BY p.created_at DESC LIMIT 50 OFFSET 0
        `;

        const res = await pool.query(query, [id_tenant]);
        console.log('Query successful. Rows:', res.rows.length);
        if (res.rows.length > 0) {
            console.log('First row:', res.rows[0]);
        }

    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        pool.end();
    }
}

testQuery();
