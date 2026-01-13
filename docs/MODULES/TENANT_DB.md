# TenantSafe Database Access (Versa V2)

## Objetivo
Proporcionar acceso a base de datos con **aislamiento de tenant garantizado**. Toda query multi-tenant debe pasar por el wrapper `getTenantDb(ctx)`.

## Quick Start

```javascript
// En un repositorio
const { getTenantDb } = require('../../../src/core/db/tenant-db');

async function getOrdenes(ctx) {
    const db = getTenantDb(ctx);
    
    // El tenantId viene del contexto - incluirlo explícitamente en la query
    const result = await db.query(
        'SELECT * FROM ordenes WHERE id_tenant = $1 ORDER BY created_at DESC',
        [db.tenantId]
    );
    
    return result.rows;
}
```

## API Reference

### `getTenantDb(ctx, options?)`

Crea un wrapper de DB con contexto de tenant.

**Parámetros:**
- `ctx` - Objeto de contexto (normalmente `req.context`)
  - `tenantId` (requerido) - ID del tenant
  - `userId` (opcional) - ID del usuario para auditoría
  - `requestId` (opcional) - ID de la request para correlación
  - `isSuperAdmin` (opcional) - Si es super admin
- `options` (opcional)
  - `allowNoTenant: boolean` - Permitir queries sin tenant (para rutas públicas)
  - `systemContext: boolean` - Contexto de sistema (jobs, migraciones)

**Retorna:**
- `query(sql, params)` - Ejecuta query validando tenant
- `queryRaw(sql, params)` - Query sin validación (solo super admin)
- `tx(callback)` - Ejecuta transacción
- `assertTenant()` - Lanza error si falta tenantId
- `tenantId` - El tenantId del contexto

### `getSystemDb(options?)`

Wrapper para operaciones de sistema (jobs, migraciones). **NO usar en routes/controllers.**

```javascript
// Solo en scripts de migración o jobs
const { getSystemDb } = require('./src/core/db/tenant-db');

async function migrateData() {
    const db = getSystemDb({ source: 'migration-v2' });
    await db.queryRaw('UPDATE config SET version = $1', ['2.0.0']);
}
```

## Patrones de Uso

### ✅ Correcto: Controller → Service → Repo con contexto

```javascript
// routes/ordenes.js (Controller)
router.get('/', async (req, res) => {
    const ordenes = await ordenesService.listar(req.context);
    res.json({ ok: true, data: ordenes });
});

// services/ordenesService.js
async function listar(ctx) {
    return ordenesRepo.findAll(ctx);
}

// repositories/ordenesRepo.js
const { getTenantDb } = require('../src/core/db/tenant-db');

async function findAll(ctx) {
    const db = getTenantDb(ctx);
    const result = await db.query(
        'SELECT * FROM ordenes WHERE id_tenant = $1',
        [db.tenantId]
    );
    return result.rows;
}
```

### ✅ Correcto: Transacciones

```javascript
async function crearOrdenConItems(ctx, ordenData, items) {
    const db = getTenantDb(ctx);
    
    return db.tx(async (trxDb) => {
        // Insertar orden
        const { rows: [orden] } = await trxDb.query(
            'INSERT INTO ordenes (id_tenant, cliente_id, total) VALUES ($1, $2, $3) RETURNING *',
            [trxDb.tenantId, ordenData.clienteId, ordenData.total]
        );
        
        // Insertar items
        for (const item of items) {
            await trxDb.query(
                'INSERT INTO orden_items (id_tenant, orden_id, producto_id, cantidad) VALUES ($1, $2, $3, $4)',
                [trxDb.tenantId, orden.id, item.productoId, item.cantidad]
            );
        }
        
        return orden;
    });
}
```

### ✅ Correcto: Rutas públicas (sin tenant)

```javascript
// routes/auth.js - Login no requiere tenant
router.post('/login', async (req, res) => {
    const db = getTenantDb(req.context, { allowNoTenant: true });
    
    const { rows } = await db.query(
        'SELECT * FROM usuarios WHERE email = $1',
        [req.body.email]
    );
    // ...
});
```

### ❌ Incorrecto: Acceso directo a pool

```javascript
// ❌ NO HACER - Sin validación de tenant
const pool = require('../db');
const result = await pool.query('SELECT * FROM ordenes');

// ✅ HACER en su lugar
const db = getTenantDb(ctx);
const result = await db.query('SELECT * FROM ordenes WHERE id_tenant = $1', [db.tenantId]);
```

### ❌ Incorrecto: Olvidar el filtro de tenant

```javascript
// ❌ NO HACER - Query sin filtro de tenant (fuga de datos)
const result = await db.query('SELECT * FROM ordenes');

// ✅ HACER - Siempre incluir filtro de tenant
const result = await db.query('SELECT * FROM ordenes WHERE id_tenant = $1', [db.tenantId]);
```

## Enforcement (Modo Desarrollo)

En `NODE_ENV !== 'production'`, el wrapper hace validaciones estrictas:

1. **Si falta tenantId en contexto privado**: Lanza error con mensaje descriptivo
2. **Si se intenta usar queryRaw sin ser super admin**: Lanza ForbiddenError
3. **Logs de auditoría**: Cada query loguea tenant, user y requestId

```
[TenantDb] ENFORCEMENT: tenantId no encontrado en contexto. 
Si esta es una ruta pública, usa getTenantDb(ctx, { allowNoTenant: true }). 
RequestId: abc-123
```

## Escape Hatches (Casos Especiales)

### Super Admin Cross-Tenant

Super admins pueden acceder a datos de cualquier tenant:

```javascript
// El middleware ya marca req.context.isSuperAdmin = true
if (ctx.isSuperAdmin) {
    const db = getTenantDb(ctx);
    // queryRaw permitido para super admin
    await db.queryRaw('SELECT * FROM ordenes WHERE id_tenant = $1', [targetTenantId]);
}
```

### Jobs y Migraciones

Para scripts que corren fuera de requests HTTP:

```javascript
const { getSystemDb } = require('./src/core/db/tenant-db');

async function dailyCleanupJob() {
    const db = getSystemDb({ source: 'daily-cleanup' });
    
    // queryRaw permitido en contexto de sistema
    await db.queryRaw('DELETE FROM logs WHERE created_at < NOW() - INTERVAL \'30 days\'');
}
```

## Migración Gradual

El wrapper permite migración incremental. Los métodos legacy siguen funcionando pero están marcados como `@deprecated`:

```javascript
// DEPRECADO - seguirá funcionando pero genera warning
const { pool } = require('./src/core/db');
await pool.query('...');

// NUEVO - usar este patrón
const { getTenantDb } = require('./src/core/db/tenant-db');
const db = getTenantDb(ctx);
await db.query('...');
```

## Checklist de Seguridad

- [ ] Toda query a tablas multi-tenant incluye `WHERE id_tenant = $X`
- [ ] El contexto (`ctx`) se pasa desde el controller hasta el repo
- [ ] No hay acceso directo a `pool` fuera de `src/core/db`
- [ ] Las rutas públicas usan `allowNoTenant: true`
- [ ] Los jobs usan `getSystemDb()` con source identificable

## Próximos Pasos (Fase 2)

- **Row Level Security (RLS)**: Implementar políticas de Postgres para doble validación
- **Audit Log**: Registrar todas las operaciones con tenant, user, timestamp
- **Linting**: Regla ESLint para detectar uso de `pool.query` fuera de core/db
