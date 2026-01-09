#!/bin/bash
# Script para estandarizar COMPLETAMENTE el selector de sucursal
# El selector debe ir justo después del <main> y antes del contenido

PAGES=(
  "manager-taller-fidelizacion.html"
  "manager-marketing-email.html"
  "manager-taller-configuracion.html"
  "manager-taller-marketplace.html"
  "manager-taller-facturas.html"
  "manager-taller-cuentas-corrientes.html"
  "manager-taller-ventas.html"
  "manager-taller-ventas-historial.html"
  "manager-taller-compras-historial.html"
  "manager-taller-historial-unificado.html"
  "manager-taller-config-ordenes.html"
  "manager-taller-caja.html"
  "manager-taller-trabajadores.html"
)

# Estructura HTML estándar - debe ir DESPUÉS de <main...> y ANTES del contenido de la página
STANDARD_SELECTOR='
                <!-- Selector de Sucursal Estandarizado -->
                <div class="sucursal-selector-wrapper">
                  <div id="sucursal-selector-container"></div>
                </div>
'

for PAGE in "${PAGES[@]}"; do
  if [ ! -f "$PAGE" ]; then
    echo "SKIP: $PAGE no existe"
    continue
  fi
  
  echo "Procesando: $PAGE"
  
  # 1. Eliminar TODOS los contenedores de selector mal ubicados
  # Esto elimina cualquier variación del contenedor
  sed -i '/sucursal-selector-wrapper/d' "$PAGE"
  sed -i '/sucursal-selector-container/d' "$PAGE"
  sed -i '/<!-- Selector de Sucursal/d' "$PAGE"
  
  # 2. Limpiar líneas vacías dobles
  sed -i '/^[[:space:]]*$/N;/^\n$/d' "$PAGE"
  
  # 3. Agregar el selector estándar después del mobile header (después de </header> que tiene mobile-menu-btn)
  # Buscamos el patrón común de las páginas
  
  # Opción A: Después de mobile header (</header> seguido de <main)
  if grep -q 'mobile-menu-btn' "$PAGE"; then
    # Agregar después del cierre del header mobile, antes del main
    sed -i '/<\/header>/,/<main/{
      /<main/,/^/{
        s|<main\([^>]*\)>|<main\1>'"$STANDARD_SELECTOR"'|
      }
    }' "$PAGE"
  fi
  
  # Verificar si se agregó
  if grep -q 'sucursal-selector-container' "$PAGE"; then
    echo "  -> OK"
  else
    echo "  -> Agregando manualmente..."
    # Fallback: agregar después de cualquier <main
    sed -i 's|<main\([^>]*\)>|<main\1>'"$STANDARD_SELECTOR"'|' "$PAGE"
    
    if grep -q 'sucursal-selector-container' "$PAGE"; then
      echo "  -> OK (fallback)"
    else
      echo "  -> FALLO"
    fi
  fi
done

echo ""
echo "Verificación final:"
for PAGE in "${PAGES[@]}"; do
  if [ -f "$PAGE" ]; then
    COUNT=$(grep -c 'sucursal-selector-container' "$PAGE" 2>/dev/null || echo "0")
    echo "$PAGE: $COUNT ocurrencias"
  fi
done
