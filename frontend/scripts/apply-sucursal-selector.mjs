/**
 * Script para aplicar el selector de sucursal estándar a todas las páginas pendientes
 * Ejecutar: node apply-sucursal-selector.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    const containerPattern = /<div id="sucursal-container"[\s\S]*?<\/div>/g;
    if (containerPattern.test(content)) {
        content = content.replace(containerPattern, '<div id="sucursal-selector-container"></div>');
        cambios++;
    }

    // 3. Agregar import si no existe
    if (!content.includes('initSucursalSelector')) {
        content = content.replace(
            /(<script type="module">[\s\S]*?import[^;]+from[^;]+;)/,
            `$1\n        import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';`
        );
        cambios++;
    }

    // 4. Eliminar función loadSucursales antigua
    const loadSucursalesPattern = /async function loadSucursales\(\)[\s\S]*?catch[\s\S]*?\}\s*\}/;
    if (loadSucursalesPattern.test(content)) {
        content = content.replace(loadSucursalesPattern, '// Sucursal gestionada por initSucursalSelector');
        cambios++;
    }

    // 5. Eliminar llamadas a loadSucursales()
    content = content.replace(/await loadSucursales\(\);?\s*/g, '');
    content = content.replace(/loadSucursales\(\);?\s*/g, '');

    // 6. Eliminar variables antiguas
    content = content.replace(/let currentSucursalId = null;?\s*/g, '');
    content = content.replace(/let puedeSeleccionarSucursal = false;?\s*/g, '');
    content = content.replace(/const SUCURSAL_STORAGE_KEY = ['"]versa_selected_sucursal['"];?\s*/g, '');

    if (cambios > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${filename} - ${cambios} cambios`);
        return true;
    } else {
        console.log(`⏭️  ${filename} - Sin cambios`);
        return false;
    }
}

console.log('🔄 Aplicando selector de sucursal estándar...\n');

let procesadas = 0;
paginas.forEach(p => {
    if (procesarPagina(p)) procesadas++;
});

console.log(`\n✅ Completado: ${procesadas}/${paginas.length} páginas modificadas`);
