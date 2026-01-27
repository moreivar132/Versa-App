
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../src');
const FORBIDDEN_PATTERN = /fetch\s*\(\s*['"`]\/api/g;

function scanDirectory(dir) {
    let errors = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            errors = errors.concat(scanDirectory(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.vue') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (FORBIDDEN_PATTERN.test(content)) {
                // Find line number
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (FORBIDDEN_PATTERN.test(line)) {
                        errors.push(`❌ Forbidden relative API call found in ${path.relative(SRC_DIR, fullPath)}:${idx + 1}\n   Line: "${line.trim()}"`);
                    }
                });
            }
        }
    }
    return errors;
}

console.log('🛡️  Scanning for forbidden relative API calls in src/ ...');
const errors = scanDirectory(SRC_DIR);

if (errors.length > 0) {
    console.error(`\nFound ${errors.length} violations:`);
    errors.forEach(e => console.error(e));
    console.error('\n🚫 FAIL: Relative API calls like fetch("/api...") are FORBIDDEN.');
    console.error('   Please use buildApiUrl() from auth.js or VITE_API_URL.');
    process.exit(1);
} else {
    console.log('✅ PASS: No relative API calls found.');
    process.exit(0);
}
