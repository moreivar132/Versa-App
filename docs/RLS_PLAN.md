# RLS (Row Level Security) — Plan de Implementación VERSA

**Fecha:** 13 de Enero, 2026  
**Última Actualización:** 21 de Enero, 2026  
**Estado:** 🔴 FASE 0 — Pre-requisitos pendientes  
**Objetivo:** Eliminar el riesgo de "data leak" entre tenants implementando aislamiento automático a nivel de PostgreSQL.

> [!CAUTION]
> **AUDITORÍA 2026-01-21:** Se detectaron **195 archivos** que bypassean `getTenantDb(ctx)`.  
> Antes de habilitar RLS, se debe migrar el código legacy al patrón tenant-safe.  
> Ver: `docs/AUDITS/TENANT_DB_OUTSIDE_REPORT.md`

---

## CHANGELOG

| Fecha | Cambio |
|-------|--------|
| 2026-01-21 |- **Batch A5 (2026-01-21):** Refactored `egresos`, `tesoreria`, `empresa` controllers and Banking services.
- **Batch A6 (2026-01-21):** Refactored `finsaasRbac`, `deducible`, `copiloto`, `documentos` controllers and `empresa.middleware`. Verified DB Guardrails.
- **Batch A12**: Refactored `backend/services/notificacionService.js`, `backend/routes/auth.js`, `backend/routes/googleAuth.js`, `backend/routes/customerGoogleAuth.js`, `backend/routes/trabajadores.js`.
- **Batch A13**: Refactored `backend/routes/marketplace.js`, `backend/routes/marketplaceAdmin.js`, `backend/routes/meRoutes.js`, `backend/services/marketplaceService.js`, `backend/services/customerPortalService.js`. Also fixed widespread import errors in models and services.
- **Batch A14**: Refactored `documentos.controller.js`, `ventaPDFService.js`, `ordenPDFService.js`, `unifiedNotificationService.js`, `auditService.js`, `makeEmailProvider.js`. **Violations: 0**.
- **2026-01-22**: Batch A14 completed. **100% Runtime Adoption Achieved.** Zero `pool.query` violations in active code.
- **2026-01-21**: Batch A13 completed (Marketplace & Systemic Fix).
- **2026-01-21**: Batch A12 completed (Routes). Guardrails 64→48.
- **2026-01-21**: Batch A11 completed (Security Core). Guardrails down to 64.
- **2026-01-21**: Batch A10 completed (Invite/Auth/Services).
- **2026-01-21**: Batch A9 completed (Payments & Auth). Verified DB Guardrails.
- **2026-01-21**: Batch A8 completed (Core Models). 
- **2026-01-21**: Batch A7 completed (Banking & Copilot Services).
- **2026-01-21**: Batch A6 completed (FinSaaS Controllers). and 2 services. Verified DB Guardrails. |
| 2026-01-21 | Batch A4: Refactored 3 routes and 2 services. Verified DB Guardrails. |
| 2026-01-21 | Batch A3: Refactorizado WhatsApp/Chat/Citas para eliminar `pool`. |
| 2026-01-21 | Estado cambiado de FASE 1 a FASE 0. Auditoría reveló 195 archivos con bypass. |
| 2026-01-13 | Documento inicial creado. |

---

## 1. Contexto y Problema

Actualmente el aislamiento multi-tenant depende de:
1. Que el desarrollador **siempre** incluya `WHERE id_tenant = $1` en cada query
2. Que el wrapper `getTenantDb(ctx)` valide el contexto antes de ejecutar

**Riesgo:** Un descuido en una nueva query expone datos de un tenant a otro. PostgreSQL no impide el acceso a rows de otros tenants.

**Solución:** Row Level Security (RLS) como **última línea de defensa** automática.

---

## 2. Estrategia de Implementación

### 2.1 Variables de Sesión

PostgreSQL permite setear variables de sesión por transacción:

```sql
-- Al inicio de cada request/transacción
SET LOCAL app.tenant_id = '123';
SET LOCAL app.is_superadmin = 'false';
```

Estas variables se consultan en las policies RLS.

### 2.2 Funciones Helper (Opcional pero recomendado)

