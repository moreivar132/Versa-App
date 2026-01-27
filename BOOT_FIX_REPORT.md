# HOTFIX: BOOT LOOP EN PROD

> **Problema:** El servidor de Producción entra en bucle de reinicios.
> **Error:** `CRITICAL: Missing required environment variables in PRODUCTION: [ 'REMOTE_STORAGE_URL' ]`
> **Causa:** Se configuró `REMOTE_STORAGE_URL` como **obligatoria** para arrancar en el último cambio de seguridad. Como Railway PROD aún no tiene esa variable, el servidor se protege apagándose.

---

## Solución Aplicada
Se ha modificado `backend/index.js` para hacer esa variable **OPCIONAL** en el arranque.

**Comportamiento resultante en Prod:**
1. **Arranque:** ✅ El servidor iniciará correctamente sin la variable.
2. **Archivos adjuntos:** Si falta un archivo local y no hay variable configurada, devolverá **404 Not Found** (como se pidió: "fail safe"). **Ya NO redirigirá a Dev** ni crasheará.

### Acción para el Usuario
1. **Desplegar este cambio** urgentemente a Prod.
2. (Opcional) Si deseas persistencia de archivos en Prod, añade `REMOTE_STORAGE_URL` en las variables de entorno de Railway apuntando a tu servicio de storage (S3/Cloudinary/Otro). Mientras tanto, el sistema es seguro y estable.
