#!/usr/bin/env node
/**
 * CRIT-FIX-01 Guardrail: No pool.query outside Core DB
 * 
 * This script scans the codebase for direct pool.query usage
 * and fails if found outside the allowlisted paths.
 * 
 * Run: npm run check:db-guardrails
 * 
 * Exit codes:
 *   0 = No violations found
 *   1 = Violations found (blocks CI)
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');

// Paths to scan for violations (ALL runtime paths)
const SCAN_PATHS = [
    'routes',
    'src/modules',
    'services',
    'controllers',
    'repositories'
];

// Paths that are allowed to use pool.query (The "Core" only)
const ALLOWLIST = [
    'src/core/db/',
    'db.js',
    'scripts/',
    'tests/',
    '__tests__/',
    'legacy/'
];

// Patterns to detect
const VIOLATION_PATTERNS = [
    /pool\.query\s*\(/g,
    /await\s+pool\.query/g
];

// Files to explicitly allow (health checks, etc.)
const ALLOWED_FILES = [
    'index.js',      // Health check endpoint
    'src/app.js'     // Health check endpoint
];

let violations = [];
let scannedFiles = 0;

function isAllowlisted(filePath) {
    const relativePath = path.relative(BACKEND_ROOT, filePath);

    // Check explicit file allowlist
    if (ALLOWED_FILES.some(f => relativePath === f || relativePath.endsWith(f))) {
        return true;
    }

    // Check path allowlist
    return ALLOWLIST.some(allowed => relativePath.includes(allowed));
}

function scanFile(filePath) {
    if (!filePath.endsWith('.js')) return;
    if (isAllowlisted(filePath)) return;

    scannedFiles++;

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            VIOLATION_PATTERNS.forEach(pattern => {
                if (pattern.test(line)) {
                    violations.push({
                        file: path.relative(BACKEND_ROOT, filePath),
                        line: index + 1,
                        content: line.trim().substring(0, 80)
                    });
                }
                // Reset regex lastIndex for global patterns
                pattern.lastIndex = 0;
            });
        });
    } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
    }
}

function scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Skip node_modules and hidden directories
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                continue;
            }
            scanDirectory(fullPath);
        } else if (entry.isFile()) {
            scanFile(fullPath);
        }
    }
}

// Main execution
console.log('🔍 CRIT-FIX-01 Guardrail: Scanning for pool.query violations...\n');

SCAN_PATHS.forEach(scanPath => {
    const fullPath = path.join(BACKEND_ROOT, scanPath);
    scanDirectory(fullPath);
});

console.log(`📁 Scanned ${scannedFiles} files\n`);

if (violations.length > 0) {
    console.log('❌ VIOLATIONS FOUND:\n');

    violations.forEach(v => {
        console.log(`  📄 ${v.file}:${v.line}`);
        console.log(`     ${v.content}\n`);
    });

    console.log(`\n🚨 Total violations: ${violations.length}`);
    console.log('\n📖 To fix:');
    console.log('   - Replace pool.query with getTenantDb(ctx).query()');
    console.log('   - Or move SQL logic to a repository in src/modules/*/infra/repos/');
    console.log('   - See docs/CLEANUP/CRIT_FIX_01_REPORT.md for details\n');

    process.exit(1);
} else {
    console.log('✅ No violations found. All clear!\n');
    process.exit(0);
}
