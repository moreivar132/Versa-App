/**
 * Script mejorado para aplicar el selector de sucursal estándar
 * Ejecutar: node apply-sucursal-selector-v2.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, '..');

const paginas = [
    'manager-taller-citas.html',
    'manager-taller-fidelizacion.html',
    'manager-taller-marketplace.html',
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
            /<link rel="stylesheet" href="manager\.css".*?>/,
            '<link rel="stylesheet" href="manager.css">\n    <link rel="stylesheet" href="styles/sucursal-selector.css">'
        );
        cambios++;
        console.log(`  + CSS agregado`);
    }

    // 2. Agregar import si no existe
    if (!content.includes('initSucursalSelector')) {
        // Buscar script type="module" y agregar import después de la apertura
        const scriptModulePattern = /<script type="module">/;
        if (scriptModulePattern.test(content)) {
            content = content.replace(
                /<script type="module">/,
                `<script type="module">\n        import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';`
            );
            cambios++;
            console.log(`  + Import agregado`);
        } else {
            // Si no tiene script module, agregar uno antes de </body>
            const importBlock = `
  <script type="module">
    import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';
    
    // Inicializar selector de sucursal estándar
    (async () => {
      await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
          console.log('Sucursal cambiada:', nuevaSucursalId);
          // Recargar datos si es necesario
        }
      });
    })();
  </script>`;
            content = content.replace('</body>', importBlock + '\n</body>');
            cambios++;
            console.log(`  + Script module completo agregado`);
        }
    }

    // 3. Agregar contenedor si no existe
    if (!content.includes('sucursal-selector-container')) {
        // Buscar main y agregar después de <main...>
        const mainPattern = /<main[^>]*>/;
        const match = content.match(mainPattern);
        if (match) {
            const replacement = `${match[0]}
        <!-- Selector de Sucursal Estandarizado -->
        <div class="sucursal-selector-wrapper">
          <div id="sucursal-selector-container"></div>
        </div>`;
            content = content.replace(mainPattern, replacement);
            cambios++;
            console.log(`  + Contenedor HTML agregado`);
        }
    }

    if (cambios > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${filename} - ${cambios} cambios\n`);
        return true;
    } else {
        console.log(`⏭️  ${filename} - Sin cambios\n`);
        return false;
    }
}

console.log('🔄 Aplicando selector de sucursal estándar (v2)...\n');

let procesadas = 0;
paginas.forEach(p => {
    console.log(`📄 Procesando: ${p}`);
    if (procesarPagina(p)) procesadas++;
});

console.log(`\n✅ Completado: ${procesadas}/${paginas.length} páginas modificadas`);
