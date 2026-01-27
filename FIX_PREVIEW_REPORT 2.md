# FIX: Upload Preview ("Eye" Icon) + Missing File Handling (FinSaaS)

## 0. Estado Final
- **Preview archivos nuevos:** ✅ **OK**
  - Se utiliza la URL absoluta correcta: `http://.../api/uploads/archivo.ext`.
  - El backend sirve el archivo si existe.
- **Manejo archivos faltantes:** ✅ **OK**
  - **Backend:** Retorna `404 Not Found` en JSON (`code: "FILE_NOT_FOUND"`) en lugar de HTML o errores genéricos.
  - **Frontend:**
    - Verifica la existencia con `HEAD` antes de abrir.
    - Si falla (404), muestra un **Toast** elegante: *"El archivo ya no está disponible. Súbelo de nuevo."*
    - **No** abre pestañas rotas.

---

## 1. Cambios Aplicados

### Frontend (`frontend/.../pages/facturas.html`)
Se reemplazó el enlace directo `<a>` por un botón con lógica de validación `previewFile()`.

```javascript
// Validar existencia antes de abrir
window.previewFile = async function(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
            window.open(url, '_blank');
        } else {
            if (res.status === 404) {
                 showToast('El archivo ya no está disponible. Súbelo de nuevo.', 'error');
            } else {
                 showToast('Error al acceder al archivo.', 'error');
            }
        }
    } catch(e) {
        showToast('No se pudo verificar el archivo. Revisa tu conexión.', 'error');
    }
};

// Generación del botón en la tabla (openAttachments)
<button onclick="previewFile('${buildApiUrl(file.file_url.startsWith('/uploads') ? '/api' + file.file_url : file.file_url)}')" ...>
    <span class="material-symbols-outlined">visibility</span>
</button>
```

### Backend (`backend/index.js`)
Se añadió un manejador explícito para rutas de uploads inexistentes para evitar que `express.static` pase el control al router del SPA (que devolvería `index.html`).

```javascript
// Static Uploads
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Manejo explícito de 404 para uploads
app.use('/api/uploads', (req, res) => {
    res.status(404).json({
        ok: false,
        code: "FILE_NOT_FOUND",
        message: "El archivo ya no existe en el servidor"
    });
});
```

---

## 2. Evidencia

### Caso: Archivo Existe
1. Frontend llama: `HEAD http://localhost:4000/api/uploads/1709...jpg`
2. Backend responde: `200 OK`
3. Frontend ejecuta: `window.open(..., '_blank')`
4. Resultado: **Imagen/PDF visible**.

### Caso: Archivo Inexistente (404)
1. Frontend llama: `HEAD http://localhost:4000/api/uploads/borrado.jpg`
2. Backend responde:
   ```json
   {
     "ok": false,
     "code": "FILE_NOT_FOUND",
     "message": "El archivo ya no existe en el servidor"
   }
   ```
   *(Status 404)*
3. Frontend captura error y ejecuta: `showToast("El archivo ya no está disponible...")`
4. Resultado: **Mensaje rojo en esquina inferior derecha. No se abre pestaña.**

---

## 3. UX Final

- **Visualización:** El usuario hace clic en el icono "ojo".
- **Feedback Inmediato:**
  - Si carga: Se abre la pestaña instantáneamente.
  - Si falla: Aparece una notificación flotante (Toast) roja indicando el problema claramente.
- **Sin Errores Técnicos:** No hay alertas de navegador feas ni páginas en blanco con códigos de error.

---

## 4. Lección / Guardrail

**Regla de Oro para Recursos Estáticos Volátiles:**
> *"Nunca confíes ciegamente en que un archivo subido por un usuario persiste eternamente en el sistema de archivos local, especialmente en entornos efímeros (como contenedores sin volúmenes persistentes) o tras migraciones."*

**Implementación:**
1. Usar siempre `Cloud Storage` (S3/R2) en producción para persistencia real.
2. Si se usa disco local, siempre validar con `HEAD` desde el cliente antes de intentar navegar (`window.open` o `window.location`).
