const pool = require('./db');

async function addMecanicoColumn() {
    try {
        await pool.query(`
            ALTER TABLE citataller 
            ADD COLUMN IF NOT EXISTS id_mecanico INTEGER REFERENCES usuario(id);
        `);
        console.log('Column id_mecanico added successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        pool.end();
    }
}

addMecanicoColumn();
