# FinSaaS — Deep Diagnosis Report (NO CHANGES)

## 0) Estado general
- **Estado**: FAIL
- **Total hallazgos**: ~15 archivos analizados
- **CRITICAL**: 2 Archivos (Rompen en Netlify/Prod)
- **MEDIUM**: 10 Archivos (Manual concat, riesgo de error)
- **LOW**: 3 Archivos (Inconsistencias menores)

## 1) Mapa de deuda técnica (resumen)
| Tipo | Cantidad | Severidad dominante | Archivos más afectados |
|------|----------|---------------------|------------------------|
| **Hardcoded Relative Path** | 2 | 🔴 **CRITICAL** | `gastos-nuevo.html`, `validacion-deducible.html` |
| **Manual Concatenation** | 8+ | 🟠 **MEDIUM** | `facturas.html`, `empresas.html`, `contactos.html`... |
| **Cloud-Ready (Correct)** | 4 | 🟢 **OK** | `auth.js`, `dashboard.html`, `usuarios.html`, `copiloto-*.html` |

## 2) Hallazgos detallados (por archivo)

### `frontend/src/verticals/finsaas/pages/gastos-nuevo.html`
- **Severidad**: 🔴 **CRITICAL**
- **Línea**: ~389, ~582
- **Snippet**: `const API_BASE = '/api/contabilidad';` ... `fetch(${API_BASE}/egresos/intakes...`
- **Qué rompe**: El upload de facturas fallará con 404 en Netlify/Prod porque construye una URL relativa `/api/...` sobre el dominio del frontend en lugar de usar la URL de la API.
- **Patrón**: Hardcoded relative path + Raw fetch bypass.

### `frontend/src/verticals/finsaas/pages/validacion-deducible.html`
- **Severidad**: 🔴 **CRITICAL**
- **Línea**: ~303, ~783
- **Snippet**: `const API_BASE = '/api/contabilidad';` ... `fetch(url, { headers })` (en `exportCSV`)
- **Qué rompe**: La exportación CSV fallará con 404. Aunque usa `fetchWithAuth` para algunas llamadas (que sí mitiga el path relativo), la función `exportCSV` usa `fetch` nativo con la URL relativa construida manualmente.
- **Patrón**: Hardcoded relative path + Raw fetch en función secundaria.

### `frontend/src/verticals/finsaas/pages/facturas.html`
- **Severidad**: 🟠 **MEDIUM**
- **Línea**: ~563
- **Snippet**: `fetch(API_BASE + endpoint, ...)`
- **Qué rompe**: No rompe *per se*, pero es frágil. Usa `API_BASE = getApiBaseUrl()` (correcto) pero concatena manualmente Strings (`API_BASE + endpoint`). Si el endpoint no empieza con `/` o si `API_BASE` cambia su formato, puede romper. Es deuda técnica, no bug actual.
- **Patrón**: Concatenación Manual (Insecure Endpoint Construction).

### `frontend/src/verticals/finsaas/pages/import-banking.html`
- **Severidad**: 🟠 **MEDIUM**
- **Línea**: ~245
- **Snippet**: `const API_BASE_URL = import.meta.env.VITE_API_URL || '';`
- **Qué rompe**: Duplica la lógica de `getApiBaseUrl()` en lugar de importar el helper. Si cambia la lógica central (ej: prefijo `/v1`), este archivo no se enterará.
- **Patrón**: Fuentes de verdad múltiples (Duplicated Logic).

### Resto de páginas (`empresas.html`, `contactos.html`, `caja.html`, etc.)
- **Severidad**: 🟠 **MEDIUM**
- **Patrón**: Mismo patrón que `facturas.html`. Importan `getApiBaseUrl` pero concatenan manualmente.

## 3) Root causes (máximo 5)
1.  **Inconsistencia en Imports**: Se ha importado `auth.js` en casi todos los archivos, pero no sus helpers seguros (`buildApiUrl`, `fetchWithAuth`) de forma consistente.
2.  **Copy-Paste Legacy**: Bloques como `const API_BASE = '/api/...'` se han copiado de versiones antiguas sin migrar a la nueva arquitectura de variables de entorno.
3.  **Bypass de `fetchWithAuth`**: En funciones específicas (csv export, file upload) se usa `fetch` nativo para manejar blobs/form-data manualmente, perdiendo la inyección automática de la `BASE_URL`.
4.  **Falta de Estandarización**: Existen 3 formas activas de llamar a la API: `buildApiUrl` (moderna), `API_BASE + url` (híbrido), y `'/api' + url` (legacy roto).

## 4) Porcentaje Cloud-ready vs Legacy
- **Cloud-Ready (100% safe)**: **~30%** (Archivos que usan `buildApiUrl` o `fetchWithAuth` exclusivamente).
- **Híbrido (Safe but Dirty)**: **~55%** (Usan `getApiBaseUrl` + concatenación manual).
- **Legacy/Broken (Fails)**: **~15%** (Hardcoded paths que requieren fix inmediato).

## 5) Recomendación de orden de ataque (SIN IMPLEMENTAR)
1.  **CRITICAL FIX**: Reemplazar `const API_BASE = '/api/...'` por `getApiBaseUrl()` y asegurar uso de `buildApiUrl` en `gastos-nuevo.html` y `validacion-deducible.html`.
2.  **Unificar Exports**: En `validacion-deducible.html`, migrar la lógica de exportación CSV para usar `buildApiUrl`.
3.  **Refactor Masivo (Medium)**: Reemplazar todas las concatenaciones manuales `API_BASE + endpoint` por `buildApiUrl(endpoint)` en `facturas.html` y similares para eliminar deuda técnica y riesgo de "doble slash".
