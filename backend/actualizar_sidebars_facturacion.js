/**
 * Script para actualizar todos los sidebars de los archivos manager-taller
 * Añade los enlaces de facturación al submenu de Cuentas
 */

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..', 'frontend');

// El nuevo contenido del submenu de cuentas
const oldCuentasSubmenu = `<div id="cuentas-submenu" class="hidden flex-col pl-9 gap-1 mt-1">
                                <a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Facturas</a>
                                <a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Gastos</a>
                            </div>`;

const newCuentasSubmenu = `<div id="cuentas-submenu" class="hidden flex-col pl-9 gap-1 mt-1">
                                <a href="manager-taller-facturas.html"
                                    class="text-gray-400 hover:text-white text-sm py-1 block">Facturas</a>
                                <a href="manager-taller-facturas-pendientes.html"
                                    class="text-gray-400 hover:text-white text-sm py-1 block">Pendientes Facturar</a>
                                <a href="manager-taller-config-facturas.html"
                                    class="text-gray-400 hover:text-white text-sm py-1 block">Configuración</a>
                                <a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Gastos</a>
                            </div>`;

// Variaciones del contenido original
const patterns = [
    {
        find: /<div id="cuentas-submenu" class="hidden flex-col pl-9 gap-1 mt-1">\s*<a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Facturas<\/a>\s*<a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Gastos<\/a>\s*<\/div>/g,
        replace: newCuentasSubmenu
    }
];

function updateFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        let changed = false;

        // Verificar si ya tiene los enlaces de facturación
        if (content.includes('manager-taller-facturas.html') &&
            content.includes('manager-taller-facturas-pendientes.html') &&
            content.includes('manager-taller-config-facturas.html')) {
            console.log(`  - ${path.basename(filePath)}: Ya tiene los enlaces de facturación`);
            return false;
        }

        // Buscar y reemplazar el submenu de cuentas
        const regex = /<div id="cuentas-submenu" class="hidden flex-col pl-9 gap-1 mt-1">\s*<a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Facturas<\/a>\s*<a href="#" class="text-gray-500 hover:text-white text-sm py-1 block">Gastos<\/a>\s*<\/div>/g;

        if (regex.test(content)) {
            content = content.replace(regex, newCuentasSubmenu);
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`  ✓ ${path.basename(filePath)}: Actualizado`);
            return true;
        }

        console.log(`  - ${path.basename(filePath)}: Sin cambios (patrón no encontrado)`);
        return false;
    } catch (error) {
        console.error(`  ❌ ${path.basename(filePath)}: Error - ${error.message}`);
        return false;
    }
}

console.log('🔧 Actualizando sidebars con enlaces de facturación...\n');

// Obtener todos los archivos manager-taller*.html
const files = fs.readdirSync(frontendDir).filter(file =>
    file.startsWith('manager-taller') &&
    file.endsWith('.html') &&
    !file.includes('facturas') // Excluir los archivos de facturación ya creados
);

console.log(`Archivos a revisar: ${files.length}\n`);

let updated = 0;
files.forEach(file => {
    const filePath = path.join(frontendDir, file);
    if (updateFile(filePath)) {
        updated++;
    }
});

console.log(`\n✅ Completado: ${updated} archivos actualizados`);
