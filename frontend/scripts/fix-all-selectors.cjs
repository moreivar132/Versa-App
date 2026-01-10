/**
 * Script para corregir los selectores de sucursal en todos los archivos
 * 
 * Ejecutar: node scripts/fix-all-selectors.cjs
 */

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

// Archivos que necesitan el wrapper agregado
const needsWrapper = [
    'manager-taller-chat.html',
    'manager-taller-citas.html',
    'manager-taller-clientes.html',
    'manager-taller-compras.html',
    'manager-taller-config-facturas.html',
    'manager-taller-facturas-pendientes.html',
    'manager-taller-inventario-nuevo.html',
    'manager-taller-inventario.html',
    'manager-taller-ordenes-lista.html',
    'manager-taller-ordenes.html',
    'manager-taller-proveedores.html',
    'manager-taller-vehiculos.html'
];

// Archivos que necesitan init agregado
const needsInit = [
    'manager-taller-compras-historial.html'
];

// Archivos que necesitan container
const needsContainer = [
    'manager-taller-whatsapp.html'
];

console.log('🔧 Corrigiendo selectores de sucursal...\n');

// 1. Agregar wrapper a los que lo necesitan
needsWrapper.forEach(file => {
    const filepath = path.join(frontendDir, file);
    if (!fs.existsSync(filepath)) {
        console.log(`⏭️ ${file}: No existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    // Buscar el container sin wrapper y agregar wrapper
    if (content.includes('id="sucursal-selector-container"') && !content.includes('sucursal-selector-wrapper')) {
        // Patrón: <div id="sucursal-selector-container"></div> sin wrapper
        content = content.replace(
            /<div id="sucursal-selector-container"><\/div>/g,
            `<div class="sucursal-selector-wrapper">\n                  <div id="sucursal-selector-container"></div>\n                </div>`
        );
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${file}: Wrapper agregado`);
    } else {
        console.log(`⏭️ ${file}: Ya tiene wrapper o no tiene container`);
    }
});

// 2. Agregar init a los que lo necesitan
needsInit.forEach(file => {
    const filepath = path.join(frontendDir, file);
    if (!fs.existsSync(filepath)) {
        console.log(`⏭️ ${file}: No existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    if (!content.includes('await initSucursalSelector')) {
        // Agregar el script antes de </body>
        const initScript = `
  <script type="module">
    import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';
    
    (async () => {
      await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
          console.log('Sucursal cambiada:', nuevaSucursalId);
          location.reload();
        }
      });
    })();
  </script>
`;
        content = content.replace('</body>', initScript + '</body>');
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${file}: Init agregado`);
    } else {
        console.log(`⏭️ ${file}: Ya tiene init`);
    }
});

// 3. Agregar container a los que lo necesitan
needsContainer.forEach(file => {
    const filepath = path.join(frontendDir, file);
    if (!fs.existsSync(filepath)) {
        console.log(`⏭️ ${file}: No existe`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf8');

    if (!content.includes('id="sucursal-selector-container"')) {
        // Buscar el punto de inserción después de <main
        const mainMatch = content.match(/<main[^>]*>/);
        if (mainMatch) {
            const insertionPoint = content.indexOf(mainMatch[0]) + mainMatch[0].length;
            const containerHtml = `
                <!-- Selector de Sucursal Estandarizado -->
                <div class="sucursal-selector-wrapper">
                  <div id="sucursal-selector-container"></div>
                </div>
`;
            content = content.slice(0, insertionPoint) + containerHtml + content.slice(insertionPoint);
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`✅ ${file}: Container agregado`);
        } else {
            console.log(`⚠️ ${file}: No se encontró <main> para insertar container`);
        }
    } else {
        console.log(`⏭️ ${file}: Ya tiene container`);
    }
});

console.log('\n✅ Proceso completado');
console.log('Ejecuta node scripts/validate-selectors.cjs para verificar');
