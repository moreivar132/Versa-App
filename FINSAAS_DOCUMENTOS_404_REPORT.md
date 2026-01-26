# PROMPT 1 (DIAGNÓSTICO) — FinSaaS Biblioteca/Documentos: 404 en previsualización

## 0) Estado
- **LOCAL**: FAIL (Reproducido via estático/script)

## 1) Request exacto que falla
- **URL**: `http://localhost:3000/api/contabilidad/documentos/110/archivo?preview=true&token=...`
- **Método**: `GET`
- **Renderizado**: `<iframe>` (PDF) o `<img>` (IMG) en `documentos.html`.
- **Snippet Frontend**:
  ```javascript
  // frontend/src/verticals/finsaas/pages/documentos.html
  preview_url: isIntake
      ? `/api/contabilidad/documentos/intake/${row.intake_id}/archivo?preview=true`
      : `/api/contabilidad/documentos/${row.id}/archivo?preview=true`,
  ```

## 2) Resultado de auditoría del backend
- **Route**: SI existe.
  - Archivo: `backend/src/modules/contable/api/contabilidad.routes.js`
  - Definición: `router.get('/documentos/:facturaId/archivo', ...)`
- **Controller**: `backend/src/modules/contable/api/controllers/documentos.controller.js` -> `serveArchivo`
- **Middleware**:
  - `verifyJWT`: Soporta `req.query.token` explícitamente (Línea 9 `middleware/auth.js`). **No es error de Auth.**
- **Storage Path Checker**:
  - El controlador busca en `backend/uploads/contabilidad` y `backend/uploads/egresos`.

## 3) Causa raíz
**C) archivo físico faltante**

El entorno local conecta a una base de datos remota (Neon) que tiene referencias a archivos subidos previamente (`/uploads/egresos/1769430992285-7f3d6f555fd0-Factura_FT25-01.pdf`).
Sin embargo, el sistema de archivos local (`backend/uploads/egresos`) **NO contiene estos archivos** porque el almacenamiento es local (disco) y no está sincronizado entre el entorno donde se subió el archivo y tu entorno local.

El backend devuelve correctamente `404` con el mensaje (interno/JSON): `Archivo no encontrado en servidor`.

## 4) Fix recomendado (SIN IMPLEMENTAR)
Dado que es un problema de entorno (DB Remota vs Disco Local), no hay un "fix" de código para que aparezca mágicamente el archivo, pero sí para manejarlo y solucionarlo a futuro.

Opción A (Mejorar experiencia Dev/Error):
- **Archivos a tocar**: `backend/src/modules/contable/api/controllers/documentos.controller.js`
- **Cambio**: Agregar un "placeholder" o imagen por defecto cuando `!fs.existsSync(filePath)` y el entorno sea `development`, o devolver un 404 más explícito que el frontend pueda capturar para mostrar "Archivo no disponible localmente".

Opción B (Solución Real):
- **Migrar a S3/Cloud Storage**: Cambiar la estrategia de almacenamiento de `multer.diskStorage` a un servicio en la nube (AWS S3, Google Cloud Storage, UploadThing) para que los archivos sean accesibles desde cualquier entorno connectedo a la DB.

**Para verificar que el código funciona:**
Sube un *nuevo* documento desde tu entorno local. Este sí se guardará en tu disco y podrás previsualizarlo correctamente.
