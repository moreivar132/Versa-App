const pool = require('./db');

async function addImpuestos() {
    try {
        // Verificar si ya existe 0%
        const check0 = await pool.query('SELECT id FROM impuesto WHERE porcentaje = 0');
        if (check0.rows.length === 0) {
            await pool.query(`
                INSERT INTO impuesto (codigo, nombre, porcentaje, activo) 
                VALUES ('IVA_0', 'Exento', 0, true)
            `);
            console.log('Impuesto 0% agregado');
        } else {
            console.log('Impuesto 0% ya existe');
        }

        // Verificar si ya existe 10%
        const check10 = await pool.query('SELECT id FROM impuesto WHERE porcentaje = 10');
        if (check10.rows.length === 0) {
            await pool.query(`
                INSERT INTO impuesto (codigo, nombre, porcentaje, activo) 
                VALUES ('IVA_10', 'IVA Reducido', 10, true)
            `);
            console.log('Impuesto 10% agregado');
        } else {
            console.log('Impuesto 10% ya existe');
        }

        // Mostrar todos los impuestos
        const result = await pool.query('SELECT * FROM impuesto ORDER BY porcentaje ASC');
        console.log('Impuestos actuales:', result.rows);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        pool.end();
    }
}

addImpuestos();
