// Script definitivo para agregar selector de sucursal
const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

const files = [
    'manager-taller-caja.html',
    'manager-taller-configuracion.html',
    'manager-taller-marketplace.html',
    'manager-taller-fidelizacion.html',
    'manager-taller-facturas.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-config-ordenes.html',
    'manager-marketing-email.html'
];

const selectorDiv = `
                <!-- Selector de Sucursal -->
                <div class="sucursal-selector-wrapper mb-6">
                  <div id="sucursal-selector-container"></div>
                </div>
`;

files.forEach(file => {
    const filepath = path.join(frontendDir, file);

    if (!fs.existsSync(filepath)) {
        console.log(`SKIP: ${file} no existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    if (content.includes('sucursal-selector-container')) {
        console.log(`SKIP: ${file} ya tiene selector`);
        return;
    }

    // Buscar el cierre del header principal y el siguiente elemento
    // Patrón: </header> seguido de cualquier espacio y luego un <div
    const pattern = /([ \t]*<\/header>\s*\n\s*\n?)([ \t]*)(<div )/;

    if (pattern.test(content)) {
        content = content.replace(pattern, (match, p1, p2, p3) => {
            return p1 + selectorDiv + '\n' + p2 + p3;
        });
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`OK: ${file}`);
    } else {
        // Intentar otro patrón: después de </header> directamente
        const pattern2 = /([ \t]*<\/header>)/g;
        const matches = [...content.matchAll(pattern2)];

        if (matches.length > 0) {
            // Usar el último </header> encontrado
            const lastMatch = matches[matches.length - 1];
            const insertPos = lastMatch.index + lastMatch[0].length;
            content = content.slice(0, insertPos) + '\n' + selectorDiv + content.slice(insertPos);
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`OK: ${file} (después del último header)`);
        } else {
            console.log(`FAIL: ${file} - no se encontró patrón`);
        }
    }
});
