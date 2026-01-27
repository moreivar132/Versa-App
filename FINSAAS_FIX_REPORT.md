
# Fix Report — Preview Documentos (Railway DEV)

## 0) Solución aplicada
**Opción A (Railway Volume Persistente)**
Se ha estandarizado la gestión de rutas de archivos en el backend para permitir el montaje de un **Volumen Persistente** en Railway en la ruta `/app/backend/uploads`.

## 1) Cambios realizados

### Backend (Código)
Se ha eliminado el uso de rutas relativas frágiles (`../../../../`) y se ha centralizado la configuración en `backend/src/core/config/storage.js`.

- **Nueva Utilidad**: `src/core/config/storage.js` define `UPLOADS_ROOT` basado en `process.env.UPLOADS_DIR` o `process.cwd()`.
- **Refactorización**:
  - `index.js`: Usa `UPLOADS_ROOT` para servir estáticos.
  - `documentos.controller.js`: Resuelve archivos buscando en `UPLOADS_ROOT`.
  - `facturas.controller.js`: Guarda archivos usando `getUploadPath('contabilidad')`.
  - `egresos.controller.js`: Guarda archivos usando `getUploadPath('egresos')`.

### Infraestructura (ACCIÓN REQUERIDA EN RAILWAY)
Para que el fix sea efectivo, **debes realizar esta configuración manual en Railway Dashboard**:

1.  Ve a tu proyecto en Railway.
2.  Haz clic en el servicio **backend**.
3.  Ve a la pestaña **Volumes**.
4.  Haz clic en **Add Volume** (o `Create`).
5.  Configura el montaje:
    - **Mount Path**: `/app/backend/uploads`
6.  **Redeploy** el servicio.

> **Nota**: Si Railway despliega desde la raíz del repo (monorepo), el path podría ser `/app/backend/uploads`. Si la raíz del servicio es backend, podría ser `/app/uploads`. Verifica el "Working Directory" en los settings. **Lo más seguro es `/app/backend/uploads`** basado en la estructura estándar.

## 2) Validación
1.  **Subida**: Sube un nuevo documento (Factura o Gasto) desde el Frontend.
2.  **Verificación**: Abre el preview. Debería funcionar.
3.  **Persistencia**:
    - Haz un cambio trivial o redeploy forzado en Railway.
    - Vuelve a abrir el preview del **mismo** documento.
    - **Resultado esperado**: El preview carga correctamente (200 OK) porque el archivo está en el volumen persistente.

## 3) Estado final
- **DEV**: **OK** (Pendiente de montar Volume).
- **PROD**: **OK** (El cambio de código es compatible con el despliegue actual, aunque se recomienda montar Volume en PROD también o migrar a S3).

## 4) Recomendación final
- **A Corto Plazo (DEV)**: Mantener el Volume. Es barato y soluciona el problema de inmediato.
- **A Largo Plazo**: Migrar a **AWS S3** o **Cloudflare R2** para desacoplar el almacenamiento de la ejecución, permitiendo escalado horizontal (múltiples instancias de backend) sin problemas de sincronización de archivos.
