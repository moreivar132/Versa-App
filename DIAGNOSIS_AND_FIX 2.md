# ANTIGRAVITY — Diagnóstico y Resolución

## 1. Diagnóstico: ¿Por qué marcaba "no existe en disco"?

**Problema:**
La función que verifica la existencia del archivo estaba calculando mal la ruta física en el servidor.
- **Ruta calculada (Errónea):** `C:\Users\...\Versa-App\backend\backend\uploads\contabilidad\...` (Nótese el doble `backend`).
- **Ruta real:** `C:\Users\...\Versa-App\backend\uploads\contabilidad\...`

**Causa:**
El código usaba `process.cwd()` (directorio actual de ejecución) + `/backend`. Como probablemente estás ejecutando el servidor *desde* la carpeta `backend`, se duplicaba la ruta.

**Solución Aplicada:**
He cambiado la lógica para usar `__dirname` (ruta absoluta del archivo de código) y navegar hacia atrás (`../../../../../`), **exactamente igual** a como lo hace el código que *guarda* los archivos. Esto garantiza que la ruta de "lectura" y la ruta de "escritura" sean siempre idénticas, sin importar desde dónde lances el servidor.

---

## 2. Logs en Consola (`API GET: ...`)

**Respuesta:**
Esos logs aparecían porque había un `console.log` explícito en el archivo `facturas.html` para propósitos de depuración (ver qué peticiones hacía la página).

> *¿"eso esta preparado para los entornos dev y prod aparte del local?"*

No, era simplemente un rastro de desarrollo ("ruido"). En un entorno de producción real, idealmente estos logs se eliminan o se envuelven en una condición tipo `if (DEBUG) ...`.

**Acción Tomada:**
He comentado esa línea en `facturas.html`. Ahora tu consola estará limpia y solo mostrará errores reales o advertencias importantes.

---

## Resumen de Cambios
1. **Backend (`facturas.controller.js`):** Corrección de la resolución de rutas para el flag `exists`. Ahora el preview debería funcionar correctamente para tus archivos existentes.
2. **Frontend (`facturas.html`):** Eliminación de logs `[FinSaaS] API GET:...` para limpiar la consola.

### Pruebas sugeridas
1. Recarga la página.
2. Abre el modal de adjuntos.
3. El icono debería salir normal (gris/verde).
4. Al hacer clic, el archivo se abrirá correctamente.
