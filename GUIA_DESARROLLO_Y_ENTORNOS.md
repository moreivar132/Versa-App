# Guía Maestra de Entornos, Despliegue y CORS - VERSA

Esta guía documenta la configuración crítica establecida para garantizar que el proyecto funcione en **Local, Dev (versadev) y Pro** sin errores de conexión o archivos faltantes.

---

## 🏗️ 1. Estructura de Proyecto Independiente
Hemos eliminado los `npm workspaces`. Ahora, el **Frontend** y el **Backend** son proyectos 100% independientes.
- **Por qué:** Esto evita el "hoisting" de dependencias (que `npm` mueva paquetes a la raíz), lo cual causaba el error `Cannot find module 'express'`.
- **Regla:** Cada carpeta tiene su propio `package-lock.json`. Si instalas algo en el backend, hazlo dentro de la carpeta `/backend`.

---

## 🌐 2. Sistema de CORS Dinámico
Para evitar el error `Access-Control-Allow-Origin`, el backend está configurado para aceptar cualquier entorno de Netlify.

### Configuración en `backend/index.js` y `backend/src/app.js`:
```javascript
origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Lista blanca explícita + comodín para Netlify
    const allowed = ['localhost', '.netlify.app', 'railway.app'];
    if (allowed.some(domain => origin.includes(domain))) {
        callback(null, true);
    }
}
```
**Importante:** Hemos añadido permisos para cabeceras personalizadas: `X-Empresa-Id`, `X-Tenant-Id`, y `X-Client-Id`. Si creas una nueva cabecera en el frontend, **DEBES** añadirla a la lista `allowedHeaders` del backend.

---

## 📂 3. Gestión de Archivos (El "misterio" de los PDFs faltantes)
**Problema:** Local y Dev comparten la Base de Datos (Neon), pero NO los archivos físicos subidos a `/uploads`.
**Solución:** Sistema de Redirección Automática (Interceptor).

### Cómo funciona:
1. El backend recibe una petición para un archivo (ej. `/uploads/egresos/factura.pdf`).
2. El `uploadsInterceptor` (en `backend/src/app.js`) mira si el archivo existe en tu disco duro local.
3. **Si no existe:** El backend te redirige automáticamente a la URL guardada en la variable `REMOTE_STORAGE_URL` de tu `.env`.
   - *Ejemplo:* Tu local te manda transparencia a `https://versa-app-dev.up.railway.app/api/uploads/egresos/factura.pdf`.

**Variable Crítica en `.env`:**
`REMOTE_STORAGE_URL=https://versa-app-dev.up.railway.app`

---

## 🚀 4. Checkpoint para Nuevas Páginas (Vite)
Cada vez que crees un nuevo archivo `.html` (ej. `ajustes-nomina.html`):
1. Debes ir a `frontend/vite.config.js`.
2. Añadirlo a la lista `input: { ... }`.
**Si no lo haces:** En tu ordenador funcionará, pero al subirlo a Netlify (Producción) dará un **Error 404**.

---

## ⚡ 5. Solución a Errores Comunes

### "EADDRINUSE: address already in use 0.0.0.0:3000"
- **Causa:** Tienes otro proceso de Node usando el puerto 3000 (probablemente un servidor que no se cerró bien).
- **Solución:** Ejecuta `lsof -ti:3000 | xargs kill -9` en la terminal para limpiar el puerto antes de hacer `npm start`.

### "Login error: TypeError: Load failed"
- **Causa:** El backend está apagado o hay un bloqueo de CORS.
- **Solución:** Verifica que el backend responda en `http://localhost:3000/api/health`.

---

## � Resumen de Despliegue
- **Frontend Local:** `http://localhost:5173`
- **Backend Local:** `http://localhost:3000`
- **Base de Datos:** Neon Tech (Compartida para agilizar pruebas).

*Mantenido por el equipo de ingeniería de VERSA - 2026*
