# ANTIGRAVITY — Copiloto Chat 401: Invalid API Key

## 0) Estado
- **Frontend**: **OK** (Refactorizado para usar `fetchWithAuth`).
- **Backend**: **FAIL** (Configuration Issue).
- **Causa**: La variable `OPENAI_API_KEY` en `backend/.env` tiene un valor inválido ("placeholder").

---

## 1) Evidencia
- **Mensaje de Error**:
  ```
  Error: 401 Incorrect API key provided: sk-proj-placeholder-local.
  You can find your API key at https://platform.openai.com/account/api-keys.
  ```
- **Origen**: Backend (`src/services/copilot/chatgpt.service.js`) intentando llamar a OpenAI.
- **Archivo Config**: `backend/.env` línea 6.

---

## 2) Diagnóstico
En `backend/.env` se encontró:
```env
OPENAI_API_KEY=sk-proj-placeholder-local
```
Este es un valor ficticio. El Copiloto requiere una clave real de OpenAI (empezando por `sk-...`) para funcionar y generar respuestas.

El frontend se comunica correctamente con el backend (ya no es error 404), pero el backend falla al contactar al proveedor de IA.

---

## 3) Acción Requerida (USER)
Para solucionar esto, por favor edita el archivo `backend/.env` y reemplaza el placeholder con una API Key válida de OpenAI (GPT-4o habilitado):

1.  Abre `backend/.env`.
2.  Busca: `OPENAI_API_KEY=sk-proj-placeholder-local`
3.  Reemplaza con tu key real:
    ```env
    OPENAI_API_KEY=sk-proj-tu-key-real-aqui...
    ```
4.  Reinicia el backend (`Ctrl+C` y `npm start` o comando equivalente) para recargar las variables.

---

## 4) Mejoras Aplicadas (Frontend)
Mientras diagnosticaba, apliqué una mejora de consistencia en `copiloto-chat.html` para usar `fetchWithAuth` en lugar de `fetch` directo. Esto asegura que la autenticación y la URL base se manejen de forma robusta, igual que en el resto de la aplicación (solucionando preventivamente posibles errores de CORS/URL en producción).

**Estado Actual**: `Copiloto Chat` está listo para funcionar en cuanto se provea la API Key válida.
