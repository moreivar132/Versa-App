#!/bin/bash
# Script final para agregar inicialización

FRONTEND_DIR="$(dirname "$0")/.."

PAGES=(
  "manager-taller-configuracion.html"
  "manager-taller-historial-unificado.html"
  "manager-taller-facturas.html"
  "manager-taller-citas.html"
)

for PAGE in "${PAGES[@]}"; do
  FILE="$FRONTEND_DIR/$PAGE"
  
  if [ ! -f "$FILE" ]; then
    echo "SKIP: $PAGE"
    continue
  fi
  
  if grep -q "await initSucursalSelector" "$FILE"; then
    echo "YA TIENE: $PAGE"
    continue
  fi
  
  # Verificar que tiene el contenedor
  if ! grep -q "sucursal-selector-container" "$FILE"; then
    echo "SIN CONTAINER: $PAGE"
    continue
  fi
  
  sed -i 's|</body>|  <script type="module">\n    import { initSucursalSelector } from '"'"'/services/sucursal-selector.js'"'"';\n    (async () => {\n      await initSucursalSelector('"'"'sucursal-selector-container'"'"', {\n        onchange: () => location.reload()\n      });\n    })();\n  </script>\n</body>|' "$FILE"
  
  echo "AGREGADO: $PAGE"
done

echo "Completado!"
