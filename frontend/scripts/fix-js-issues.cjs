/**
 * Script para LIMPIAR y VERIFICAR el selector de sucursal
 * Arregla problemas conocidos de JS mal formado
 */

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

const PAGES = [
    'manager-taller-configuracion.html',
    'manager-taller-marketplace.html',
    'manager-taller-facturas.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-compras-historial.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-config-ordenes.html',
    'manager-taller-caja.html',
    'manager-taller-citas.html'
];

// Patrón incorrecto de JS
const BAD_JS_PATTERN = /\(async \(\) => \{\s*onchange: async \(nuevaSucursalId\) => \{[\s\S]*?\}\s*\}\);\s*\}\) \(\);/g;

// JS correcto
const CORRECT_JS = `(async () => {
            await initSucursalSelector('sucursal-selector-container', {
                onchange: async (nuevaSucursalId) => {
                    console.log('Sucursal cambiada:', nuevaSucursalId);
                    location.reload();
                }
            });
        })();`;

PAGES.forEach(page => {
    const filepath = path.join(frontendDir, page);

    if (!fs.existsSync(filepath)) {
        console.log(`SKIP: ${page} no existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');
    let changed = false;

    // 1. Corregir JS mal formado
    if (BAD_JS_PATTERN.test(content)) {
        content = content.replace(BAD_JS_PATTERN, CORRECT_JS);
        changed = true;
        console.log(`${page}: JS corregido`);
    }

    // 2. Eliminar </div> huérfanos que aparecen entre </header> y <main
    const orphanDivPattern = /(<\/header>\s*\n\s*)\n\s*<\/div>\s*\n(\s*<main)/g;
    if (orphanDivPattern.test(content)) {
        content = content.replace(orphanDivPattern, '$1$2');
        changed = true;
        console.log(`${page}: Div huérfano eliminado`);
    }

    if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`${page}: ✓ Guardado`);
    } else {
        console.log(`${page}: Sin cambios necesarios`);
    }
});
