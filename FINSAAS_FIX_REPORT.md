# PROMPT 2 — ANTIGRAVITY (Fix) — FinSaaS Documentos

## 0) Estado final
- **LOCAL**: ✅ OK (Resiliente)
- **DEV**: ✅ OK (No afecta, debería funcionar igual si los archivos existen)
- **PROD**: ✅ OK (No afecta)

## 1) Cambios aplicados

### Backend
**Archivo**: `backend/src/modules/contable/api/controllers/documentos.controller.js`

**Cambio Principal**:
Se introdujo una función `resolveFilePath(storageKey, fileUrl)` verificada que centraliza la lógica de comprobar si el archivo existe físicamente en el disco.
Se usa esta función para:
1. Servir el archivo (como antes).
2. Calcular la nueva propiedad `exists: boolean` en el endpoint `list`.

Snippet de cálculo en `list()`:
```javascript
const items = paginatedItems.map(row => {
    // ...
    return {
        // ...
        archivo: row.has_attachment ? {
            // ...
            exists: !!resolveFilePath(storageKey, fileUrl) // <--- NUEVO
        } : null
    };
});
```

### Frontend
**Archivo**: `frontend/src/verticals/finsaas/pages/documentos.html`

**Renderizado Condicional**:
- En **Tabla**: Si `exists: false`, muestra icono `link_off` (enlace roto) en rojo en lugar de la miniatura/ojo.
- En **Galería**: Si `exists: false`, muestra icono `link_off` grande.

**Lógica de Interacción (`openPreview`)**:
```javascript
// check existence (UX resilience)
if (doc.has_attachment && doc.archivo?.exists === false) {
     showMissingFileToast();
     return;
}
```
Esto bloquea el intento de abrir el `iframe` o `img` que daría 404.

**UX/Feedback**:
Se añade `showMissingFileToast()` que muestra un mensaje flotante:
> "Archivo no disponible. Este documento no existe en el disco local."

## 2) Validación

### Caso 1: Documento Subido en LOCAL (Nuevo)
- **Acción**: Subir factura desde "Ingresar Gasto".
- **Resultado**: El archivo se guarda en `backend/uploads/...`.
- **Backend**: `resolveFilePath` devuelve path válido -> `exists: true`.
- **Frontend**: Muestra miniatura y permite previsualizar.

### Caso 2: Documento existente en DB remota pero NO en disco local
- **Acción**: Ir a Biblioteca y buscar factura antigua (ID 110).
- **Resultado**: Backend no encuentra archivo en disco -> `exists: false`.
- **Frontend**:
  - Icono cambia a "Enlace Roto" rojo.
  - Al hacer click, NO se abre modal negro.
  - Aparece Toast "Archivo no disponible".
- **Consola**: 0 errores 404 (porque no se intenta cargar la imagen/pdf).

---

## 3) Recomendación de Arquitectura (Storage Compartido)

Para solucionar el problema de raíz y permitir ver archivos de credos en PROD desde LOCAL (y viceversa), se recomienda:

**Estrategia: Almacenamiento S3 Compatible (Cloudflare R2)**
Por qué R2: Coste de egreso $0 (ideal para previews masivos).

**Plan de Acción:**
1.  **Infra**: Crear Bucket `finsaas-storage`.
2.  **Backend**:
    - Instalar `@aws-sdk/client-s3`.
    - Configurar cliente S3 apuntando a R2.
    - Reemplazar `multer.diskStorage` por `multer-s3` o subida manual buffer a S3.
3.  **Migración**: Script para subir todo `backend/uploads` actual al bucket.
4.  **Servir**:
    - El endpoint `serveArchivo` redirige (302) a URL firmada (Presigned URL) o hace pipe del stream S3 -> Cliente.

Con esto, `fs.existsSync` desaparece y se reemplaza por ver si tenemos `storage_key` válida. Todos los entornos "verían" los mismos archivos.
