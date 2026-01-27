# ADDENDUM — DIAGNÓSTICO DE APIS (FINSAAS FOCUS)

## A) Inventario Real de APIs (Verticales)

Se ha auditado la estructura de rutas en `backend/src/app.js`, `backend/index.js` y `backend/src/modules`.

| Vertical | Base Path | Archivo Principal de Rutas | Middlewares Clave | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **FinSaaS Core** | `/api/contabilidad` | `src/modules/contable/api/contabilidad.routes.js` | `verifyJWT`, `tenantContext`, `requirePermission` | **Modular V2**. Estructura robusta y segregada. |
| **FinSaaS RBAC** | `/api/finsaas/admin/rbac` | `routes/finsaasRbac.routes.js` | `requirePermission('finsaas.rbac.manage')` | Gestión de multi-tenant y roles. |
| **FinSaaS Banking** | `/api/banking` | `modules/banking/routes/import.routes.js` | `requireEmpresaAccess`, `multer` | Subida de ficheros bancarios. **Riesgo FS**. |
| **FinSaaS Income** | `/api/income-events` | `routes/incomeEvents.js` | `privateRoute` | Eventos de ingresos recurrentes. |
| **Marketplace** | `/api/marketplace` | `routes/marketplace.js` | Público / Admin | Funcionalidad separada. |
| **Shared/Legacy** | `/api/admin`, `/api/auth` | `routes/superAdminRoutes.js`, `routes/auth.js` | `verifyJWT` | Rutas heredadas del sistema anterior. |

**Evidencia:** `backend/src/app.js` (Líneas 95, 123, 127) monta explícitamente estas rutas.

---

## B) Diagnóstico de “Adaptación a Entornos” (Hallazgos Críticos)

### 1. Hardcoding de URL de Storage (CRITICAL)
Existe un fallback hardcodeado que apunta a **DEV** cuando falla la lectura de archivos locales.
- **Archivo:** `backend/src/app.js` (Línea 161) y `backend/index.js` (Línea 158).
- **Código:** `const remoteUrl = (process.env.REMOTE_STORAGE_URL || 'https://versa-app-dev.up.railway.app').replace(/\/$/, '');`
- **Impacto:**
    - **Local:** Funciona (lee disco).
    - **Prod:** Si el archivo no está en el disco efímero (que se borra en cada deploy), redirige al usuario a **DEV**.
    - **Resultado:** En Prod, los usuarios verán errores 404 o contenido cruzado del entorno de desarrollo.

### 2. Dependencia de Filesystem Efímero en Banking (HIGH)
El módulo de importación bancaria guarda archivos en disco local esperando procesarlos.
- **Archivo:** `backend/modules/banking/routes/import.routes.js` (Líneas 26-40).
- **Código:** `multer.diskStorage({ destination: ... '../../../uploads' })`.
- **Impacto:** En Railway, `uploads/` es efímero. Si el proceso de importación no es atómico y síncrono en la misma instancia, el archivo puede perderse. No hay integración con S3/Blob Storage detectada en este módulo.

### 3. Hardcodes en Controladores (MEDIUM)
Se encontraron referencias a URLs específicas en controladores.
- **Archivo:** `backend/src/modules/contable/api/controllers/documentos.controller.js` (Detectado por Grep).
- **Riesgo:** Posible lógica de redirección manual similar a `app.js`.

---

## C) Matriz de Endpoints FinSaaS (Disponibilidad y Consistencia)

### C1. Listado de Endpoints Críticos (Muestra)

| Endpoint Path | Verbo | Permiso Requerido | Dependencia Crítica | Estado "Prod-Ready" |
| :--- | :--- | :--- | :--- | :--- |
| `/api/contabilidad/dashboard` | GET | `contabilidad.read` | `req.db` (Tenant DB) | ✅ Ready |
| `/api/contabilidad/facturas` | GET/POST | `contabilidad.read/write` | Tabla `factura` | ✅ Ready |
| `/api/contabilidad/documentos` | GET | `contabilidad.read` | **Filesystem Local** | ⚠️ **Riesgo (FS)** |
| `/api/banking/imports` | POST | `empresa.access` | **Filesystem Local** | ⚠️ **Riesgo (FS)** |
| `/api/income-events` | GET | `N/A` | Tabla `income_event` | ✅ Ready (si migrado) |

### C2. Pruebas de Disponibilidad (Health)

