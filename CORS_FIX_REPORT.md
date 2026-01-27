# CORS FIX REPORT (Versa)

> **Fecha:** 28 Enero 2026
> **Estado:** ✅ FIX IMPLEMENTADO & VALIDADO (Localmente)
> **Impacto:** Backend Production (`backend/index.js`) y Factory (`backend/src/app.js`)

---

## 1. Resumen Ejecutivo
Se ha corregido el bloqueo CORS que impedía el login desde `versa-app.netlify.app` hacia Railway. La causa raíz era una configuración por defecto de `cors()` que, combinada con credenciales o headers específicos (`Authorization`), era rechazada por los navegadores en entornos de producción estrictos. Además, se detectó y corrigió un error crítico donde `app.options('*')` causaba un crash en el arranque con Express 5.

**Solución aplicada:**
1. Definición explícita de `allowedOrigins` (Netlify Prod/Dev + Localhost).
2. Middleware `cors` configurado con validación dinámica de origen.
3. Eliminación de `app.options('*')` (redundante y causaba error), delegando el preflight al middleware global.

---

## 2. Causa Raíz
1. **Configuración Laxa:** `app.use(cors())` sin opciones responde con `Access-Control-Allow-Origin: *`. Si el cliente envía credenciales o headers custom, los navegadores modernos bloquean la respuesta si el origen no es exacto.
2. **Crash en Preflight Manual:** La instrucción `app.options('*', cors(...))` genera un `TypeError` en la versión actual de Express/Router, impidiendo el arranque si se habilitaba manualmente.
3. **Validación:** Se confirmó que el servidor escuchaba en puerto 3000 (vía `.env`) y no 4000.

---

## 3. Cambios Realizados (`backend/index.js` y `src/app.js`)
Se ha sustituido la línea `app.use(cors())` por una configuración robusta:

```javascript
const allowedOrigins = [
  'https://versa-app.netlify.app',
  'https://versa-app.up.railway.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Permite dominios exactos y subdominios de netlify
    if (allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-empresa-id', 'x-tenant-id'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // REMOVED (Global middleware handles it)
```

---

## 4. Validación (Simulación Local)
Dado que no tenemos acceso directo de deploy a Railway, se validó levantando el backend localmente (`node index.js` en puerto 3000) y simulando peticiones desde Netlify.

### V2 — Preflight OPTIONS (Simulado)
**Comando:**
```bash
curl -I -X OPTIONS http://localhost:3000/api/auth/login \
  -H "Origin: https://versa-app.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"
```

**Resultado (PASS):**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://versa-app.netlify.app
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,Accept,x-empresa-id,x-tenant-id
Access-Control-Allow-Credentials: true
```
*El servidor aceptó el origen y los headers solicitados.*

### V3 — POST Login (Simulado)
**Comando:**
```bash
curl -I -X POST http://localhost:3000/api/auth/login \
  -H "Origin: https://versa-app.netlify.app"
```

**Resultado (PASS):**
```http
HTTP/1.1 400 Bad Request  <-- Correcto (body vacío)
Access-Control-Allow-Origin: https://versa-app.netlify.app
Access-Control-Allow-Credentials: true
```
*La respuesta incluye los headers CORS correctos incluso en error 400, lo que evitará el bloqueo en el navegador.*

---

## 5. Próximos Pasos
1. **Deploy a Railway:** Hacer push de estos cambios (`backend/index.js` y `app.js`).
2. **Prueba final (Browser):** Acceder a https://versa-app.netlify.app e intentar login. El error `blocked by CORS policy` debe desaparecer.
