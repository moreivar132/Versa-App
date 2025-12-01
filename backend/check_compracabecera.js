const pool = require('./db');

async function checkCompraCabecera() {
    try {
        const table = 'compracabecera';
        console.log(`\n--- Schema for ${table} ---`);
        const res = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `, [table]);

        if (res.rows.length === 0) {
            console.log(`Table ${table} not found.`);
        } else {
            res.rows.forEach(row => {
                console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        await pool.end();
    }
}

checkCompraCabecera();
