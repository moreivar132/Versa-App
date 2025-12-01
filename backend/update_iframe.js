const pool = require('./db');

async function updateIframe() {
    try {
        const newIframe = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d189.80596487362274!2d-3.6410956905987812!3d40.43331417123623!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd422f15191433bb%3A0xbd57fb72d0ed37d3!2sTaller%20Moto%20Versa!5e0!3m2!1ses-419!2ses!4v1764429452896!5m2!1ses-419!2ses" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';

        // Update for ID 1 (Versa Pl Mayo)
        const res = await pool.query('UPDATE sucursal SET direccion_iframe = $1 WHERE id = 1 RETURNING *', [newIframe]);
        console.log('Updated:', res.rows[0]);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

updateIframe();
