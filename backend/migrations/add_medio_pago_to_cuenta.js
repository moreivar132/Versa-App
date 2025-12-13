const pool = require('../db');

async function migrate() {
    try {
        console.log('Agregando columna id_medio_pago a cuentamecanicomovimiento...');

        await pool.query(`
            ALTER TABLE cuentamecanicomovimiento 
            ADD COLUMN IF NOT EXISTS id_medio_pago INTEGER REFERENCES mediopago(id)
        `);

        console.log('✅ Columna id_medio_pago agregada correctamente');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

migrate();
