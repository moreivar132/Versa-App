/**
 * Script Node.js para estandarizar COMPLETAMENTE el selector de sucursal
 * Ejecutar: node scripts/standardize-selector.cjs
 */

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

const PAGES = [
    'manager-taller-fidelizacion.html',
    'manager-marketing-email.html',
    'manager-taller-configuracion.html',
    'manager-taller-marketplace.html',
    'manager-taller-facturas.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-ventas.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-compras-historial.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-config-ordenes.html',
    'manager-taller-caja.html',
    'manager-taller-trabajadores.html'
];

// Estructura HTML estándar - centrada
const STANDARD_SELECTOR = `
                <!-- Selector de Sucursal Estandarizado -->
                <div class="sucursal-selector-wrapper">
                  <div id="sucursal-selector-container"></div>
                </div>
`;

PAGES.forEach(page => {
    const filepath = path.join(frontendDir, page);

    if (!fs.existsSync(filepath)) {
        console.log(`SKIP: ${page} no existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    console.log(`Procesando: ${page}`);

    // 1. Eliminar TODAS las ocurrencias de contenedores mal ubicados
    // Eliminar líneas que contienen estos patrones
    const linesToRemove = [
        /.*sucursal-selector-wrapper.*/g,
        /.*<div id="sucursal-selector-container">.*/g,
        /.*<!-- Selector de Sucursal.*-->.*/g
    ];

    linesToRemove.forEach(pattern => {
        content = content.replace(pattern, '');
    });

    // 2. Limpiar líneas vacías múltiples
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    // 3. Encontrar el punto de inserción correcto
    // Después del mobile header y el inicio del main content
    // Buscar el patrón: </header> seguido de <main...>

    // Patrón común: después de mobile-menu-btn header
    const mainPattern = /<main[^>]*>/;
    const match = content.match(mainPattern);

    if (match) {
        // Insertar el selector JUSTO después de <main...>
        const insertPoint = match.index + match[0].length;
        content = content.slice(0, insertPoint) + STANDARD_SELECTOR + content.slice(insertPoint);
        console.log(`  -> Selector agregado después de <main>`);
    } else {
        console.log(`  -> ERROR: No se encontró <main>`);
    }

    // 4. Guardar el archivo
    fs.writeFileSync(filepath, content, 'utf8');

    // 5. Verificar
    const count = (content.match(/sucursal-selector-container/g) || []).length;
    console.log(`  -> Verificación: ${count} ocurrencias`);
});

console.log('\n=== Resumen Final ===');
PAGES.forEach(page => {
    const filepath = path.join(frontendDir, page);
    if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');
        const count = (content.match(/sucursal-selector-container/g) || []).length;
        console.log(`${page}: ${count > 0 ? '✓' : '✗'} (${count})`);
    }
});
