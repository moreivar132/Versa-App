#!/bin/bash
# Agregar a cuentas-corrientes
sed -i 's|</body>|  <script type="module">\n    import { initSucursalSelector } from '"'"'/services/sucursal-selector.js'"'"';\n    (async () => {\n      await initSucursalSelector('"'"'sucursal-selector-container'"'"', {\n        onchange: () => location.reload()\n      });\n    })();\n  </script>\n</body>|' manager-taller-cuentas-corrientes.html
echo "Done"
