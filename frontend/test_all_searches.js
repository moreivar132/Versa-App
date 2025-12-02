
const urls = {
    technician: "https://hook.eu2.make.com/7o0cy2ftscs377jw96saxu0lh4nqkegm",
    client: "https://hook.eu2.make.com/quirc89qo1imv3lwxhc5fhaj25qkhua7",
    vehicle: "https://hook.eu2.make.com/z8b2jaicivbiuuhc819wcwlq2mw2em32",
    product: "https://hook.eu2.make.com/8xfyw4ki7ja73vtb2rwbkr3pq1kxcdx8"
};

const query = "a";

async function testUrl(name, url) {
    console.log(`Testing ${name}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        const text = await response.text();
        console.log(`[${name}] Status: ${response.status}`);
        console.log(`[${name}] Raw response: ${text.substring(0, 100)}...`); // Truncate

        try {
            const data = JSON.parse(text);
            console.log(`[${name}] Valid JSON: Yes`);
            console.log(`[${name}] Is Array: ${Array.isArray(data)}`);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`[${name}] First item keys: ${Object.keys(data[0]).join(', ')}`);
            }
        } catch (e) {
            console.log(`[${name}] Valid JSON: NO`);
        }
    } catch (error) {
        console.error(`[${name}] Error:`, error.message);
    }
    console.log('---');
}

async function run() {
    for (const [name, url] of Object.entries(urls)) {
        await testUrl(name, url);
    }
}

run();
