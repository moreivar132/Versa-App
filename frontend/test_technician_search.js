
// No imports needed for Node 18+ fetch
const url = "https://hook.eu2.make.com/7o0cy2ftscs377jw96saxu0lh4nqkegm";
const query = "a"; // Search for something generic

async function testSearch() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const text = await response.text();
        console.log("Raw response:", text);

        try {
            const data = JSON.parse(text);
            console.log("Parsed JSON:", data);

            const results = Array.isArray(data) ? data : [data];
            if (results.length > 0) {
                const first = results[0];
                console.log("First item keys:", Object.keys(first));
                if (first.nombre && first.id) {
                    console.log("Validation PASSED: Item has 'nombre' and 'id'.");
                } else {
                    console.log("Validation FAILED: Item missing 'nombre' or 'id'.");
                }
            } else {
                console.log("No results found to validate structure.");
            }

        } catch (e) {
            console.error("JSON Parse Error:", e);
        }

    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testSearch();
