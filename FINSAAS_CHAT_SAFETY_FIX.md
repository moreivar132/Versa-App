# ANTIGRAVITY — Chat Session Safety Fix (401 Redirects)

## 0) Estado
- **Problema Solucionado**: El chat cerraba la sesión del usuario al recibir un error de configuración de IA (Invalid API Key).
- **Causa Confirmada**: Backend devolvía un `401 Unauthorized` (proveniente de OpenAI) al frontend. El cliente interpretaba cualquier 401 como "Token de usuario inválido" y forzaba logout.
- **Backend Actual**: **OK**. Ahora encapsula errores externos correctamente.

---

## 1) Evidencia
- **Antes**:
  - OpenAI Error: `401 Unauthorized`.
  - Backend Response: `401 Unauthorized`.
  - Frontend Action: `auth.js` -> `clearSession()` -> `window.location.href = '/login'`.

- **Después**:
  - OpenAI Error: `401 Unauthorized`.
  - Backend Response: `502 Bad Gateway` (Error de servicio externo).
  - Frontend Action: Muestra el error en el chat ("Error del servidor...") pero MANTIENE la sesión activa.

---

## 2) Fix Aplicado
Se modificó `backend/src/modules/contable/api/controllers/copiloto.controller.js`.
Se interceptan los errores con `status: 401` (típicos de librerías externas como OpenAI) y se transforman a `502` antes de enviar la respuesta al cliente.

Snippet del cambio:
```javascript
// Prevent frontend logout on OpenAI 401 errors
let status = error.status || 500;
if (status === 401) {
    status = 502; // Bad Gateway
}
res.status(status).json({ ok: false, error: error.message });
```

---

## 3) Próximos Pasos (Usuario)
El logout accidental ya no ocurrirá. Sin embargo, para que el chat funcione, **aún es necesario configurar la API Key real**:

1.  Edita `backend/.env`.
2.  Pon tu key válida en `OPENAI_API_KEY`.
3.  Reinicia el backend.

Ahora puedes probar el chat sin miedo a ser desconectado.
