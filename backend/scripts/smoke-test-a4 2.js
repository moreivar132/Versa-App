
const path = require('path');

async function testImports() {
    const files = [
        '../routes/proveedores.js',
        '../routes/sucursales.js',
        '../routes/accessRoutes.js',
        '../services/emailAutomationService.js',
        '../services/emailCampaignService.js'
    ];

    console.log('Starting Smoke Test: Import Check...');
    let errors = 0;

    for (const file of files) {
        try {
            const filePath = path.join(__dirname, file);
            require(filePath);
            console.log(`✅ Loaded ${file}`);
        } catch (err) {
            console.error(`❌ Failed to load ${file}:`, err.message);
            // Ignore "pool" connection errors if they happen on import (unlikely for routes/services unless they init immediately)
            // emailAutomationService inits "makeEmailProvider" which might... NO, it exports an instance.
            // But it doesn't await anything in constructor.
            errors++;
        }
    }

    if (errors > 0) {
        console.error(`Smoke Test Failed with ${errors} errors.`);
        process.exit(1);
    } else {
        console.log('Smoke Test Passed: All files imported successfully.');
        process.exit(0);
    }
}

testImports();
