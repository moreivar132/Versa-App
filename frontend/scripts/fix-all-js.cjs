/**
 * Script para corregir el patrón de JS incorrecto en TODAS las páginas
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const frontendDir = path.join(__dirname, '..');

// Buscar todos los HTML
const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

// Patrón incorrecto (variaciones)
const BAD_PATTERNS = [
    // Patrón 1: async sin await initSucursalSelector
    /\(async \(\) => \{\s*onchange: async \(nuevaSucursalId\) => \{[\s\S]*?\}\s*\}\);?\s*\}\)\s*\(\);?/g,
    // Patrón 2: similar pero con formato diferente
    /\(async \(\) => \{\s+onchange: async \(nuevaSucursalId\) => \{[^}]*\}[^}]*\}\);?\s*\}\)\(\);?/g,
];

// JS correcto
const CORRECT_JS = `(async () => {
      await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
          console.log('Sucursal cambiada:', nuevaSucursalId);
          location.reload();
        }
      });
    })();`;

let fixed = 0;

files.forEach(file => {
    const filepath = path.join(frontendDir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    let originalContent = content;

    // Buscar el patrón incorrecto específico
    // El problema: tiene onchange: sin await initSucursalSelector antes
    const badPattern = /\(async \(\) => \{[\s\n]*onchange:/;

    if (badPattern.test(content)) {
        console.log(`Encontrado patrón incorrecto en: ${file}`);

        // Buscar y reemplazar el bloque completo
        const blockPattern = /<script type="module">\s*import \{ initSucursalSelector[\s\S]*?onchange:[\s\S]*?\}\);?\s*\}\)\s*\(\);?\s*<\/script>/g;

        const matches = content.match(blockPattern);
        if (matches) {
            matches.forEach(match => {
                const replacement = `<script type="module">
    import { initSucursalSelector, getCurrentSucursalId } from '/services/sucursal-selector.js';
    
    (async () => {
      await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
          console.log('Sucursal cambiada:', nuevaSucursalId);
          location.reload();
        }
      });
    })();
  </script>`;
                content = content.replace(match, replacement);
            });
        }

        if (content !== originalContent) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`  ✓ Corregido: ${file}`);
            fixed++;
        }
    }
});

console.log(`\nTotal corregidos: ${fixed}`);
