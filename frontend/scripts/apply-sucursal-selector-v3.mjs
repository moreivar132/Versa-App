/**
 * Script definitivo para agregar selector de sucursal
 * Este script agrega el contenedor HTML y la inicialización
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, '..');

const paginas = [
    'manager-taller-configuracion.html',
    'manager-marketing-email.html',
    'manager-taller-marketplace.html',
    'manager-taller-fidelizacion.html',
    'manager-taller-trabajadores.html',
    'manager-taller-facturas.html',
    'manager-taller-cuentas-corrientes.html',
    'manager-taller-ventas.html',
    'manager-taller-ventas-historial.html',
    'manager-taller-compras-historial.html',
    'manager-taller-historial-unificado.html',
    'manager-taller-config-ordenes.html',
    'manager-taller-caja.html'
];

const CONTAINER_HTML = `
        <!-- Selector de Sucursal Estandarizado -->
        <div class="sucursal-selector-wrapper">
          <div id="sucursal-selector-container"></div>
        </div>
`;

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
            /(<link rel="stylesheet" href="manager\.css"[^>]*>)/,
            '$1\n    <link rel="stylesheet" href="styles/sucursal-selector.css">'
        );
        cambios++;
        console.log(`  + CSS`);
    }

    // 2. Agregar contenedor HTML si no existe
    if (!content.includes('sucursal-selector-container')) {
        // Buscar después del header mobile o después de <main
        // Patrón 1: después del header con mobile-menu-btn
        const headerMobilePattern = /(<header[^>]*>[\s\S]*?mobile-menu-btn[\s\S]*?<\/header>)/;
        // Patrón 2: después de un header con título de página
        const headerTitlePattern = /(<header[^>]*class="mb-8[^>]*>[\s\S]*?<\/header>)/;
        // Patrón 3: al inicio del main
        const mainPattern = /(<main[^>]*>[\s]*<div[^>]*>)/;

        if (headerMobilePattern.test(content)) {
            content = content.replace(headerMobilePattern, '$1\n' + CONTAINER_HTML);
            cambios++;
            console.log(`  + Container (after mobile header)`);
        } else if (headerTitlePattern.test(content)) {
            content = content.replace(headerTitlePattern, '$1\n' + CONTAINER_HTML);
            cambios++;
            console.log(`  + Container (after title header)`);
        } else if (mainPattern.test(content)) {
            content = content.replace(mainPattern, '$1\n' + CONTAINER_HTML);
            cambios++;
            console.log(`  + Container (after main)`);
        } else {
            // Fallback: buscar </header> y agregar después
            const anyHeaderPattern = /(<\/header>)/;
            if (anyHeaderPattern.test(content)) {
                content = content.replace(anyHeaderPattern, '$1\n' + CONTAINER_HTML);
                cambios++;
                console.log(`  + Container (after any header)`);
            }
        }
    }

    // 3. Verificar que tiene initSucursalSelector import
    if (!content.includes('initSucursalSelector')) {
        // Buscar script type="module" inline (no src)
        const scriptModuleInline = /<script type="module">(?!\s*<\/script>)/;
        const scriptModuleSrc = /<script type="module" src=/;

        if (scriptModuleInline.test(content)) {
            content = content.replace(
                scriptModuleInline,
                `<script type="module">\n    import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';`
            );
            cambios++;
            console.log(`  + Import (in existing module)`);
        } else {
            // Agregar script completo antes de </body>
            const initScript = `
  <script type="module">
    import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';
    
    (async () => {
      await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
          console.log('Sucursal cambiada:', nuevaSucursalId);
          location.reload(); // Recargar página al cambiar sucursal
        }
      });
    })();
  </script>`;
            content = content.replace('</body>', initScript + '\n</body>');
            cambios++;
            console.log(`  + Full script module`);
        }
    }

    if (cambios > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${filename} - ${cambios} cambios\n`);
        return true;
    } else {
        console.log(`⏭️  ${filename} - Ya tiene todo\n`);
        return false;
    }
}

console.log('🔄 Agregando selector de sucursal (v3 - definitivo)...\n');

let procesadas = 0;
paginas.forEach(p => {
    console.log(`📄 ${p}`);
    if (procesarPagina(p)) procesadas++;
});

console.log(`\n✅ Completado: ${procesadas}/${paginas.length} páginas modificadas`);
