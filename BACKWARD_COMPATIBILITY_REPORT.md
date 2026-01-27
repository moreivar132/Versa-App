# ANTIGRAVITY — Audit Report: Upload Preview Backward Compatibility

## 0. Respuesta Directa
- **¿Se pueden ver archivos antiguos?** → **SÍ**
- **Condición exacta:** El archivo físico debe existir en `backend/uploads/contabilidad` (o la ruta correspondiente). **El cambio NO altera rutas, solo agrega validación.**

---

## 1. Tabla de Análisis de Casos

| Caso | Archivo en Disco | API `exists` | Icono ("Ojo") | Comportamiento al Clic |
|------|------------------|--------------|---------------|------------------------|
| **A (Normal)** | ✅ **SÍ** | `true` | `visibility` (Gris/Verde) | Abre el archivo en nueva pestaña. |
| **B (Perdido)** | ❌ **NO** | `false` | `visibility_off` (Rojo) | Muestra Toast: "Este archivo no existe en el disco." (No hace fetch). |
| **C (Legacy/Migración)** | ✅ **SÍ** | `true` | `visibility` | Funciona igual que el Caso A. La ruta `/api/uploads/...` sigue activa. |

---

## 2. Impacto del Cambio

### ¿Qué cambia?
1. **Backend (`facturas.controller.js`):**
   - Ahora el endpoint `GET .../archivos` verifica físicamente si el archivo existe en el disco (`fs.existsSync`) antes de responder.
   - Agrega la propiedad `exists: boolean` a cada objeto de archivo.
2. **Frontend (`facturas.html`):**
   - Lee la propiedad `file.exists`.
   - Si es `false`, renderiza un icono de **ojo tachado (`visibility_off`)** en color rojo.
   - Evita realizar la petición `HEAD` o `GET` si ya sabe que no existe, eliminando errores 404 en la consola del navegador.

### ¿Qué NO cambia?
- **Las rutas de archivos:**
  - La URL sigue siendo `/uploads/contabilidad/archivo.ext`.
  - El servidor de estáticos (`express.static`) sigue sirviendo desde `backend/uploads`.
- **La base de datos:** No se modifican registros.

### ¿Por qué NO rompe compatibilidad?
La lógica de resolución de rutas (`process.cwd() + '/backend' + file_url`) apunta exactamente al mismo lugar donde `upload.js` y `facturas.controller.js` guardaron los archivos originalmente (`backend/uploads/contabilidad`). Si el archivo estaba ahí antes, el sistema lo detectará como `exists: true` y funcionará normalmente.

---

## 3. Recomendación Final

### Archivos Antiguos Perdidos (Caso B)
Si aparecen archivos con el ojo rojo (`exists: false`):
1. **Acción Inmediata:** El usuario recibe feedback claro ("Archivo no existe") sin errores técnicos.
2. **Solución:** Recomendar al usuario volver a subir el archivo si es crítico, usando el botón de "Subir" existente en la interfaz.

### Comunicación al Usuario
> "Hemos optimizado la visualización de adjuntos. Si ves un icono de ojo tachado en rojo, significa que el archivo original no se encuentra en el servidor y deberás subirlo nuevamente si lo necesitas."

---

## Estado Final
✅ **Backward Compatibility:** CONFIRMADA
✅ **Optimization:** APLICADA (Eliminación de requests muertos)
✅ **UX:** MEJORADA (Feedback visual proactivo)
