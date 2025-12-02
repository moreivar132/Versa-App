require('dotenv').config();
const pool = require('./db');

async function addAlmacenColumn() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if column exists
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'compracabecera' AND column_name = 'id_almacen'
        `);

        if (checkRes.rows.length === 0) {
            console.log('Adding id_almacen column to compracabecera...');
            await client.query(`
                ALTER TABLE compracabecera 
                ADD COLUMN id_almacen INTEGER REFERENCES almacen(id);
            `);
            console.log('Column added successfully.');
        } else {
            console.log('Column id_almacen already exists.');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding column:', err);
    } finally {
        client.release();
        pool.end();
    }
}

addAlmacenColumn();
