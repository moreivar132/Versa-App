# DEV PROXY FIX REPORT

## 1. Causa Raíz
Status: **IDENTIFICADO**

El proxy `/api/*` en el entorno DEV (`versadev.netlify.app`) estaba configurado incorrectamente en la fuente de verdad.

*   **Archivo**: `frontend/public/_redirects`
*   **Problema**: Las reglas de redirección apuntaban explícitamente al backend de **PRODUCCIÓN** (`versa-app.up.railway.app`).
*   **Impacto**:
    1.  Las peticiones a `/api/health` devolvían **404** porque el backend de producción no respondía correctamente a esa ruta (o no existe en prod).
    2.  El preview de PDF fallaba porque intentaba buscar documentos en el backend de producción (donde no existen los datos de prueba de DEV) o fallaba la autenticación cruzada.

## 2. Cambios Realizados

Se modificó el archivo `frontend/public/_redirects` para apuntar al backend de **DEV**.

**Archivo:** `frontend/public/_redirects`

| Línea | Antes (PROD) | Ahora (DEV) |
|---|---|---|
| 1 | `/api/* https://versa-app.up.railway.app/api/:splat 200` | `/api/* **https://versa-app-dev.up.railway.app**/api/:splat 200` |
| 2 | `/uploads/* https://versa-app.up.railway.app/uploads/:splat 200` | `/uploads/* **https://versa-app-dev.up.railway.app**/uploads/:splat 200` |

> **Nota**: `netlify.toml` ya estaba configurado correctamente con `publish = "dist"`, por lo que Vite copiará este archivo `_redirects` actualizado a la carpeta de salida al hacer build.

## 3. Evidencias y Validación

### Validación Previa (Diagnóstico)
*   `https://versadev.netlify.app/api/health` -> **404 Not Found** (Confirmado)
*   `https://versa-app.up.railway.app/api/health` (Target anterior) -> **404 Not Found** (El proxy funcionaba, pero el destino era incorrecto)
*   `https://versa-app-dev.up.railway.app/api/health` (Target nuevo) -> **200 OK** `{"ok":true...}` (Confirmado acceso al backend DEV)

### Validación Esperada (Post-Deploy)
Al desplegar estos cambios a Netlify (rama `ivan` o `dev`):
1.  **V1 Health**: `https://versadev.netlify.app/api/health` devolverá **200** (proxied desde Railway DEV).
2.  **V2 PDF Preview**: Los documentos se cargarán correctamente ya que la petición `/api/contabilidad/documentos/...` será redirigida al backend que contiene los datos (DEV).

---
** Estado Final:** LISTO PARA DEPLOY
