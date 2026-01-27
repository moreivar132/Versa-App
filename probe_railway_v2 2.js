
const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    url,
                    status: res.statusCode,
                    headers: res.headers,
                    body: data.substring(0, 500) // First 500 chars
                });
            });
        });
        req.on('error', (err) => {
            resolve({ url, error: err.message });
        });
    });
}

async function run() {
    console.log('--- DIAGNOSTIC PROBE ---');

    console.log('\n1. Protected Route with FAKE token (Testing Middleware/Router):');
    const authTest = await check('https://versa-app-dev.up.railway.app/api/contabilidad/documentos/36/archivo?preview=true&token=fake');
    console.log(`Status: ${authTest.status}`);
    console.log(`Body: ${authTest.body}`);

    console.log('\n2. Non-existent file in /uploads (Testing Static Serve Fallback):');
    const staticTest = await check('https://versa-app-dev.up.railway.app/uploads/ghost.pdf');
    console.log(`Status: ${staticTest.status}`);
    console.log(`Body: ${staticTest.body}`);

    console.log('\n3. Non-existent file in /api/uploads (Testing API Static Fallback):');
    const apiStaticTest = await check('https://versa-app-dev.up.railway.app/api/uploads/ghost.pdf');
    console.log(`Status: ${apiStaticTest.status}`);
    console.log(`Body: ${apiStaticTest.body}`);
}

run();
