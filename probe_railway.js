
const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    url,
                    status: res.statusCode,
                    headers: res.headers,
                    body: data.substring(0, 200) // First 200 chars
                });
            });
        }).on('error', (err) => {
            resolve({ url, error: err.message });
        });
    });
}

async function run() {
    console.log('Probing Railway DEV...');

    // 1. Root Health
    const health = await check('https://versa-app-dev.up.railway.app/api/health');
    console.log('Health:', health);

    // 2. Contabilidad Ping (Public)
    const ping = await check('https://versa-app-dev.up.railway.app/api/contabilidad/ping');
    console.log('Contabilidad Ping:', ping);

    // 3. The 404 URL (without token, just to see what server says)
    // Even without token, if route exists, middleware should return 401, not 404 Railway Page.
    const target = await check('https://versa-app-dev.up.railway.app/api/contabilidad/documentos/36/archivo?preview=true');
    console.log('Target Endpoint:', target);
}

run();
