# Guardrails y Calidad (Versa V2)

Este documento establece las líneas rojas y el estándar de calidad que debe cumplir cada cambio de código.

## 🚫 Prohibiciones (Hard Guards)
1.  **NO SQL en Rutas/Controllers**: Las consultas deben vivir exclusivamente en `repositories/`.
2.  **NO Lógica de Negocio en Frontend**: El frontend solo muestra datos y envía inputs. Los cálculos de precios, validaciones de stock y reglas de negocio viven en el Backend (Services).
3.  **NO Hardcoded Secrets**: Nunca subir claves de API o credenciales. Usar `.env`.
4.  **NO Queries Cross-Module**: Un repositorio no puede consultar tablas de otro módulo. Usar la API pública del módulo destino.
5.  **NO Auth Bypass**: Cada nuevo endpoint debe pasar por el middleware de autenticación y validación de tenant a menos que sea explícitamente público (ej: login).
6.  **NO `pool.query()` directo**: Usar `getTenantDb(ctx)` para todas las queries. Ver [docs/TENANT_DB.md](./TENANT_DB.md).
7.  **NO queries sin filtro de tenant**: Toda query a tablas multi-tenant debe incluir `WHERE id_tenant = $X` (aunque RLS esté activo, mantenerlo por claridad).
8.  **NO confiar SOLO en WHERE**: RLS es la última línea de defensa. El código debe seguir filtrando por tenant.
9.  **NO migraciones manuales**: Todo cambio de schema debe hacerse via Knex. Ver [docs/MIGRATIONS.md](../MIGRATIONS.md).
10. **NO ejecutar scripts SQL sueltos en producción**: Los scripts de `legacy/sql-migrations/` son solo referencia.

## 🔒 Row Level Security (RLS)

> **Estado: ACTIVO desde 2026-01-13**

### ¿Qué es RLS?
PostgreSQL Row Level Security bloquea automáticamente acceso a rows de otros tenants, incluso si el código tiene un bug y olvida el `WHERE id_tenant`.

### Reglas RLS
1.  **RLS NO es excusa para omitir `WHERE id_tenant`**: Mantén los filtros explícitos por claridad y rendimiento (índices).
2.  **Bypass de Super-Admin**: Solo usuarios con `is_super_admin = true` pueden ver cross-tenant, y queda auditado.
3.  **Variables de Sesión**: El wrapper `getTenantDb()` setea `SET LOCAL app.tenant_id` automáticamente.
4.  **Operaciones de Sistema**: Usar `getSystemDb({ reason: 'descripción' })` para jobs/migraciones.

### Tablas Protegidas (FASE 1)
- `clientefinal`
- `contabilidad_*` (factura, contacto, trimestre)
- `contable_category`, `contable_bill`
- `venta`, `income_event`
- `sucursal`, `usuario`
- `marketplace_listing`, `fidelizacion_programa`

### Feature Flag de Emergencia
```bash
# Desactiva SET LOCAL (RLS sigue activo pero sin contexto forzado)
RLS_ENABLED=false npm start
```

Ver: [docs/RLS_PLAN.md](../RLS_PLAN.md) | [docs/RLS_TESTS.md](../RLS_TESTS.md)

---

## ✅ Definition of Done (DoD)
Para dar una tarea por terminada, debe cumplir:
- [ ] El código sigue la estructura `Controller -> Service -> Repository`.
- [ ] No hay logs de debug (`console.log`) en producción.
- [ ] Se han actualizado/creado los tests unitarios para la lógica nueva.
- [ ] Se ha verificado que el aislamiento multi-tenant funciona correctamente.
- [ ] La documentación del módulo (en `/docs/MODULES/`) ha sido actualizada si hubo cambios en la API o esquema.
- [ ] **NUEVO**: Para tablas con RLS, verificar que las queries funcionan con el contexto de tenant.

## 🔍 Guía de Revisión de PRs
Al revisar un Pull Request, busca:
- **Acoplamiento**: ¿Este PR introduce una dependencia circular?
- **Seguridad**: ¿Se está validando el `id_tenant` en las queries?
- **Escalabilidad**: ¿Hay una query dentro de un loop? (Problema N+1).
- **Consistencia**: ¿Los nombres de las variables y funciones siguen el estándar del proyecto?
- **RLS**: ¿El código usa `getTenantDb(ctx).txWithRLS()` para operaciones de escritura?

## 🔐 Tenant Context (Multi-tenancy)

### Regla de Oro
**Toda ruta privada DEBE tener un `tenantId` en `req.context.tenantId`.**

### Defensa en Profundidad
```
Capa 1: JWT verifica identidad del usuario
Capa 2: Middleware extrae tenantId al contexto
Capa 3: getTenantDb() valida que tenantId existe
Capa 4: RLS de PostgreSQL bloquea acceso a rows de otros tenants (ÚLTIMA DEFENSA)
```

### ¿Cómo se obtiene el tenantId?
1. El usuario se autentica via JWT (`verifyJWT` middleware)
2. El JWT contiene `id_tenant` del usuario
3. El middleware `tenantContextMiddleware` extrae y normaliza este valor en `req.context.tenantId`
4. Super admins pueden operar en cualquier tenant (via header `x-tenant-id`)

### ¿Cómo usar en nuevas rutas?
```javascript
// En index.js, usar `privateRoute` para rutas que requieren auth + tenant:
app.use('/api/mi-modulo', privateRoute, require('./routes/miModulo'));

// En el route handler, acceder al tenantId:
const tenantId = req.context.tenantId;
// O usar el helper:
const { getTenantId } = require('./src/core/http/middlewares/tenant-context');
const tenantId = getTenantId(req);

// Para operaciones de escritura, usar txWithRLS:
const db = getTenantDb(req.context);
await db.txWithRLS(async (trxDb) => {
  await trxDb.query('INSERT INTO ...', [...]);
});
```

### Rutas Públicas (excluidas del tenant check)
Las siguientes rutas NO requieren `tenantId`:
- `/api/auth/*` - Login, registro, refresh
- `/api/cliente/auth/*` - Auth de clientes finales
- `/api/portal/*` - Portal de citas (usa auth propio)
- `/api/stripe/webhook` - Webhook de Stripe
- `/api/public/*` - Rutas públicas genéricas
- `/api/marketplace` - Búsqueda pública
- `/api/db-test`, `/health` - Health checks

---

*"Si no tiene tests, rompe el aislamiento entre módulos, o bypasea RLS sin justificación, no se mergea."*

