# Cleanup: Módulos Clientes y Vehículos (Backend)

**Fecha:** 2026-01-13  
**Autor:** Staff Architect  
**Estado:** ✅ Completado

---

## 1. Resumen

Se migraron los módulos de **Clientes** y **Vehículos** de la arquitectura legacy (rutas monolíticas) a la arquitectura V2 (modular con separación de capas).

### Cambios Principales

| Componente | Antes (Legacy) | Después (V2) |
|------------|---------------|--------------|
| Rutas | `routes/clientes.js` | `src/modules/clientes/api/clientes.routes.js` |
| Lógica | Mezclada en rutas | `application/clientes.service.js` |
| Queries | `pool.query()` directo | `infra/clientes.repo.js` con `getTenantDb()` |
| RBAC | verifyJWT básico | `checkPermission()` por endpoint |
| Tests | Ninguno | `__tests__/clientes.test.js` |

---

## 2. Archivos Movidos a Legacy

Los archivos originales se conservan en `legacy/backend/` como referencia:

```
legacy/
└── backend/
    ├── clientes/
    │   └── clientes.js      # Routes legacy
    └── vehiculos/
        └── vehiculos.js     # Routes legacy
```

**NO SE BORRARON** - solo se movieron para referencia histórica.

---

## 3. Nuevos Archivos Creados

### Módulo Clientes
```
src/modules/clientes/
├── api/
│   ├── clientes.controller.js    # Handlers HTTP
│   └── clientes.routes.js        # Rutas Express + RBAC
├── application/
│   └── clientes.service.js       # Lógica de negocio
├── infra/
│   └── clientes.repo.js          # Queries DB con getTenantDb
├── validation/                    # (reservado para schemas)
├── docs/                          # (reservado para API docs)
└── __tests__/
    └── clientes.test.js          # 7 tests unitarios
```

### Módulo Vehículos
```
src/modules/vehiculos/
├── api/
│   ├── vehiculos.controller.js
│   └── vehiculos.routes.js
├── application/
│   └── vehiculos.service.js
├── infra/
│   └── vehiculos.repo.js
└── __tests__/
    └── vehiculos.test.js         # 7 tests unitarios
```

---

## 4. Endpoints (Sin Cambios)

Los endpoints mantienen exactamente las mismas rutas y respuestas:

### Clientes API

| Method | Path | Permiso | Cambio |
|--------|------|---------|--------|
| GET | `/api/clientes` | `clientes.read` | NINGUNO |
| GET | `/api/clientes/count` | `clientes.read` | NINGUNO |
| GET | `/api/clientes/search?q=...` | `clientes.read` | NINGUNO |
| GET | `/api/clientes/:id` | `clientes.read` | **NUEVO** |
| POST | `/api/clientes` | `clientes.write` | NINGUNO |
| PUT | `/api/clientes/:id` | `clientes.write` | NINGUNO |

### Vehículos API

| Method | Path | Permiso | Cambio |
|--------|------|---------|--------|
| GET | `/api/vehiculos` | `vehiculos.read` | NINGUNO |
| GET | `/api/vehiculos/search?q=...` | `vehiculos.read` | NINGUNO |
| GET | `/api/vehiculos/:id` | `vehiculos.read` | **NUEVO** |
| POST | `/api/vehiculos` | `vehiculos.write` | NINGUNO |
| PUT | `/api/vehiculos/:id` | `vehiculos.write` | NINGUNO |

---

## 5. Permisos RBAC

Se requiren los siguientes permisos en el sistema RBAC:

```
clientes.read   - Lectura de clientes
clientes.write  - Creación/edición de clientes
vehiculos.read  - Lectura de vehículos
vehiculos.write - Creación/edición de vehículos
```

**Nota:** Si estos permisos no existen en la tabla `permiso`, deben añadirse.

---

## 6. Rollback

Si hay problemas, revertir es simple:

### Paso 1: Modificar `backend/index.js`

```javascript
// Cambiar de:
const clientesRouterV2 = require('./src/modules/clientes/api/clientes.routes');
// A:
const clientesRouter = require('./routes/clientes');

// Y en el montaje:
app.use('/api/clientes', clientesRouter);  // Legacy
```

### Paso 2: Reiniciar backend

```bash
npm run dev
```

---

## 7. Tests

```bash
# Ejecutar tests de los nuevos módulos
npm test -- --testPathPattern="modules/clientes"
npm test -- --testPathPattern="modules/vehiculos"

# Todos los tests
npm test
```

---

## 8. Referencias

- `docs/GUARDRAILS.md` - Reglas de arquitectura
- `docs/MODULES/ARCHITECTURE.md` - Estructura de módulos
- `backend/src/modules/contable/` - Ejemplo de módulo V2 completo
