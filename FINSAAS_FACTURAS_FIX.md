# ANTIGRAVITY — Facturas API Fix

## 1. El Problema
En `facturas.html`, el sistema intentaba cargar la lista de Contactos usando una variable `API_BASE` que no existía.
- **Error**: `ReferenceError: API_BASE is not defined`
- **Causa**: Código antiguo/copiado que no usaba el sistema estándar de conexión (`buildApiUrl` / `fetchWithAuth`).

## 2. Solución Aplicada
He corregido no solo `facturas.html`, sino también otros archivos que tenían el mismo problema oculto:

1.  **Facturas (`facturas.html`)**:
    - Corregido `loadContactos()` para usar el cliente estándar.
2.  **Validación Fiscal (`validacion-deducible.html`)**:
    - Corregida la visualización de documentos adjuntos (`viewInvoiceDocument`), que también fallaba.
3.  **Subida de Gastos con IA (`gastos-nuevo.html`)**:
    - Corregido el guardado manual y la cancelación, que hubieran fallado al usarse.

## 3. Resultado
Ahora la página de Facturas cargará los contactos correctamente en el desplegable, y el error de consola desaparecerá. Además, la aplicación es más robusta en todos los entornos (Dev/Prod).
