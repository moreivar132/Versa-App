/**
 * Script para validar que todos los archivos con selector de sucursal
 * tienen la estructura correcta
 * 
 * Ejecutar: node scripts/validate-selectors.cjs
 */

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

// Buscar todos los HTML con sucursal-selector-container
const files = fs.readdirSync(frontendDir)
    .filter(f => f.endsWith('.html'))
    .filter(f => {
        const content = fs.readFileSync(path.join(frontendDir, f), 'utf8');
        return content.includes('sucursal-selector-container');
    });

console.log(`\n📋 Archivos con selector de sucursal: ${files.length}\n`);

const issues = [];

files.forEach(file => {
    const filepath = path.join(frontendDir, file);
    const content = fs.readFileSync(filepath, 'utf8');

    const checks = {
        hasContainer: content.includes('id="sucursal-selector-container"'),
        hasWrapper: content.includes('sucursal-selector-wrapper'),
        hasInitCall: content.includes('await initSucursalSelector'),
        hasImport: content.includes("import { initSucursalSelector"),
        hasOrphanDiv: /<\/header>\s*\n\s*<\/div>\s*\n/.test(content) ||
            /sucursal-selector-container.*\n.*<\/div>\s*\n\s*<\/div>\s*\n/.test(content)
    };

    const status = {
        container: checks.hasContainer ? '✅' : '❌',
        wrapper: checks.hasWrapper ? '✅' : '❌',
        init: checks.hasInitCall ? '✅' : '❌',
        import: checks.hasImport ? '✅' : '❌',
        clean: !checks.hasOrphanDiv ? '✅' : '⚠️'
    };

    const hasIssue = !checks.hasContainer || !checks.hasWrapper ||
        !checks.hasInitCall || !checks.hasImport || checks.hasOrphanDiv;

    if (hasIssue) {
        issues.push(file);
        console.log(`❗ ${file}`);
        console.log(`   Container: ${status.container} | Wrapper: ${status.wrapper} | Init: ${status.init} | Import: ${status.import} | Clean: ${status.clean}`);
    } else {
        console.log(`✅ ${file}`);
    }
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${files.length} archivos`);
console.log(`Con problemas: ${issues.length}`);

if (issues.length > 0) {
    console.log(`\n⚠️ Archivos que necesitan revisión:`);
    issues.forEach(f => console.log(`   - ${f}`));
}
