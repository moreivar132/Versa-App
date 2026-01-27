
# Diagnóstico — Preview Documentos 404 (Railway DEV)

## 0) Estado
- **DEV**: FAIL 🔴

## 1) Evidencia (Network)
- **URL completa**: `https://versa-app-dev.up.railway.app/api/contabilidad/documentos/36/archivo?preview=true`
- **Status**: `404 Not Found`
- **Comportamiento**:
  - Petición sin token: `401 Unauthorized` (El endpoint existe y está protegido).
  - Petición con token: `404 Not Found` (El endpoint ejecuta pero no encuentra el recurso).

## 2) Endpoint
- **¿Existe?**: Sí.
- **Ubicación**: `backend/src/modules/contable/api/contabilidad.routes.js` (Línea 131).
- **Controller**: `documentosController.serveArchivo`.
- **Middleware**: `verifyJWT` funciona correctamente.

## 3) Datos DEV
- **¿Existe el documento en DB?**: Sí. El frontend muestra el ID 36 en la lista, por lo que el registro en `contabilidad_factura` existe en la base de datos persistente.
- **Path lógico**: El registro apunta a un archivo almacenado localmente.

## 4) Storage DEV
- **¿Existe el archivo físico?**: No.
- **Persistencia**: **Nula (Efímera)**.
- **Explicación Técnica**: Railway utiliza contenedores efímeros. Cualquier archivo guardado en el disco local (`/uploads`) desaparece tras cada despliegue o reinicio del servicio.
- **Path Resolver**: El código usa `path.join(__dirname, '../../../../../uploads/...')` buscando ficheros en el disco local del contenedor actual.

## 5) Causa raíz final (C)
- **Causa**: **C) Archivo físico no existe en DEV storage**.
- **Detalle**: Desincronización entre Base de Datos (Persistente) y Sistema de Archivos (Efímero). El registro dice "tengo un archivo", pero el archivo fue borrado por el ciclo de vida de Railway.

## 6) Recomendación (sin implementar)
- **Solución Estructural**: Migrar a almacenamiento en la nube (AWS S3, Google Cloud Storage, R2).
- **Solución Rápida (Railway)**: Configurar un **Railway Volume** persistente montado en la ruta `/app/backend/uploads`.