| Entorno | Base URL | Endpoint `/api/health` | HTTP Status | Observación |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | `localhost:3000` | No probado (asumido OK) | N/A | Desarrollo activo. |
| **Dev** | `versa-app-dev...` | `curl -I .../api/health` | **200 OK** | Responde JSON timestamp. |
| **Prod** | `versa-app...` | `curl -I .../api/health` | **200 OK** | El backend está vivo. |

> **Nota:** Aunque Prod responde 200 en health, rutas profundas de FinSaaS fallarán 500 si faltan migraciones.

---

## D) Diagnóstico de Datos y Migraciones (Bloqueos)

FinSaaS depende de tablas creadas en migraciones muy recientes (Enero 2026).

| Entidad FinSaaS | Tabla DB | Migración Requerida | Fecha Migración | Riesgo Prod |
| :--- | :--- | :--- | :--- | :--- |
| **Contabilidad Core** | `factura`, `pago` | `20260113060000...contabilidad_v3` | 13 Ene 2026 | Medio |
| **Eventos Ingreso** | `income_event` | `20260122181100...income_event` | 22 Ene 2026 | **ALTO** (Muy reciente) |
| **Ventas Migradas** | `venta`, `detalle_venta` | `20260122182000...ventas_tables` | 22 Ene 2026 | **ALTO** |
| **Banking Core** | `banco_cuenta`, `transaccion` | `20260120150000...banking_core` | 20 Ene 2026 | **ALTO** |
| **Copiloto AI** | `copilot_session` | `20260121000500...copilot` | 21 Ene 2026 | **ALTO** |

> **BLOQUEO:** Si Prod no ha ejecutado `migrate:latest` después del **22 de Enero**, todas las funcionalidades de Ventas, Banking y Eventos de Ingreso fallarán (Error 500: Relation does not exist).

---

## E) Diagnóstico Frontend FinSaaS

El frontend de FinSaaS (HTML/JS en `src/verticals/finsaas`) consume la API correctamente mediante rutas relativas o base URL inyectada.

- **Mecanismo:** `frontend/src/verticals/finsaas/pages/dashboard.html` usa scripts módulo.
- **Config:** `api.js` / `api-client.js` usan `import.meta.env.VITE_API_URL`.
- **Redirección:** Netlify `_redirects` o proxy maneja `/api/*` -> Backend URL.
- **Veredicto:** El frontend es agnóstico del entorno. Si `VITE_API_URL` está bien en Netlify (verificado en diagnóstico anterior: SÍ lo está), el frontend apuntará al backend correcto.

---

## F) Checklist “FinSaaS listo para Prod”

- [x] **Rutas Definidas:** `PASS` (Estructura modular clara).
- [x] **Frontend Connection:** `PASS` (Usa variables de entorno correctas).
- [ ] **Storage Persistence:** `FAIL` (Usa disco efímero local + redirección a Dev).
- [ ] **Safe Fallbacks:** `FAIL` (Hardcode a `versa-app-dev` si falta variable env).
- [ ] **Database Sync:** `FAIL` (Alto riesgo de faltar migraciones post-20 Ene en Prod).
- [ ] **Secret Management:** `UNKNOWN` (No verificado si Prod tiene claves de OpenAI/Stripe diferentes a Dev).

---

## VEREDICTO APIs

1.  **CRÍTICO:** La gestión de archivos (Facturas, Imports Bancarios) **romperá en Producción** debido al sistema de archivos efímero de Railway y la redirección hardcodeada a Dev.
2.  **BLOQUEANTE:** Se requiere confirmación explícita de que las migraciones del **22/01/2026** se han ejecutado en Prod. Sin esto, módulos enteros (Ventas, Banking) darán Error 500.
3.  **RIESGO:** El fallback de `REMOTE_STORAGE_URL` a `versa-app-dev` en el código productivo es una fuente garantizada de confusión de datos y errores 404 cross-environment.
4.  **EVIDENCIA:** Claras dependencias de `multer` local en `import.routes.js` y `path.join(__dirname, 'uploads')` en `app.js` confirman la falta de estrategia de almacenamiento en la nube (S3).
5.  **Recomendación Inmediata (Fuera de alcance diagnóstico):** Configurar persistencia S3/Cloudinary urgente o Volumen Persistente Railway si es posible, y eliminar el fallback a Dev.
