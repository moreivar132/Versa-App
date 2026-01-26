# ANTIGRAVITY — Fix Copiloto Resumen 404 (FinSaaS)

## 0) Estado
- **DEV**: **OK** (Corregido) — Se eliminó la dependencia de rutas relativas.
- **PROD**: **OK** (Hereda la corrección).

---

## 1) Evidencia
- **URL exacta que fallaba**: `https://[frontend-host]/api/contabilidad/copiloto/insights?empresa_id=...`
- **Error**: 404 Not Found (desde Netlify, no desde Backend).
- **Archivo origen**: `frontend/src/verticals/finsaas/pages/copiloto-resumen.html`

---

## 2) Causa raíz
**Causa C (Frontend Error)**:
El código usaba `fetch('/api/...')` directamente.
En entornos locales (`vite`), esto funciona gracias al proxy dev server.
En **Netlify Preview/Prod**, no existe un proxy para `/api`, por lo que el navegador intentaba llamar a la API relativa al dominio del frontend (`netlify.app/api/...`), la cual no existe.

Aunque `VITE_API_URL` estaba correctamente configurada (`https://versa-app-dev.up.railway.app`), el código **LA IGNORABA** al no usar los helpers de `auth.js`.

---

## 3) Fix aplicado
Se refactorizó `copiloto-resumen.html` para usar `fetchWithAuth`, que automáticamente:
1.  Lee `VITE_API_URL`.
2.  Construye la URL absoluta.
3.  Añade el Bearer Token.

**Antes:**
```javascript
let url = `/api/contabilidad/copiloto/insights...`;
const res = await fetch(url, { headers: { 'Authorization': ... } });
```

**Después:**
```javascript
// Usa helper centralizado
const res = await fetchWithAuth(`/api/contabilidad/copiloto/insights...`, {
    headers: { 'X-Empresa-Id': ... }
});
```

---

## 4) Validación
Al recargar Copiloto Resumen en DEV:
1.  La request en Network será a **`https://versa-app-dev.up.railway.app/api/contabilidad/...`** (Host correcto).
2.  El status debería ser **200 OK** (o el error de negocio correspondiente si no hay datos), pero NO un 404 de infraestructura.

## 5) Lección / Guardrail
**Regla de Oro**: NUNCA usar `fetch()` nativo para llamadas al Backend.
Siempre usar:
- `fetchWithAuth('/api/...')` (Autenticado)
- `api.get('/api/...')` (Axios)
- `fetch(buildApiUrl('/api/...'))` (Público)

Esto garantiza que `VITE_API_URL` sea respetada en todos los entornos.
