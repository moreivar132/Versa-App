
const url = "https://hook.eu2.make.com/quirc89qo1imv3lwxhc5fhaj25qkhua7"; // Client
const query = "a";

async function test() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Raw: ${text}`);
    } catch (e) {
        console.error(e);
    }
}
test();
