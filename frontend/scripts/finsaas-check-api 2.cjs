const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../src/verticals/finsaas');
const EXTENSIONS = ['.js', '.html'];
let hasError = false;

console.log(`== FinSaaS Static Check: buscando rutas relativas /api y API_BASE en ${ROOT} ==`);

function walkDir(dir) {
    if (!fs.existsSync(dir)) {
        console.warn(`Directory not found: ${dir}`);
        return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else {
            if (EXTENSIONS.includes(path.extname(fullPath))) {
                checkFile(fullPath);
            }
        }
    }
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    // 1) fetch('/api') o fetch("/api")
    // Regex: fetch\s*\(\s*['"]/api
    if (/fetch\s*\(\s*['"]\/api/.test(content)) {
        console.error(`FAIL: fetch('/api...') encontrado en ${relativePath}`);
        hasError = true;
    }

    // 2) axios('/api') -> axios...('/api
    // Regex: axios.*\(.*['"]\/api
    if (/axios.*\(.*['"]\/api/.test(content)) {
        console.error(`FAIL: axios...('/api...') encontrado en ${relativePath}`);
        hasError = true;
    }

    // 3) API_BASE hardcodeado vacío
    // Regex: const API_BASE\s*=\s*['"]['"]
    if (/const\s+API_BASE\s*=\s*['"]['"]/.test(content)) {
        console.error(`FAIL: const API_BASE = '' encontrado en ${relativePath}`);
        hasError = true;
    }
}

walkDir(ROOT);

if (hasError) {
    console.error("FAILED. Se encontraron errores.");
    process.exit(1);
} else {
    console.log("OK: FinSaaS no contiene rutas relativas /api ni API_BASE vacío.");
    process.exit(0);
}
