# INFORME DE DIAGNÓSTICO: VERSA-APP (LOCAL / DEV / PROD)

## 1. Resumen Ejecutivo
Tras la auditoría exhaustiva del código (BackendNode/Express y Frontend Vite/Netlify), se han detectado **3 puntos críticos** que explican las divergencias entre entornos:

1.  **Contaminación de Storage entre Entornos**: El Backend tiene una lógica de fallback (línea 158 `backend/index.js`) que redirige a la URL de **DEV** (`versa-app-dev`) si no encuentra un archivo local. Esto hace que Prod dependa de Dev para archivos, o rompa enlaces si Dev no tiene el archivo.
2.  **Hardcoding de Base de Datos en Scripts**: El script `backend/check-user.js` tiene una credencial de conexión **hardcodeada** apuntando a una instancia `eu-central-1` (diferente a la definitida en `.env` local `eu-west-2`). Esto genera confusión sobre cuál es la "verdadera" BD.
3.  **Configuración de CORS Permisiva pero Riesgosa**: El backend usa `cors()` (Wildcard `*`) en `index.js`. Aunque facilita que Local/Dev funcionen, en Producción depente enteramente de que Railway no bloquee orígenes a nivel de infraestructura.
4.  **Knex fuerza Development**: En `backend/knexfile.js` (línea 22), se fuerza `NODE_ENV='development'` si no existe. Si Railway Prod no inyecta explícitamente `NODE_ENV=production`, el backend correrá en modo dev y podría intentar cargar `.env` o mostrar logs detallados.

---

## 2. Mapa de Entornos y Fuentes de Variables

| Entorno | Frontend (Origen) | Variable API (Inyección) | Backend (Destino) | DB Connection Source |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | `localhost:5173` | Proxy Vite (`/api` -> `localhost:3000`) | `localhost:3000` | Archivo `.env` local (Neon eu-west-2) |
| **Dev** | `versa-app-dev` (Netlify) | `netlify.toml` [context.deploy-preview] -> `...-dev.up.railway.app` | Railway Dev Service | Variable de Entorno Railway (`DATABASE_URL`) |
| **Prod** | `versa-app` (Netlify Main) | `netlify.toml` [context.production] -> `...-app.up.railway.app` | Railway Prod Service | Variable de Entorno Railway (`DATABASE_URL`) |

---

## 3. Inventario de Variables y Almacenamiento

### 3.1 Backend (Node/Express)
**Fuente:** `process.env` (Cargado por Railway en nube / `dotenv` en local).

| Variable | Estado Local (`.env`) | Ubicación Uso Código | Riesgo |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Definida (Redactada: `postgresql://...eu-west-2...`) | `db.js`, `knexfile.js` | Crítico (Fuente de verdad) |
| `NODE_ENV` | Implícito (No en archivo, defaults a dev) | `db.js`, `knexfile.js`, `index.js` | **Alto** (Knex fuerza defaul 'development') |
| `JWT_SECRET` | Definida | `middleware/auth.js` | Alto (Seguridad) |
| `REMOTE_STORAGE_URL` | **AUSENTE** (No está en `.env`) | `index.js` (Línea 158) | **CRÍTICO**: El código usa un default hardcodeado a `versa-app-dev` |
| `STRIPE_SECRET_KEY` | Definida (Test key) | `routes/stripe.js` | Medio |

### 3.2 Frontend (Vite)
**Fuente:** Build-time replacement (`import.meta.env`). Definidas en `netlify.toml`.

| Variable | Contexto Netlify | Valor Inyectado | Comentario |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Production | `https://versa-app.up.railway.app` | Correcto (apunta a Prod Backend) |
| `VITE_API_URL` | Deploy Preview / Dev | `https://versa-app-dev.up.railway.app` | Correcto (apunta a Dev Backend) |
| `VITE_API_URL` | Local (sin definir) | `""` (Empty string) | Correcto (usa Proxy Vite a localhost) |

---

## 4. Verificación DB por Entorno

### 4.1 Evidencias de Conexión
- **Local:** `backend/.env` apunta a `ep-icy-union... (eu-west-2)`.
- **Script (check-user.js):** Apunta a `ep-spring-shape... (eu-central-1)`. **DIVERGENCIA CONFIRMADA**.
  - *Evidencia:* Línea 4 de `backend/check-user.js`.
- **Backend Runtime (`db.js`):**
  - Tiene un "Guardrail" (Línea 28) que **mata el proceso** si `NODE_ENV=production` y la `DATABASE_URL` contiene references a localhost.
  - Esto es seguro, previene que Prod apunte a una DB Local, pero no previene que Prod apunte a DB Dev (si la URL es remota).

