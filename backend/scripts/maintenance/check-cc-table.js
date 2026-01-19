const pool = require('./db');

async function check() {
    const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cuentacorriente'
    `);
    console.log('Columnas de cuentacorriente:');
    console.log(result.rows.map(x => x.column_name));
    process.exit();
}

check();
