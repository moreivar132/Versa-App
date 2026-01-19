/**
 * Script para aplicar el selector de sucursal estándar a todas las páginas pendientes
 * Ejecutar: node apply-sucursal-selector.js
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..');

const paginas = [
    'manager-taller-caja.html',
    'manager-taller-citas.html',
    'manager-taller-config-ordenes.html',
    'manager-taller-configuracion.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-facturas.html',
    'manager-taller-fidelizacion.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-marketplace.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-ventas.html',
    'manager-taller-whatsapp.html'
];

function procesarPagina(filename) {
    const filepath = path.join(FRONTEND_DIR, filename);

    if (!fs.existsSync(filepath)) {
        console.log(`⚠️  No existe: ${filename}`);
        return false;
    }

    let content = fs.readFileSync(filepath, 'utf8');
    let cambios = 0;

    // 1. Agregar CSS si no existe
    if (!content.includes('sucursal-selector.css')) {
        content = content.replace(
            /<link rel="stylesheet" href="manager\.css">/,
            '<link rel="stylesheet" href="manager.css">\n    <link rel="stylesheet" href="styles/sucursal-selector.css">'
        );
        cambios++;
    }

    // 2. Reemplazar contenedor manual con el estándar
    // Patrón: <div id="sucursal-container" ...>...</div>
    const containerPattern = /<div id="sucursal-container"[\s\S]*?<\/div>/g;
    if (containerPattern.test(content)) {
        content = content.replace(containerPattern, '<div id="sucursal-selector-container"></div>');
        cambios++;
    }

    // 3. Agregar import si no existe
    if (!content.includes('initSucursalSelector')) {
        // Buscar primer import en script type="module"
        content = content.replace(
            /(<script type="module">[\s\S]*?import[^;]+;)/,
            `$1\n        import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';`
        );
        cambios++;
    }

    // 4. Eliminar función loadSucursales antigua (patrón simplificado)
    const loadSucursalesPattern = /async function loadSucursales\(\)[\s\S]*?catch[\s\S]*?\}\s*\}/;
    if (loadSucursalesPattern.test(content)) {
        content = content.replace(loadSucursalesPattern, '// Sucursal gestionada por initSucursalSelector');
        cambios++;
    }

    // 5. Reemplazar llamadas a loadSucursales()
    content = content.replace(/await loadSucursales\(\);?\s*/g, '');
    content = content.replace(/loadSucursales\(\);?\s*/g, '');

    // 6. Eliminar variables antiguas
    content = content.replace(/let currentSucursalId = null;?\s*/g, '');
    content = content.replace(/let puedeSeleccionarSucursal = false;?\s*/g, '');
    content = content.replace(/const SUCURSAL_STORAGE_KEY = ['"]versa_selected_sucursal['"];?\s*/g, '');

    // 7. Reemplazar referencias a currentSucursalId (si aún existen)
    // Esto es más delicado, solo lo hacemos en contextos seguros
    content = content.replace(/if \(currentSucursalId\)/g, 'const _sucId = getCurrentSucursalId(); if (_sucId)');
    content = content.replace(/currentSucursalId(?=[,\s\)])/g, 'getCurrentSucursalId()');

    if (cambios > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${filename} - ${cambios} cambios aplicados`);
        return true;
    } else {
        console.log(`⏭️  ${filename} - Sin cambios necesarios`);
        return false;
    }
}

console.log('🔄 Aplicando selector de sucursal estándar...\n');

let procesadas = 0;
paginas.forEach(p => {
    if (procesarPagina(p)) procesadas++;
});

console.log(`\n✅ Completado: ${procesadas}/${paginas.length} páginas modificadas`);
console.log('\n⚠️  IMPORTANTE: Revisa manualmente las páginas para:');
console.log('   - Agregar inicialización del selector si falta');
console.log('   - Ajustar callbacks onchange según la lógica de cada página');
