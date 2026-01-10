#!/bin/bash
# Script para agregar inicialización del selector de sucursal

FRONTEND_DIR="$(dirname "$0")/.."

# Páginas que necesitan la inicialización
PAGES=(
  "manager-taller-caja.html"
  "manager-taller-configuracion.html"
  "manager-taller-marketplace.html"
  "manager-taller-fidelizacion.html"
  "manager-taller-facturas.html"
  "manager-taller-cuentas-corrientes.html"
  "manager-taller-ventas-historial.html"
  "manager-taller-historial-unificado.html"
  "manager-taller-config-ordenes.html"
  "manager-marketing-email.html"
  "manager-taller-ventas.html"
)

# HTML del contenedor
CONTAINER='<!-- Selector de Sucursal -->\n                <div class="sucursal-selector-wrapper mb-6">\n                  <div id="sucursal-selector-container"><\/div>\n                <\/div>\n'

# Script de inicialización
INIT_SCRIPT='
  <script type="module">
    import { initSucursalSelector, getCurrentSucursalId } from '"'"'/services/sucursal-selector.js'"'"';
    
    (async () => {
      await initSucursalSelector('"'"'sucursal-selector-container'"'"', {
        onchange: async (nuevaSucursalId) => {
          console.log('"'"'Sucursal cambiada:'"'"', nuevaSucursalId);
          location.reload();
        }
      });
    })();
  <\/script>
<\/body>'

for PAGE in "${PAGES[@]}"; do
  FILE="$FRONTEND_DIR/$PAGE"
  
  if [ ! -f "$FILE" ]; then
    echo "SKIP: $PAGE no existe"
    continue
  fi
  
  # Verificar si ya tiene el contenedor
  if grep -q "sucursal-selector-container" "$FILE"; then
    echo "TIENE CONTAINER: $PAGE"
  else
    # Agregar contenedor después del primer </header>
    sed -i 's/<\/header>/<\/header>\n'"$CONTAINER"'/' "$FILE"
    echo "AGREGADO CONTAINER: $PAGE"
  fi
  
  # Verificar si ya tiene inicialización
  if grep -q "await initSucursalSelector" "$FILE"; then
    echo "TIENE INIT: $PAGE"
  else
    # Agregar script de inicialización antes de </body>
    sed -i 's/<\/body>/'"$INIT_SCRIPT"'/' "$FILE"
    echo "AGREGADO INIT: $PAGE"
  fi
  
  echo "---"
done

echo "Completado!"
