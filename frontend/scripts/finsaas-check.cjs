const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\moreivar\\Desktop\\Versa-App\\frontend\\src\\verticals\\finsaas\\pages';

if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let errors = 0;

files.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Check for hardcoded empty API_BASE
    if (/const\s+API_BASE\s*=\s*['"]['"]\s*;/.test(content)) {
        console.error(`[FAIL] ${file} contains empty API_BASE`);
        errors++;
    }

    // Check for direct fetch to relative api
    // fetch('/api
    // fetch("/api
    if (/fetch\s*\(\s*['"]\/api/.test(content)) {
        console.error(`[FAIL] ${file} contains fetch('/api...)`);
        errors++;
    }

    // Check for guard.js usage
    if (/<script\s+src="\/guard\.js">/.test(content)) {
        console.error(`[FAIL] ${file} imports /guard.js`);
        errors++;
    }
});

if (errors === 0) {
    console.log("All checks passed!");
    process.exit(0);
} else {
    console.error(`Found ${errors} errors.`);
    process.exit(1);
}