```sql
CREATE OR REPLACE FUNCTION app_current_tenant() 
RETURNS BIGINT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::BIGINT;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_is_superadmin() 
RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.is_superadmin', true), 'false')::BOOLEAN;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 2.3 Patrón de Policy

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY; -- Aplica incluso a table owner

CREATE POLICY tenant_isolation ON <tabla>
  FOR ALL
  TO PUBLIC
  USING (
    app_is_superadmin() = true 
    OR id_tenant = app_current_tenant()
  )
  WITH CHECK (
    app_is_superadmin() = true 
    OR id_tenant = app_current_tenant()
  );
```

---

## 3. Scope FASE 1 — Tablas Objetivo

### 3.1 Criterios de Inclusión
- ✅ Tabla tiene columna `id_tenant` directa (NOT NULL)
- ✅ Tabla contiene datos sensibles o de negocio
- ⚠️ Tabla sin `id_tenant` pero hija de tabla con tenant → se hereda vía FK

### 3.2 Tablas con `id_tenant` directo (Prioritarias)

| Tabla | Columna Tenant | Estado | Riesgo |
|-------|---------------|--------|--------|
| `clientefinal` | `id_tenant` | ✅ Existe | ALTO |
| `contabilidad_factura` | `id_tenant` | ✅ Existe | ALTO |
| `contabilidad_contacto` | `id_tenant` | ✅ Existe | ALTO |
| `contabilidad_trimestre` | `id_tenant` | ✅ Existe | MEDIO |
| `contable_category` | `id_tenant` | ✅ Existe | BAJO |
| `contable_bill` | `id_tenant` | ✅ Existe | ALTO |
| `marketplace_listing` | `id_tenant` | ✅ Existe | MEDIO |
| `venta` | `id_tenant` | ✅ Existe | ALTO |
| `income_event` | `id_tenant` | ✅ Existe | ALTO |
| `email_config` | `id_tenant` | ✅ Existe | BAJO |
| `email_template` | `id_tenant` (nullable) | ⚠️ Revisar | BAJO |
| `user_dashboard_prefs` | `id_tenant` | ✅ Existe | BAJO |
| `fidelizacion_programa` | `id_tenant` | ✅ Existe | MEDIO |
| `facturaconfigtenant` | `id_tenant` | ✅ Existe | BAJO |
| `sucursal` | `id_tenant` | ✅ Existe | ALTO |
| `usuario` | `id_tenant` | ✅ Existe | ALTO |

### 3.3 Tablas SIN `id_tenant` directo (Candidatas a desnormalización)

| Tabla | Cómo obtener tenant | Acción Recomendada |
|-------|--------------------|--------------------|
| `orden` | Via `id_sucursal → sucursal.id_tenant` | **DESNORMALIZAR** (añadir `id_tenant`) |
| `ordenlinea` | Via `id_orden → orden → sucursal` | Heredar política de `orden` |
| `ordenpago` | Via `id_orden` | Heredar política de `orden` |
| `vehiculo` | Via `id_cliente → clientefinal.id_tenant` | **DESNORMALIZAR** o heredar |
| `caja` | Via `id_sucursal` | Heredar o desnormalizar |
| `cajamovimiento` | Via `id_caja → caja` | Heredar |
| `producto` | Via `id_tenant` (verificar) | Verificar existencia |
| `proveedor` | Via `id_tenant` (verificar) | Verificar existencia |

### 3.4 FASE 1: Tablas a Proteger Inmediatamente

**Prioridad CRÍTICA (finanzas + datos sensibles):**
1. `clientefinal`
2. `contabilidad_factura`
3. `contabilidad_contacto`
4. `contabilidad_trimestre`
5. `contable_category`
6. `venta`
7. `income_event`
8. `sucursal`
9. `usuario`

---

## 4. Bypass Super-Admin

### 4.1 Mecanismo
El super-admin necesita acceso cross-tenant para:
- Soporte técnico
- Migraciones
- Jobs de sistema
- Reportes globales

### 4.2 Implementación

