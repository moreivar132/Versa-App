# ANTIGRAVITY — Visualización de Adjuntos (Fix)

## 1. El Problema
Al hacer clic en el botón de "ojo" para ver un adjunto, el navegador intentaba abrir `/uploads/contabilidad/...` en el **Frontend** (puerto 5173).
- **Error**: `Cannot GET /uploads/...` (404 Not Found)
- **Causa**: La URL del archivo es relativa y el frontend no sabe que debe pedirla al **Backend** (puerto 3000), donde realmente están los archivos.

## 2. Solución Aplicada
Se ha corregido el archivo `facturas.html`.
- **Cambio**: Ahora se detecta si la URL del archivo empieza por `/uploads` y se le añade el prefijo correcto (`/api`) y la dirección del servidor backend.
- **Resultado**: El enlace resultante será algo como `http://localhost:3000/api/uploads/contabilidad/archivo.pdf`, que es la ruta correcta donde el servidor expone los archivos.

## 3. Verificación
1.  Cierra el modal de adjuntos si está abierto.
2.  Vuelve a abrirlo.
3.  Haz clic en el ojo.
4.  Debería abrirse el archivo (imagen o PDF) en una nueva pestaña correctamente.
