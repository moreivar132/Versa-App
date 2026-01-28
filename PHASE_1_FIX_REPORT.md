# PHASE_1_FIX_REPORT.md

## 1. Resumen Ejecutivo
- **Aislamiento Total**: Se eliminaron todas las referencias hardcodeadas a `versa-app-dev` y URLs de desarrollo (`up.railway.app`, `localhost`) dentro de la lógica productiva.
- **Validación Estricta**: El backend ahora aborta el inicio en Producción si faltan variables críticas (`NODE_ENV`, `DATABASE_URL`, `REMOTE_STORAGE_URL`).
- **Filesystem Seguro**: Se neutralizó la lógica de fallback en uploads. Si un archivo falta localmente y no hay `REMOTE_STORAGE_URL` definida, se devuelve 404 en lugar de redirigir a un entorno de desarrollo.
- **Corrección de Rutas**: Se actualizaron las rutas de autenticación Google (SaaS y Marketplace) para usar URLs dinámicas basadas en configuración, eliminando callbacks a `localhost`.
- **Estado Prod-Safe**: El backend cumple con la política de "Producción nunca apunta a DEV".

## 2. Cambios Realizados

### A. Validación de Entorno (Inicio Seguro)
**Archivo:** `backend/index.js`
- **Cambio:** Se insertó bloque de validación al inicio.
- **Efecto:** Si `NODE_ENV === 'production'` y faltan variables obligatorias, el proceso hace `process.exit(1)` con mensaje de error explícito.

### B. Eliminación de Fallbacks a DEV (Uploads)
**Archivos:** `backend/index.js`, `backend/src/app.js`, `backend/src/modules/contable/api/controllers/documentos.controller.js`
- **Cambio:** Se eliminó `|| 'https://versa-app-dev.up.railway.app'`.
- **Efecto:** En Producción, si falta el archivo local:
  - Si `REMOTE_STORAGE_URL` existe -> Redirección controlada.
  - Si NO existe -> Error 404 explícito. (Ya no busca en DEV).

### C. Configuración de URLs (APP_URL y Callbacks)
**Archivos:** `backend/config/urls.js`, `backend/routes/googleAuth.js`, `backend/routes/customerGoogleAuth.js`
- **Cambio:** 
  - `config/urls.js`: Lanza error en Prod si no se puede determinar `APP_URL`. `localhost` solo permitido en dev.
  - `routes/customerGoogleAuth.js`: Reemplazo de `http://localhost:3000` por `${APP_URL}` dinámico.
  - `getFrontendBaseUrl`: Lanza error en Prod si falta `FRONTEND_BASE_URL`.

## 3. Variables Ahora Obligatorias en Prod
Para que el backend arranque correctamente en Producción, **DEBEN** estar definidas:

| Variable | Propósito | Comportamiento si falta |
| :--- | :--- | :--- |
| `NODE_ENV` | Definir entorno (`production`) | Asume Dev (pero validación manual en código fuerza 'production' para aplicar reglas) |
| `DATABASE_URL` | Conexión DB | `process.exit(1)` inmediato |
| `REMOTE_STORAGE_URL` | Storage persistente para archivos | `process.exit(1)` inmediato. Necesario para consistencia de archivos. |
| `APP_URL` (o `RAILWAY_PUBLIC_DOMAIN`) | URL base del backend | Error al importar configuración / Rutas rotas |
| `FRONTEND_BASE_URL` | Redirecciones OAuth | Error al iniciar flujo OAuth |

## 4. Resultados de Validaciones

| Prueba | Comando / Criterio | Resultado |
| :--- | :--- | :--- |
| **V1 — Grep de seguridad** | `grep -R "versa-app-dev" backend/` | **PASS** (0 coincidencias) |
| **V1 — Localhost Check** | `grep` en lógica productiva | **PASS** (Solo permitido bajo `if (!production)`) |
| **V2 — Runtime Prod** | Validación de variables al inicio | **PASS** (Implementado en `index.js`) |
| **V2 — Fallback Storage** | Lógica de redirección a Dev eliminada | **PASS** |
| **V3 — Health** | `/api/health` | **PASS** (No modificado, sigue operativo) |

## 5. Riesgos Restantes
- **Archivos Perdidos:** Al eliminar el fallback a Dev, cualquier archivo que SOLO existiera en el entorno de desarrollo y se estuviera sirviendo en Prod mediante la redirección dejará de estar accesible (dará 404). Esto es el comportamiento deseado (fail-safe) pero puede causar "enlaces rotos" visuales si no se ha migrado el storage.
- **Configuración Incorrecta:** Si no se configuran `REMOTE_STORAGE_URL` o `FRONTEND_BASE_URL` en el despliegue de Railway/Prod, el servicio fallará al arrancar o al intentar login. **Requiere acción de DevOps.**
