# ANTIGRAVITY — Local vs Dev/Prod Environment Consistency Audit (FinSaaS)

## 0. Estado
- **LOCAL**: **FAIL** (Corregido a OK) — Se detectaron archivos con fallbacks hardcodeados (`card.html`) y scripts fuera del pipeline de Vite (`guard.js`).
- **DEV**: **OK** (Asumiendo backend activo)
- **PROD**: **OK** (Asumiendo backend activo)

-----

## 1. Archivos fuera de Vite
Los siguientes archivos presentaban problemas de procesamiento o acceso a variables de entorno:

- **`frontend/public/guard.js`**: 
  - **Motivo**: Al estar en `public/`, Vite **no procesa** este archivo. No se reemplazan las variables `import.meta.env`, y el script intentaba leer `window.VITE_API_URL` (que no existe por defecto).
  - **Consecuencia**: Fallaba silenciosamente o usaba fallback a string vacío `""` (ruta relativa), lo cual funcionaba por accidente si el proxy estaba activo, pero rompía la consistencia explícita.

- **`frontend/card.html`**:
  - **Motivo**: Usaba `<script>` estándar (no `type="module"`), impidiendo el uso de `import.meta.env`.
  - **Consecuencia**: Dependía de lógica hardcodeada basada en `window.location.hostname`.

---

## 2. Fallbacks detectados
Se encontraron lógicas peligrosas que ignoraban la configuración centralizada:

1.  **`frontend/card.html` (Líneas 505-507)**:
    ```javascript
    // ❌ Fallback Hardcodeado Peligroso
    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : '';
    ```

2.  **`frontend/public/guard.js` (Línea 75)**:
    ```javascript
    // ❌ Dependencia de variable global no garantizada
    const apiBaseUrl = window.VITE_API_URL || '';
    ```

---

## 3. Diagnóstico
El problema de **inconsistencia en LOCAL** se debía a una **combinación (D)**:
1.  **Archivos no procesados**: `guard.js` en `public/` era invisible para el inyector de variables de entorno de Vite.
2.  **Fallbacks Hardcodeados**: `card.html` forzaba `localhost:3000` ignorando `.env`.
3.  **Nota sobre `login-finsaas.html`**: Este archivo **SÍ** estaba leyendo correctamente `VITE_API_URL` (`http://localhost:3000`). El error `ERR_CONNECTION_REFUSED` visible en tus logs indica simplemente que el **Backend no está escuchando en el puerto 3000** (está apagado o en otro puerto), pero la configuración del frontend era correcta y respetaba el `.env`.

---

## 4. Corrección aplicada
Se eligió la **Opción A (Recomendada) + Opción C (Eliminar Fallbacks)**: Migrar scripts a módulos de Vite para garantizar acceso a `import.meta.env`.

### 4.1. Refactorización de `guard.js`
- **Acción**: Se eliminó `frontend/public/guard.js` y se creó `frontend/guard.js` (como módulo).
- **Lógica**: Ahora importa `auth.js` para reutilizar `getSession` y `requireAuth`, eliminando código duplicado.
- **Antes**:
  ```javascript
  const apiBaseUrl = window.VITE_API_URL || '';
  fetch(`${apiBaseUrl}/api/auth/me`...)
  ```
- **Después (`frontend/guard.js`)**:
  ```javascript
  import { requireAuth } from './auth.js';
  // Usa internamente import.meta.env.VITE_API_URL a través de auth.js
  await requireAuth();
  ```

### 4.2. Actualización de `FinSaaS.html`
- **Acción**: Se actualizó la importación del script para usar el nuevo módulo.
- **Snippet**:
  ```html
  <!-- Guard.js (Module) -->
  <script type="module" src="/guard.js"></script>
  ```

### 4.3. Corrección de `card.html`
- **Acción**: Se convirtió el script a `type="module"` y se eliminó el fallback de hostname.
- **Antes**:
  ```javascript
  const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  ```
- **Después**:
  ```javascript
  const API_BASE = import.meta.env.VITE_API_URL || '';
  ```

---

## 5. Validación
El sistema ahora es consistente. El comportamiento esperado en Network es:

1.  **Todas las páginas** (Login, FinSaaS, Card, Guard) leerán `VITE_API_URL` desde `.env`.
2.  Si `.env` dice `http://localhost:3000`, **TODOS** los requests irán a `http://localhost:3000/...`.
    - *Nota*: Si el backend no está corriendo, recibirás `ERR_CONNECTION_REFUSED` en todos ellos por igual (consistencia).
3.  Si se desea usar el **Proxy de Vite** en lugar de conexión directa, basta con cambiar en `.env`: `VITE_API_URL=` (vacío), y automáticamente **TODOS** los archivos usarán rutas relativas `/api/...` que pasan por el proxy.

**Estado Final**: La arquitectura frontend está **alineada** y lista para respetar la configuración de entorno sin excepciones ocultas.
