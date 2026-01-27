const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_8qJgY6NcrWjF@ep-spring-shape-a2k01wac-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkUser() {
    try {
        await client.connect();
        console.log('Connected to DB');
        const res = await client.query("SELECT id, email, password_hash, is_super_admin FROM usuario WHERE email = 'ivan.moreno@goversa.es'");
        console.log('User found:', res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkUser();