```js
// En tenant-db.js
if (ctx.isSuperAdmin === true) {
  await client.query("SET LOCAL app.is_superadmin = 'true'");
  await client.query("SET LOCAL app.tenant_id = ''"); // vacío
} else {
  await client.query("SET LOCAL app.is_superadmin = 'false'");
  await client.query(`SET LOCAL app.tenant_id = '${ctx.tenantId}'`);
}
```

### 4.3 Auditoría del Bypass
Cada vez que se active super-admin, registrar:

```js
logger.warn({
  requestId: ctx.requestId,
  userId: ctx.userId,
  action: 'SUPERADMIN_BYPASS',
  targetTable: 'ALL',
  reason: ctx.bypassReason || 'not specified'
}, 'Super-admin RLS bypass activated');
```

---

## 5. Cambios Required en DB Wrapper

### 5.1 Flujo Actual (Inseguro)
```
Request → verifyJWT → getTenantDb(ctx) → pool.query(SQL)
                         ↓
              valida ctx.tenantId pero NO setea RLS
```

### 5.2 Flujo Nuevo (Seguro)
```
Request → verifyJWT → getTenantDb(ctx) → BEGIN TX
                         ↓
              SET LOCAL app.tenant_id = ctx.tenantId
              SET LOCAL app.is_superadmin = ctx.isSuperAdmin
                         ↓
              QUERY (RLS bloquea si ctx incorrecto)
                         ↓
              COMMIT/ROLLBACK
```

### 5.3 API del Wrapper

```js
// Transacción con contexto automático (RECOMENDADO)
const result = await tenantDb.tx(ctx, async (db) => {
  return db.query('SELECT * FROM clientefinal WHERE nombre ILIKE $1', ['%juan%']);
});

// Query simple con transacción implícita (para reads simples)
const rows = await tenantDb.query(ctx, 'SELECT * FROM sucursal', []);
```

---

## 6. Plan de Rollback (Emergencia)

Si RLS causa problemas en producción:

```sql
-- Desactivar RLS temporalmente (SOLO EMERGENCIA)
ALTER TABLE clientefinal DISABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad_factura DISABLE ROW LEVEL SECURITY;
-- ... resto de tablas

-- Para reactivar:
ALTER TABLE clientefinal ENABLE ROW LEVEL SECURITY;
```

**Script de emergencia:** `backend/scripts/emergency/disable_rls.sql`

---

## 7. Verificación Pre-Deploy

### 7.1 Checklist

- [ ] Todas las tablas FASE 1 tienen RLS habilitado
- [ ] Policies creadas con bypass super-admin
- [ ] Wrapper setea `SET LOCAL` en TODAS las queries
- [ ] Tests de no-fuga pasando (tenant A no ve B)
- [ ] Tests de super-admin pasando (ve todos los tenants)
- [ ] Script de rollback probado en staging

### 7.2 Comando de Verificación

```sql
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## 8. Timeline Estimado

| Fase | Tarea | Duración |
|------|-------|----------|
| 0 | Crear funciones helper SQL | 1h |
| 1 | Migración: habilitar RLS en tablas FASE 1 | 2h |
| 2 | Actualizar `tenant-db.js` con SET LOCAL | 3h |
| 3 | Crear tests de no-fuga | 2h |
| 4 | Probar en staging | 2h |
| 5 | Deploy a producción (horario bajo tráfico) | 1h |

**Total estimado:** 11 horas de trabajo / 2-3 días calendario

---

## 9. Evidencia Faltante

Para completar este plan necesito:

1. **[VERIFICAR]** ¿La tabla `orden` tiene columna `id_tenant`? (grep sugiere que no)
2. **[VERIFICAR]** ¿La tabla `producto` tiene columna `id_tenant`?
3. **[VERIFICAR]** ¿La tabla `proveedor` tiene columna `id_tenant`?
4. **[VERIFICAR]** ¿El rol de conexión a Neon tiene permisos para `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?

---

## 10. Referencias

- [PostgreSQL RLS Docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-tenancy with RLS](https://www.crunchydata.com/blog/implementing-multi-tenancy-with-row-level-security-in-postgresql)
- Auditoría anterior: `docs/AUDIT_2026_01_13.md`
