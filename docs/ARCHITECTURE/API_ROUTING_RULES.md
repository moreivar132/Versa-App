# Reglas de Enrutamiento de API (Frontend)

## 🚫 PROHIBIDO: Rutas Relativas
Está terminantemente prohibido usar rutas relativas para llamadas a la API.

**Incorrecto ❌:**
```javascript
fetch('/api/auth/login');
axios.get('/api/contabilidad/empresas');
```

**Por qué:**
Las rutas relativas dependen de que el servidor que sirve el Frontend (Netlify/Vercel) sepa redirigir al Backend. Esto causa problemas graves de mezcla de entornos (Prod conectando a Dev, o Dev a Prod) y depende de archivos de configuración externos (`_redirects`, `vercel.json`) que no son robustos.

## ✅ OBLIGATORIO: URLs Absolutas
Todas las llamadas deben usar la variable de entorno `VITE_API_URL` para construir la URL completa hacia el backend adecuado.

**Correcto ✅:**
```javascript
import { buildApiUrl } from '/auth.js';

const url = buildApiUrl('/api/auth/login');
fetch(url);
```

O usando el cliente centralizado:
```javascript
import apiClient from '/services/api-client.js';

apiClient.get('/auth/login'); // El cliente ya tiene la baseURL configurada
```

## 🛡️ Guardrails Automáticos
El proyecto cuenta con un script de protección que se ejecuta en CI:
`npm run guard:api`

Este script escanea el código fuente y falla si detecta patrones como `fetch('/api` o `axios.get('/api`.

## Entornos
- **DEV:** `VITE_API_URL` = `https://versa-app-dev.up.railway.app`
- **PROD:** `VITE_API_URL` = `https://versa-app.up.railway.app`
