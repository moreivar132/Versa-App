// Script simple para agregar selector de sucursal
const fs = require('fs');
const path = require('path');

const files = [
    'manager-taller-ventas.html',
    'manager-taller-caja.html',
    'manager-taller-configuracion.html',
    'manager-taller-marketplace.html',
    'manager-taller-fidelizacion.html',
    'manager-taller-trabajadores.html',
    'manager-taller-facturas.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-compras-historial.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-config-ordenes.html',
    'manager-marketing-email.html'
];

const selectorHTML = `
                    <!-- Selector de Sucursal -->
                    <div class="sucursal-selector-wrapper mb-6">
                      <div id="sucursal-selector-container"></div>
                    </div>
`;

files.forEach(file => {
    const filepath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filepath)) {
        console.log(`SKIP: ${file} no existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    if (content.includes('sucursal-selector-container')) {
        console.log(`SKIP: ${file} ya tiene selector`);
        return;
    }

    // Buscar patrones comunes para insertar el selector
    const patterns = [
        { search: '<!-- Header Actions -->', replace: selectorHTML + '\n                    <!-- Header Actions -->' },
        { search: /<div class="mx-auto max-w-7xl[^>]*>/g, after: true },
        { search: /<main[^>]*>\s*<div[^>]*>/g, after: true }
    ];

    let modified = false;

    // Intentar primer patrón (Header Actions)
    if (content.includes('<!-- Header Actions -->')) {
        content = content.replace('<!-- Header Actions -->', selectorHTML + '\n                    <!-- Header Actions -->');
        modified = true;
    }
    // Intentar segundo patrón (max-w-7xl)
    else if (content.match(/<div class="mx-auto max-w-7xl[^>]*>/)) {
        content = content.replace(/<div class="mx-auto max-w-7xl[^>]*>/, match => match + selectorHTML);
        modified = true;
    }
    // Intentar tercer patrón (después del header de página)
    else if (content.includes('</header>')) {
        const headerEnd = content.lastIndexOf('</header>');
        const insertPoint = headerEnd + '</header>'.length;
        content = content.slice(0, insertPoint) + '\n' + selectorHTML + content.slice(insertPoint);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`OK: ${file}`);
    } else {
        console.log(`FAIL: ${file} - no se encontró patrón`);
    }
});
