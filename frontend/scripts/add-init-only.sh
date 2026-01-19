#!/bin/bash
# Script para agregar SOLO la inicialización del selector a las páginas que faltan

FRONTEND_DIR="$(dirname "$0")/.."

# Páginas que FALTAN la inicialización
PAGES=(
  "manager-taller-caja.html"
  "manager-taller-config-ordenes.html"
  "manager-taller-ventas-historial.html"
)

for PAGE in "${PAGES[@]}"; do
  FILE="$FRONTEND_DIR/$PAGE"
  
  if [ ! -f "$FILE" ]; then
    echo "SKIP: $PAGE no existe"
    continue
  fi
  
  # Verificar si ya tiene inicialización
  if grep -q "await initSucursalSelector" "$FILE"; then
    echo "YA TIENE: $PAGE"
    continue
  fi
  
  # Agregar script de inicialización antes de </body>
  sed -i 's|</body>|  <script type="module">\n    import { initSucursalSelector } from '"'"'/services/sucursal-selector.js'"'"';\n    (async () => {\n      await initSucursalSelector('"'"'sucursal-selector-container'"'"', {\n        onchange: () => location.reload()\n      });\n    })();\n  </script>\n</body>|' "$FILE"
  
  echo "AGREGADO: $PAGE"
done

echo "Completado!"
