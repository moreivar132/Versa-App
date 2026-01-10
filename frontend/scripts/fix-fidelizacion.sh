#!/bin/bash
# Agregar contenedor a fidelizacion
FILE="manager-taller-fidelizacion.html"

if grep -q '<div id="sucursal-selector-container">' "$FILE"; then
  echo "Ya tiene contenedor"
  exit 0
fi

# Agregar después del <!-- Page Header -->
sed -i 's|<!-- Page Header -->|<!-- Selector de Sucursal -->\
                <div class="sucursal-selector-wrapper mb-6">\
                  <div id="sucursal-selector-container"><\/div>\
                <\/div>\
\
                <!-- Page Header -->|' "$FILE"

echo "Contenedor agregado"