---

## 5. Drift de Migraciones (Dev vs Prod)

Se ha verificado el directorio `backend/db/migrations`.
- **Total Migraciones:** >50 archivos.
- **Baseline:** `20260101000000_schema_dump.js`.
- **Última Migración:** `20260122183300_enhance_email_templates.js`.
- **Estado:**
  - El sistema usa Knex.
  - No hay evidencia de "missing migrations" en el código fuente actual.
  - **Riesgo:** Si Prod no ha corrido `npm run migrate:latest` recientemente, faltarán las tablas creadas el `2026-01-22` (Billing, Ventas, Income Events). Dado el alto volumen de migraciones recientes (22 de Enero), es altamente probable que Prod esté desactualizado si no tiene un CD pipeline automático para migraciones.

---

## 6. Diferencias de Build/Deploy

### 6.1 Backend (Railway)
- **Repo:** GitHub (`versa-backend` según package.json).
- **Build:** `NIXPACKS` (según `railway.json`).
- **Start Command:** `npm start` -> `node index.js`.
- **Endpoint Health:** `/api/health` y `/api/db-test`.

### 6.2 Frontend (Netlify)
- **Build Command:** `npm run build` (`vite build`).
- **Publish Directory:** `dist`.
- **Configuración:** `netlify.toml` maneja correctamente la inyección de variables.

---

## 7. CORS / Cookies / Dominios
- **Permisividad:** El backend usa `app.use(cors())` sin opciones. Esto permite **Cualquier Origen**.
  - *Ventaja:* No debería causar errores de CORS "bloqueantes" típicos.
  - *Desventaja:* Inseguro.
- **Cookies:** No se observó configuración explícita de `SameSite` o `Secure` en la inicialización de sesión básica (JWT se pasa por Header `Authorization: Bearer`, no por cookie HttpOnly en el código de `api-client.js`).
  - *Cliente:* `localStorage.getItem('versa_session_v1')`.

---

## 8. Storage / Filesystem (El "Bug" más probable)
- **Evidencia:** `backend/index.js` líneas 146-168.
- **Mecanismo:** El servidor sirve estáticos desde la carpeta local `uploads/`.
- **Problema en Railway:** El sistema de archivos es **efímero**. Cada vez que se hace deploy, `uploads/` se vacía.
- **Fallo:** El código intenta mitigar esto redirigiendo a una URL remota si no encuentra el archivo localmente.
- **El Error:** La URL remota por defecto (Línea 158) es `https://versa-app-dev.up.railway.app`.
  - En **PRODUCCIÓN**, si subes un archivo, se guarda en el disco efímero. Al reiniciar, se borra. Al intentar leerlo, el código redirige a **DEV**. Como en Dev tampoco existe (porque se subió a Prod), devuelve 404.

---

## 9. Casos Reproducibles

### Caso A: Script de diagnóstico apunta a DB incorrecta
1. **Pasos:** Ejecutar `node backend/check-user.js` en local.
2. **Resultado Esperado:** Conectar a la BD definida en `.env`.
3. **Resultado Real:** Conecta a la BD hardcodeada `postgres://...ep-spring-shape...` (eu-central-1).
4. **Impacto:** Falsos positivos/negativos al diagnosticar usuarios.

### Caso B: Archivos subidos desaparecen en Prod
1. **Pasos:** Subir una imagen en Entorno Prod. Confirmar que se ve. Reiniciar servicio (Deploy nuevo).
2. **Resultado:** La imagen da 404 o redirige a la URL de Dev.
3. **Causa:** Filesystem efímero + Fallback hardcodeado a Dev.

---

## 10. Checklist PASS/FAIL

- [x] **Local Environment**: `PASS` (Conectado a Neon Dev eu-west-2, Proxy correcto).
- [ ] **Scripting Integrity**: `FAIL` (`check-user.js` tiene credenciales hardcodeadas).
- [ ] **Variables Prod**: `FAIL` (Falta `REMOTE_STORAGE_URL` para evitar redirección a Dev).
- [x] **Frontend Variables**: `PASS` (`netlify.toml` inyecta correctamente URLs).
- [ ] **Storage Strategy**: `FAIL` (Uso de FS local efímero en Railway sin persistencia real S3/Volume configurada en código).
- [?] **Prod DB Sync**: `UNKNOWN` (No verificable sin acceso, pero alto riesgo por migraciones recientes del 22/01).

## 11. Bloqueos / Información Faltante
- No se tiene acceso a la configuración real de variables en el dashboard de Railway ("Variables de Entorno"). Se asume que existen, pero falta confirmar si `NODE_ENV` está seteado a `production`.
