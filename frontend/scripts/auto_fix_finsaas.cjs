const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\moreivar\\Desktop\\Versa-App\\frontend\\src\\verticals\\finsaas\\pages';

if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Remove <script src="/guard.js"></script>
    const guardScriptRegex = /<script\s+src="\/guard\.js"><\/script>/g;
    if (guardScriptRegex.test(content)) {
        content = content.replace(guardScriptRegex, '');
        console.log(`[${file}] Removed guard.js script tag`);
        changed = true;
    }

    // 2. Fix API_BASE = ''
    // We look for const API_BASE = ''; or ""; (with optional spacing)
    const apiBaseRegex = /const\s+API_BASE\s*=\s*['"]['"]\s*;/g;
    if (apiBaseRegex.test(content)) {
        // We replace it with calling the helper
        content = content.replace(apiBaseRegex, "const API_BASE = getApiBaseUrl();");
        console.log(`[${file}] Updated API_BASE definition`);
        changed = true;

        // 3. Ensure getApiBaseUrl is imported from auth.js
        const importAuthRegex = /import\s+({[^}]*})\s+from\s+['"]\/auth\.js['"];/;
        const match = content.match(importAuthRegex);

        if (match) {
            let importsBlock = match[1];
            // Check if getApiBaseUrl is already there
            if (!importsBlock.includes('getApiBaseUrl')) {
                // Clean up the curly braces
                let imports = importsBlock.replace('{', '').replace('}', '').split(',').map(s => s.trim()).filter(s => s);
                imports.push('getApiBaseUrl');
                const newImportStatement = `import { ${imports.join(', ')} } from '/auth.js';`;
                content = content.replace(importAuthRegex, newImportStatement);
                console.log(`[${file}] Added getApiBaseUrl to imports`);
            }
        } else {
            console.warn(`[${file}] WARNING: Could not find auth.js import to add getApiBaseUrl`);
            // Fallback: If no auth.js import found but we replaced API_BASE, we must add it.
            // Assuming this is a module script, we can add it at the top of the script tag.
            const scriptModuleRegex = /<script\s+type="module">/;
            if (scriptModuleRegex.test(content)) {
                content = content.replace(scriptModuleRegex, '<script type="module">\n        import { getApiBaseUrl } from "/auth.js";');
                console.log(`[${file}] Injected auth.js import`);
            }
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[${file}] Saved changes.`);
    }
});
