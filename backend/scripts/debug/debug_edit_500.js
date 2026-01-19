const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    console.log('--- STARTING DEBUG FOR ID 34 ---');
    try {
        const id = 34;

        // 1. Fetch Cabecera
        const query = `
            SELECT c.*, p.nombre as proveedor_nombre, p.cif as proveedor_nif, 
                   s.nombre as sucursal_nombre
            FROM compracabecera c
            LEFT JOIN proveedor p ON c.id_proveedor = p.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
            WHERE c.id = $1
        `;
        console.log('Running Query:', query);
        const res = await pool.query(query, [id]);
        console.log('Cabecera Result Row Count:', res.rows.length);
        if (res.rows.length > 0) {
            console.log('Cabecera Data:', res.rows[0]);
        } else {
            console.error('CRITICAL: Compra 34 NOT FOUND in DB');
        }

        // 2. Fetch Lines
        const queryLines = `
            SELECT cl.*, pr.nombre as producto_nombre, pr.codigo_barras
            FROM compralinea cl
            LEFT JOIN producto pr ON cl.id_producto = pr.id
            WHERE cl.id_compra = $1
        `;
        console.log('Running Lines Query:', queryLines);
        const resLines = await pool.query(queryLines, [id]);
        console.log('Lines Result Count:', resLines.rows.length);
        console.log('Lines Data:', resLines.rows);

    } catch (error) {
        console.error('--- ERROR CAUGHT ---');
        console.error(error);
    } finally {
        await pool.end();
        console.log('--- DONE ---');
    }
}

run();
