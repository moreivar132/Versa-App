#!/bin/bash
# Verificar estado de todas las páginas del usuario
for f in manager-taller-configuracion.html manager-taller-marketplace.html manager-taller-fidelizacion.html manager-taller-trabajadores.html manager-taller-facturas.html manager-taller-cuentas-corrientes.html manager-taller-ventas.html manager-taller-ventas-historial.html manager-taller-compras-historial.html manager-taller-historial-unificado.html manager-taller-config-ordenes.html; do
  C=$(grep -c 'sucursal-selector-container' "$f" 2>/dev/null || echo 0)
  I=$(grep -c 'await initSucursalSelector' "$f" 2>/dev/null || echo 0)
  echo "$f: Container=$C Init=$I"
done
