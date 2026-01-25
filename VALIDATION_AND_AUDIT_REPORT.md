# INFORME TÉCNICO: VALIDACIÓN DE ENTORNOS Y AUDITORÍA DE RUTAS API
**Fecha:** 25 de Enero de 2026
**Estado General:** ❌ **NO APTO PARA PRODUCCIÓN (FAIL)**

---

## 1. RESUMEN EJECUTIVO
Aunque la infraestructura CI/CD (Netlify/Railway) está correctamente configurada para inyectar variables de entorno, la aplicación contiene **errores de implementación crítica en el código cliente**.

- **El problema:** Archivos críticos (`guard.js`, `facturas.html`) no consumen las variables de entorno inyectadas, utilizando strings vacíos o `undefined` en producción.
- **El impacto:** 
    - El sistema de seguridad (`guard.js`) fallará silenciosamente o bloqueará usuarios válidos en Producción.
    - La facturación (Módulo FinSaaS) intentará conectar a rutas inexistentes (`/api/...`) en el dominio frontend, resultando en errores 404.

---

## 2. OBJETIVO A — VALIDACIÓN DE ENTORNOS (DEV/PROD)

### A1. Inventario de Variables
| Variable | Entorno Frontend (Netlify) | Entorno Backend (Railway) | Estado |
| :--- | :--- | :--- | :--- |
| **`VITE_API_URL`** | Prod: `https://versa-app.up.railway.app`<br>Dev: `https://versa-app-dev.up.railway.app` | N/A | ✅ Correcto en `netlify.toml` |
| **`NODE_ENV`** | gestionado por Vite (build mode) | `production` | ✅ Correcto |
| **`DATABASE_URL`** | N/A | Gestionado internamente por Railway | ✅ Correcto |

### A2. Matriz de Compatibilidad & Fallos
| Componente | Configuración Detectada | ¿OK/FAIL? | Motivo Técnico del Fallo |
| :--- | :--- | :--- | :--- |
| **Netlify Build** | Inyecta `VITE_API_URL` durante `npm run build` | ✅ OK | Correcta interpolación en código compilado (`src/`). |
| **Core Auth (`auth.js`)** | `import.meta.env.VITE_API_URL` | ✅ OK | Utiliza el estándar de Vite correctamante. |
| **API Client (`api-client.js`)** | `axios.create({ baseURL: ... })` | ✅ OK | Centralizado y seguro. |
| **Security Guard (`public/guard.js`)** | `window.VITE_API_URL || ''` | ❌ **FAIL** | Los archivos en `public/` NO son procesados por Vite. La variable `window.VITE_API_URL` no existe en runtime browser sin inyección explícita. |
| **FinSaaS Facturas (`facturas.html`)** | `const API_BASE = '';` | ❌ **FAIL** | Valor hardcodeado que ignora totalmente el entorno. Peticiones fallarán en Prod. |
| **Manager Legacy** | Mezcla `fetchWithAuth` y `guard.js` | ⚠️ RIESGO | `fetchWithAuth` funciona, pero el `guard.js` roto compromete la estabilidad. |

### A3. Evidencia Técnica
#### Fallo #1: `public/guard.js` (Crítico)
El script de protección de rutas intenta validar el token contra el servidor, pero no sabe dónde está el servidor en Producción.
```javascript
// public/guard.js : Línea 75
const apiBaseUrl = window.VITE_API_URL || ''; 
// En producción, esto evalúa a ''.
// fetch('/api/auth/me') -> Intenta GET https://versa-frontend.netlify.app/api/auth/me -> 404 Not Found.
```

#### Fallo #2: `facturas.html` (Bloqueante)
El módulo de facturación tiene la URL base explícitamente vacía.
```javascript
// src/verticals/finsaas/pages/facturas.html : Línea 537
const API_BASE = ''; 
// Todas las llamadas son relativas: fetch('/api/contabilidad/facturas') -> 404.
```

---

## 3. OBJETIVO B — AUDITORÍA: DEUDA TÉCNICA `/api`

### B1. Clasificación de Hallazgos

#### 🔴 CRITICAL (Requiere Corrección Inmediata)
*Archivos que romperán funcionalidad en Producción.*

1.  **`src/verticals/finsaas/pages/facturas.html`**:
    *   **Error**: `const API_BASE = '';`
    *   **Acción**: Importar `buildApiUrl` de `/auth.js` o usar `/services/api-client.js`.

2.  **`public/guard.js`**:
    *   **Error**: Dependencia de variable global inexistente `window.VITE_API_URL`.
    *   **Acción**: Mover lógica a bundle compilado o inyectar variable en `index.html`.

3.  **Posibles afectados similares (Revisión Manual)**:
    *   `src/verticals/finsaas/pages/gastos-nuevo.html`
    *   `src/verticals/finsaas/pages/import-banking.html`

#### 🟠 MEDIUM (Riesgo Moderado)
*Archivos HTML "Legacy" en `frontend/` raíz.*

1.  **`manager-taller-*.html`**:
    *   Aunque invocan `fetchWithAuth` (que está bien), muchos tienen bloques de script in-line que podrían tener `fetch` directos olvidados o depender de variables globales inestables.

2.  **Scripts de utilidad (`scripts/guard-api.js`)**:
    *   Parecen herramientas de desarrollo, no afectan prod, pero confirman la existencia de deuda técnica alrededor de la validación de APIs.

### B2. Dependencias "Mágicas"
La aplicación depende de que **archivos estáticos en `/public`** tengan conocimiento del entorno de compilación, lo cual es imposible sin un paso extra de inyección (e.g., plugin `vite-plugin-html-env` o script de sustitución).

---

## 4. PLAN DE REMEDIACIÓN

### Paso 1: Reparar `facturas.html` (Inmediato)
Reemplazar la definición manual de `API_BASE` por la importación de la utilidad robusta.

**Cambiar esto:**
```javascript
const API_BASE = '';
// ...
const res = await fetch(API_BASE + endpoint, ...);
```

**Por esto:**
```javascript
import { buildApiUrl, getAuthHeaders } from '/auth.js';
// ...
const url = buildApiUrl(endpoint); // Maneja VITE_API_URL automáticamente
const res = await fetch(url, { headers: getAuthHeaders() });
```

### Paso 2: Reparar `guard.js` (Estructural)
Dado que `public/guard.js` no se compila, tenemos dos opciones:
1.  **Opción A (Recomendada):** Eliminar `public/guard.js` como archivo estático y convertirlo en un módulo JS (`src/guard.js`) importado en cada HTML como `<script type="module" src="/src/guard.js"></script>`. Esto permite a Vite inyectar `import.meta.env`.
2.  **Opción B (Parche):** Agregar un script en el `<head>` de todos los HTMLs que exponga la variable para el código legacy:
    ```html
    <script>window.VITE_API_URL = "%VITE_API_URL%";</script>
    ```

### Paso 3: Barrido de Seguridad
Ejecutar un reemplazo global en VS Code:
*   **Buscar**: `fetch('` y `fetch("`
*   **Revisar**: Cualquier ocurrencia que no esté precedida por una construcción de URL dinámica que use `VITE_API_URL`.

---

## 5. CONCLUSIÓN
**Solo FinSaaS Dashboard** ha sido corregido correctamente. El resto de la vertical FinSaaS (Facturas, Gastos) e infraestructura crítica (Guard) **fallarán en producción**.
Se requiere aplicar los fixes del Pasos 1 y 2 antes de cualquier despliegue.
