# Marketplace V2 — Documentación Técnica

> Vertical independiente para búsqueda y reserva de talleres.

---

## Estructura de Carpetas

```
frontend/
├── assets/js/marketplace/      # Módulos JS independientes
│   ├── api.js                  # Cliente API con normalización
│   ├── geo.js                  # Validación y markers Leaflet
│   ├── init.js                 # Inicializador principal
│   └── sucursalSelector.js     # Selector de sucursales
├── marketplace-busqueda.html   # Búsqueda pública de talleres
├── marketplace-taller.html     # Página detalle de taller
├── manager-taller-marketplace.html  # Admin panel (Manager)
└── manager-taller-marketplace.js    # Admin logic

backend/
├── api/marketplace/            # Endpoints V2 (con tenant support)
│   ├── sucursales.js           # GET /api/marketplace/sucursales
│   └── busqueda.js             # GET /api/marketplace/busqueda
├── routes/marketplace.js       # Endpoints públicos (legacy)
├── routes/marketplaceAdmin.js  # Endpoints admin
└── sql/marketplace/
    └── marketplace_audit.sql   # Script diagnóstico DB
```

---

## Contratos API (DTO)

### GET /api/marketplace/sucursales

Lista sucursales activas con coords normalizadas. Si hay autenticación, filtra por tenant.

**Response:**
```json
[
  {
    "id": 1,
    "nombre": "Taller Centro",
    "direccion": "Calle Gran Vía 45, Madrid",
    "lat": 40.4168,      // number | null (nunca string/NaN)
    "lng": -3.7038,      // number | null
    "tenant_id": 1
  }
]
```

**Observabilidad:** Si hay sucursales sin coords, se loguea:
```
[Marketplace/sucursales] 2/10 sucursales sin coordenadas válidas (tenant=1)
```

---

### GET /api/marketplace/busqueda

Búsqueda de items marketplace con paginación y filtros.

**Query Params:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `q` | string | `''` | Búsqueda texto (ILIKE en nombre, título, dirección) |
| `sucursal_id` | number | null | Filtrar por sucursal específica |
| `categoria` | string | null | Filtrar por categoría (reserved) |
| `estado` | string | `'activo'` | `activo`, `inactivo`, `todos` |
| `limit` | number | 50 | Máximo 100 |
| `offset` | number | 0 | Paginación offset |

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": 123,
      "id_sucursal": 1,
      "sucursal_nombre": "Taller Centro",
      "nombre": "Taller Centro - Madrid",
      "titulo_publico": "Taller Centro - Madrid",
      "direccion": "Calle Gran Vía 45",
      "lat": 40.4168,     // number | null (coords heredadas de sucursal si item no tiene)
      "lng": -3.7038,     // number | null
      "rating": 4.5,
      "reviews_count": 23,
      "fotos_json": "[\"url1\", \"url2\"]",
      "activo": true
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Herencia de Coordenadas (server-side):**
- Si un item no tiene `lat/lng`, se usa `COALESCE(item.lat, sucursal.lat)`.
- El frontend no necesita implementar fallback.

**Observabilidad:**
```
[Marketplace/busqueda] 3/50 items sin coordenadas válidas (tenant=1) [q=*]
```

---

## Resiliencia Frontend

### Coordenadas Nulas

El mapa **no crashea** con coords `null`. Se usa `safeAddMarker()`:

```javascript
import { safeAddMarker } from './geo.js';

// Si lat/lng son inválidos, retorna null y loguea warning
safeAddMarker(L, markersLayer, item, {
  onInvalid: (item) => console.log('Sin ubicación:', item.id)
});
```

### Container DOM Faltante

Todos los módulos validan que el container exista antes de operar:

```javascript
const el = document.getElementById('marketplace-map');
if (!el) {
  console.warn('[Marketplace] Falta #marketplace-map. Se omite mapa.');
  return null;
}
```

### Estados UI

| Estado | Condición | Mensaje |
|--------|-----------|---------|
| Loading | Durante fetch | "Cargando..." |
| Empty | `items.length === 0` | "Sin resultados" |
| Error | Fetch falla | "Error al cargar resultados" |

---

## Multi-Tenancy

Los endpoints filtran por `tenant_id` cuando el usuario está autenticado:

```javascript
// Backend extrae tenant del JWT
const tenantId = req.user?.tenant_id || null;

if (tenantId) {
  whereClause += ` AND s.tenant_id = $${params.length}`;
}
```

Para acceso público (sin auth), retorna todos los datos activos.

---

## Troubleshooting

### Error: "TypeError: null is not an object (evaluating 't.lat')"

**Causa:** Leaflet intentó crear marker con coords null.

**Solución:** 
1. Verificar que se usa `safeAddMarker()` de `geo.js`
2. Ejecutar auditoría SQL para encontrar sucursales sin coords

### Error: "TypeError: null is not an object (evaluating 'container.innerHTML')"

**Causa:** El container DOM no existía cuando se ejecutó el script.

**Solución:**
1. Asegurar que el script se ejecuta en `DOMContentLoaded`
2. Usar `byId()` con verificación de null

### Sucursales sin coordenadas

```sql
-- Encontrar sucursales sin coords
SELECT id, nombre, direccion, lat, lng 
FROM public.sucursal 
WHERE (lat IS NULL OR lng IS NULL) AND activa = true;
```

Para geocodificar, usar servicio externo (Google Geocoding API, Nominatim, etc.).

---

## Cómo Probar en Local

```bash
# 1. Iniciar backend
cd backend && npm start

# 2. Iniciar frontend
cd frontend && npm run dev

# 3. Abrir páginas
# - Búsqueda pública: http://localhost:5173/marketplace-busqueda.html
# - Admin panel: http://localhost:5173/manager-taller-marketplace.html
```

### Tests Manuales

1. **Sin datos:** Verificar que la UI muestra "Sin resultados" sin crashear
2. **Coords null:** Verificar que items aparecen en lista pero no en mapa
3. **Selector sucursal:** Cambiar sucursal y verificar que recarga datos
4. **Tabs:** Cambiar entre tabs (Perfil, Servicios, Ofertas, etc.)

---

## Scripts SQL

### Auditoría

```bash
psql -d $DATABASE_URL -f backend/sql/marketplace/marketplace_audit.sql
```

### Migración de Constraints e Índices

```bash
psql -d $DATABASE_URL -f backend/migrations/20260115_marketplace_constraints_indexes.sql
```

---

## Checklist DoD

- [x] Marketplace compila sin errores fatales
- [x] No hay TypeErrors por coords null
- [x] No hay TypeErrors por container null
- [x] Selector sucursal funciona sin crashear
- [x] API devuelve DTO estable (`lat/lng: number|null`)
- [x] Búsqueda filtra por tenant (si autenticado)
- [x] Paginación implementada (limit/offset)
- [x] Scripts SQL idempotentes
- [x] README documenta contratos y troubleshooting
- [x] No hay referencias Marketplace→Manager incorrectas
- [x] Sin dependencias nuevas

---

**Última actualización:** 2025-01-15  
**Autor:** Antigravity AI
