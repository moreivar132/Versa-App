# ANTIGRAVITY — Visualización de Adjuntos en Egresos (Fix)

## 1. El Problema
Al subir un gasto, la vista previa o el enlace "Abrir" fallaban con un error 404 (`Ruta GET /uploads/... no encontrado`).
- **Causa**: La URL generada para el archivo subido era relativa (`/uploads/...`) y el frontend intentaba cargarla directamente, pero el servidor espera que las URLs estáticas lleven el prefijo `/api/uploads`.

## 2. Solución Aplicada
Se ha modificado `gastos-nuevo.html` en la función `showReview`.
- **Lógica Mejorada**:
  1. Si hay un ID de "Intake" (lo normal al subir), se usa el endpoint seguro `/api/contabilidad/documentos/intake/...` usando `buildApiUrl`.
  2. Si no hay ID (caso raro), se detecta si la ruta empieza por `/uploads` y se le antepone `/api` manualmente, quedando `/api/uploads/...`.
  3. Se usa siempre `buildApiUrl` para asegurar que apunta al backend correcto.

## 3. Verificación
1.  Intenta subir un gasto nuevamente o recarga la página con `?intakeId=...`.
2.  El enlace de "Abrir" y la vista previa deberían funcionar correctamente.
