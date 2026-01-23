const { Client } = require('pg');

// Parse arguments or env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('No DATABASE_URL provided');
    process.exit(1);
}

// Mimic Knex behavior somewhat, or just standard PG
// Knexfile didn't have explicit SSL object, so we rely on string or defaults.
// However, to catch "TLSWrap", we want to see if we can connect AT ALL.

const client = new Client({
    connectionString,
    // We'll trust the string parameters
});

const start = Date.now();

client.connect()
    .then(async () => {
        console.log(`Connected in ${Date.now() - start}ms`);

        const res1 = await client.query('SELECT 1 as "ok"');
        console.log('Query 1 OK:', JSON.stringify(res1.rows[0]));

        const res2 = await client.query('SELECT version()');
        console.log('Query 2 OK:', res2.rows[0].version);

        // Check SSL
        // client.connection.stream.encrypted should be true
        const isSSL = !!(client.connection.stream && client.connection.stream.encrypted);
        console.log('SSL Active:', isSSL);

        await client.end();
        console.log('Connection closed cleanly.');
    })
    .catch(err => {
        console.error('SMOKE TEST FAILED');
        console.error(err);
        process.exit(1);
    });
