
const url = "https://hook.eu2.make.com/7o0cy2ftscs377jw96saxu0lh4nqkegm";
const query = "a";

async function testSearch() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);

        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                console.log("SUCCESS: Received JSON array.");
            }
        } catch (e) {
            console.log("FAIL: Not valid JSON.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testSearch();
