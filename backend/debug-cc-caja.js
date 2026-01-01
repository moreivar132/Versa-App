const pool = require('./db');
const fs = require('fs');

async function check() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cajamovimiento'
            ORDER BY ordinal_position
        `);
        let output = 'Columnas de cajamovimiento:\n';
        result.rows.forEach(r => output += `  ${r.column_name}: ${r.data_type}\n`);
        fs.writeFileSync('debug-output.txt', output);
        console.log('Guardado');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}
check();
