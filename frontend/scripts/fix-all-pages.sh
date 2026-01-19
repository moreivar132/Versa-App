#!/bin/bash
# Verificar y arreglar TODAS las páginas

PAGES=(
  "manager-taller-configuracion.html"
  "manager-taller-marketplace.html"
  "manager-taller-facturas.html"
  "manager-taller-cuentas-corrientes.html"
  "manager-taller-ventas.html"
  "manager-taller-ventas-historial.html"
  "manager-taller-compras-historial.html"
  "manager-taller-historial-unificado.html"
  "manager-taller-config-ordenes.html"
  "manager-marketing-email.html"
)

for PAGE in "${PAGES[@]}"; do
  if [ ! -f "$PAGE" ]; then
    echo "NO EXISTE: $PAGE"
    continue
  fi
  
  HAS_CONTAINER=$(grep -c '<div id="sucursal-selector-container">' "$PAGE" || echo "0")
  HAS_INIT=$(grep -c 'await initSucursalSelector' "$PAGE" || echo "0")
  
  if [ "$HAS_CONTAINER" -gt 0 ] && [ "$HAS_INIT" -gt 0 ]; then
    echo "OK: $PAGE (container=$HAS_CONTAINER, init=$HAS_INIT)"
  else
    echo "FALTA: $PAGE (container=$HAS_CONTAINER, init=$HAS_INIT)"
    
    # Arreglar contenedor si falta
    if [ "$HAS_CONTAINER" -eq 0 ]; then
      # Intentar agregar después de Page Header
      if grep -q '<!-- Page Header -->' "$PAGE"; then
        sed -i 's|<!-- Page Header -->|<!-- Selector de Sucursal -->\
                <div class="sucursal-selector-wrapper mb-6">\
                  <div id="sucursal-selector-container"><\/div>\
                <\/div>\
\
                <!-- Page Header -->|' "$PAGE"
        echo "  -> Contenedor agregado (Page Header)"
      # Intentar después de Header Actions
      elif grep -q '<!-- Header Actions -->' "$PAGE"; then
        sed -i 's|<!-- Header Actions -->|<!-- Selector de Sucursal -->\
                    <div class="sucursal-selector-wrapper mb-6">\
                      <div id="sucursal-selector-container"><\/div>\
                    <\/div>\
\
                    <!-- Header Actions -->|' "$PAGE"
        echo "  -> Contenedor agregado (Header Actions)"
      fi
    fi
    
    # Arreglar init si falta
    if [ "$HAS_INIT" -eq 0 ]; then
      sed -i 's|</body>|  <script type="module">\
    import { initSucursalSelector } from '"'"'/services/sucursal-selector.js'"'"';\
    (async () => {\
      await initSucursalSelector('"'"'sucursal-selector-container'"'"', {\
        onchange: () => location.reload()\
      });\
    })();\
  </script>\
</body>|' "$PAGE"
      echo "  -> Init agregado"
    fi
  fi
done
