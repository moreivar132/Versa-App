const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\moreivar\\Desktop\\Versa-App\\frontend\\src\\verticals\\finsaas\\pages';

if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
}

const filesToFix = [
    'copiloto-alertas.html',
    'copiloto-chat.html',
    'copiloto-resumen.html',
    'usuarios.html'
];

filesToFix.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Regex to match fetch('/api...', fetch("/api...", fetch(`/api...
    // We capture the quote type in group 1, and the rest of the string in group 2.
    // We assume the string ends with the same quote type.
    const fetchRegex = /fetch\(\s*([`'"])\/api((?:(?!\1).)*)\1/g;

    if (fetchRegex.test(content)) {
        content = content.replace(fetchRegex, 'fetch(buildApiUrl($1/api$2$1)');
        console.log(`[${file}] Fixed direct fetch('/api') calls`);
        changed = true;

        // Ensure buildApiUrl is imported
        const importAuthRegex = /import\s+({[^}]*})\s+from\s+['"]\/auth\.js['"];/;
        const match = content.match(importAuthRegex);

        if (match) {
            let importsBlock = match[1];
            if (!importsBlock.includes('buildApiUrl')) {
                let imports = importsBlock.replace('{', '').replace('}', '').split(',').map(s => s.trim()).filter(s => s);
                imports.push('buildApiUrl');
                const newImportStatement = `import { ${imports.join(', ')} } from '/auth.js';`;
                content = content.replace(importAuthRegex, newImportStatement);
                console.log(`[${file}] Added buildApiUrl to imports`);
            }
        } else {
            // Fallback if no auth.js import
            const scriptModuleRegex = /<script\s+type="module">/;
            if (scriptModuleRegex.test(content)) {
                content = content.replace(scriptModuleRegex, '<script type="module">\n        import { buildApiUrl } from "/auth.js";');
                console.log(`[${file}] Injected auth.js import`);
            }
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Saved ${file}`);
    }
});
