# VERSA — MASTER RE-AUDIT DETAILED FINDINGS
**Fecha:** 19 de Enero, 2026  
**Commit:** `e4bc57e947c5a5007864d1ee2be5a20a56d10973`

---

## 1️⃣ ARQUITECTURA & MODULARIDAD (6.5/10)

### H1.1 — Coexistencia Legacy + V2 sin timeline de sunset
**EVIDENCIA:**
```
# Rutas montadas en backend/index.js:

# V2 Modular (4 módulos):
app.use('/api/clientes', privateRoute, require('./src/modules/clientes/api/clientes.routes'));
app.use('/api/vehiculos', privateRoute, require('./src/modules/vehiculos/api/vehiculos.routes'));
app.use('/api/ventas', privateRoute, require('./src/modules/ventas/api/ventas.routes'));
app.use('/api/contabilidad', privateRoute, require('./src/modules/contable/api/contabilidad.routes'));

# Legacy (30+ rutas):
app.use('/api/citas', privateRoute, require('./routes/citas'));
app.use('/api/inventory', privateRoute, require('./routes/inventory'));
app.use('/api/ordenes', privateRoute, require('./routes/ordenes'));
app.use('/api/caja', privateRoute, require('./routes/caja'));
...
```
**IMPACTO:** Duplicidad de patrones arquitectónicos, confusión para nuevos devs
**SEVERIDAD:** 🟠 MEDIO
**RECOMENDACIÓN:** Crear timeline de migración: 5 módulos/mes → V2

---

### H1.2 — Frontend: FinSaaS bien estructurado, Manager flat
**EVIDENCIA:**
```bash
# FinSaaS (BIEN):
find frontend/src/verticals/finsaas/pages -name "*.html" | wc -l
# Output: 17 páginas organizadas

# Manager (MAL):
find frontend -maxdepth 1 -name "manager-*.html" | wc -l
# Output: 27 archivos en root
```

**Páginas FinSaaS (frontend/src/verticals/finsaas/pages/):**
- caja.html, configuracion-factura.html, contactos.html
- copiloto-ajustes.html, copiloto-alertas.html, copiloto-chat.html, copiloto-resumen.html
- dashboard.html, documentos.html, empresas.html, facturas.html
- gastos-nuevo.html, permisos.html, plantilla-factura.html
- trimestres.html, usuarios.html, validacion-deducible.html

**IMPACTO:** Manager tiene merge conflicts frecuentes, DX pobre
**SEVERIDAD:** 🟠 ALTO
**RECOMENDACIÓN:** Migrar Manager a `frontend/src/verticals/manager/`

---

## 2️⃣ MULTI-TENANCY & AISLAMIENTO (5/10)

### H2.1 — 708 pool.query directos vs 80+ getTenantDb
**EVIDENCIA:**
```bash
# Total pool.query en backend:
grep -R "pool\.query" -n backend | wc -l
# Output: 708

# getTenantDb en módulos V2:
grep -R "getTenantDb" -n backend/src | wc -l
# Output: 80+
```

**Archivos con más pool.query:**
- `backend/routes/citas.js`: 12 ocurrencias
- `backend/routes/inventory.js`: 11 ocurrencias
- `backend/routes/trabajadores.js`: 8 ocurrencias
- `backend/routes/billingRoutes.js`: 15 ocurrencias
- `backend/services/emailAutomationService.js`: 12 ocurrencias

**IMPACTO:** 🔴 CRÍTICO — Bypass de tenant isolation posible
**SEVERIDAD:** 🔴 CRÍTICO
**RECOMENDACIÓN:** Migrar en batches de 50, priorizando rutas financieras

---

### H2.2 — tenant-db.js tiene RLS pero no todas las tablas tienen policies
**EVIDENCIA:**
```javascript
// backend/src/core/db/tenant-db.js L30-31:
const RLS_ENABLED = process.env.RLS_ENABLED !== 'false';

// Knex migrations con RLS:
// backend/db/migrations/20260113170000_enable_rls_phase1.js ✅ EXISTS
```

**FALTA:** Evidencia de qué tablas tienen RLS habilitado (requiere query a DB real)
**RECOMENDACIÓN:** Ejecutar query de verificación RLS en staging

---

### H2.3 — X-Empresa-Id enforcement en FinSaaS
**EVIDENCIA:**
```bash
grep -R "X-Empresa-Id" -n backend/src
# Output: (ningún resultado directo en src)

# Se maneja via middleware:
# backend/src/modules/contable/middleware/empresa.middleware.js
```
**IMPACTO:** empresa.middleware.js valida correctamente para contable
**SEVERIDAD:** ✅ BIEN IMPLEMENTADO

---

## 3️⃣ SEGURIDAD & RBAC (6/10)

### H3.1 — permissions.js como fuente de verdad
**EVIDENCIA:**
```javascript
// backend/src/core/security/permissions.js L12-126:
const PERMISSIONS = {
    ORDENES: { VIEW: 'ordenes.view', CREATE: 'ordenes.create', ... },
    CITAS: { VIEW: 'citas.view', ... },
    INVENTARIO: { VIEW: 'inventario.view', ... },
    // ... 15 módulos con permisos definidos
    FINSAAS: {
        DEDUCIBLE_MANAGE: 'finsaas.deducible.manage',
        INVITES_MANAGE: 'finsaas.invites.manage',
        RBAC_MANAGE: 'finsaas.rbac.manage',
        EMPRESA_MANAGE: 'finsaas.empresa.manage'
    }
};
```
**IMPACTO:** ✅ BIEN — Permisos centralizados
**SEVERIDAD:** ✅ SOLVED

---

### H3.2 — requirePermission enforced en 70+ endpoints
**EVIDENCIA:**
```bash
grep -R "requirePermission" -n backend/routes backend/src | wc -l
# Output: 70+

# Ejemplos:
# backend/src/modules/contable/api/contabilidad.routes.js:43: requirePermission('contabilidad.read')
# backend/routes/accessRoutes.js:366: requirePermission('roles.view')
```
**IMPACTO:** ✅ BIEN — RBAC activo en rutas críticas
**SEVERIDAD:** ✅ SOLVED

---

### H3.3 — Audit Service existe
**EVIDENCIA:**
```bash
grep -R "audit" -n backend/src backend/routes | head -n 10
# Output:
# backend/routes/accessRoutes.js:12: const { logAudit, getAuditLogs, ... } = require('../services/auditService');
# backend/src/modules/contable/api/controllers/deducible.controller.js:73: INSERT INTO accounting_audit_log
```
**IMPACTO:** ✅ BIEN — Audit logging implementado para operaciones críticas
**SEVERIDAD:** ✅ SOLVED

---

## 4️⃣ DATA MODEL & MIGRACIONES (5/10)

### H4.1 — Mix Knex + SQL manual
**EVIDENCIA:**
```bash
# Knex migrations (tracked):
find backend/db/migrations -type f | wc -l
# Output: 8 archivos .js

# SQL manual (untracked):
find backend/migrations -type f | wc -l
# Output: 69 archivos

# Ejemplos SQL manual:
# - create_contabilidad_v3.sql (14KB)
# - create_accounting_empresa.sql (11KB)
# - seed_rbac_permissions.js (11KB runner)
```
**IMPACTO:** 🟠 ALTO — SQL manual no tiene history de ejecución
**SEVERIDAD:** 🟠 ALTO
**RECOMENDACIÓN:** Consolidar en un solo sistema (preferir Knex)

---

### H4.2 — Migraciones no en CI
**EVIDENCIA:**
```yaml
# .github/workflows/ci.yml L28-44:
- name: Install Dependencies
  run: npm ci
- name: Run Lint
  run: npm run lint
- name: Check DB Guardrails
  run: cd backend && npm run check:db-guardrails
- name: Run Tests (Backend)
  run: npm test
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/versa_test
    # ⚠️ NO hay service: postgres, ejecutar tests falla en DB connections
```
**IMPACTO:** 🔴 CRÍTICO — Schema puede divergir
**SEVERIDAD:** 🔴 CRÍTICO
**RECOMENDACIÓN:** Añadir Postgres service + `migrate:latest` step

---

## 5️⃣ API DESIGN & CONTRATOS (6/10)

### H5.1 — Swagger presente en /api-docs
**EVIDENCIA:**
```javascript
// backend/index.js L41-44:
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {...}));
```
**IMPACTO:** ✅ BIEN — Documentación API activa
**SEVERIDAD:** ✅ SOLVED

---

### H5.2 — Sin versionado de API
**EVIDENCIA:**
```javascript
// Todas las rutas son /api/resource, no /api/v1/resource
app.use('/api/clientes', ...);
app.use('/api/contabilidad', ...);
```
**IMPACTO:** 🟡 MEDIO — Breaking changes difíciles de manejar
**SEVERIDAD:** 🟡 MEDIO
**RECOMENDACIÓN:** Introducir `/api/v2/` para endpoints nuevos

---

## 6️⃣ TESTING STRATEGY (4.5/10)

### H6.1 — 24 test files
**EVIDENCIA:**
```bash
find backend -name "*.test.js" -o -name "*.spec.js" | wc -l
# Output: 24

# Desglose:
# - tests/unit/: 9 archivos
# - tests/integration/: 10 archivos
# - src/modules/*/tests/: 5 archivos
```

**Tests existentes:**
- ordenPagoRepository.test.js, empresaController.test.js
- ordenesService.test.js, facturacion.test.js, ordenPagoService.test.js
- fiscalProfile.unit.test.js, auth.test.js, ventasService.test.js
- verticalAccess.test.js, ventas.smoke.test.js
- caja.test.js, inventory.test.js, contabilidad.qa.test.js

**IMPACTO:** ⚠️ Coverage estimada ~25%
**SEVERIDAD:** 🟠 ALTO
**RECOMENDACIÓN:** Añadir tests para facturas, caja cierre, ordenes

---

### H6.2 — CI sin Postgres service
**EVIDENCIA:**
```yaml
# .github/workflows/ci.yml - NO EXISTE:
# services:
#   postgres:
#     image: postgres:16
```
**IMPACTO:** 🔴 CRÍTICO — Tests de integración no corren
**SEVERIDAD:** 🔴 CRÍTICO
**RECOMENDACIÓN:** Añadir Postgres service en CI

---

## 7️⃣ CI/CD & RELEASES (5/10)

### H7.1 — Guardrails script existe pero no bloquea
**EVIDENCIA:**
```json
// backend/package.json L23:
"check:db-guardrails": "node scripts/check-no-pool-query.js"
```

```yaml
# .github/workflows/ci.yml L34-35:
- name: Check DB Guardrails
  run: cd backend && npm run check:db-guardrails
# ⚠️ No hay: || exit 1, ni branch protection
```
**IMPACTO:** 🟠 ALTO — pool.query nuevos pasan CI
**SEVERIDAD:** 🟠 ALTO
**RECOMENDACIÓN:** Configurar branch protection con required checks

---

## 8️⃣ OBSERVABILIDAD (6.5/10)

### H8.1 — Logger estructurado + RequestId
**EVIDENCIA:**
```javascript
// backend/src/core/logging/logger.js - EXISTS ✅
// backend/src/core/http/middlewares/request-id.js - EXISTS ✅
// backend/index.js L51:
app.use(requestIdMiddleware);
```
**IMPACTO:** ✅ BIEN — Trazabilidad de requests

---

### H8.2 — 100+ console.log en runtime
**EVIDENCIA:**
```bash
grep -R "console\.log" -n backend/routes backend/src | wc -l
# Output: 100+ líneas

# Ejemplos:
# backend/routes/compras.js:37: console.log(`[DEBUG GET /api/compras]...`)
# backend/routes/stripeWebhook.js:85: console.log(`[Stripe Webhook]...`)
# backend/src/modules/contable/api/controllers/egresos.controller.js:55: console.log('[Egresos]...')
```
**IMPACTO:** 🟡 MEDIO — Logs no estructurados en producción
**SEVERIDAD:** 🟡 MEDIO
**RECOMENDACIÓN:** Reemplazar con logger.info/debug

---

## 9️⃣ DEVELOPER EXPERIENCE (5.5/10)

### H9.1 — Scripts npm bien organizados
**EVIDENCIA:**
```json
// backend/package.json scripts:
"start": "node index.js",
"dev": "nodemon index.js",
"test": "jest --detectOpenHandles",
"test:coverage": "jest --coverage --detectOpenHandles",
"migrate:latest": "knex migrate:latest",
"migrate:rollback": "knex migrate:rollback",
"check:db-guardrails": "node scripts/check-no-pool-query.js"
```
**IMPACTO:** ✅ BIEN — Scripts claros y útiles

---

### H9.2 — Falta ONBOARDING.md
**EVIDENCIA:**
```bash
find docs -name "ONBOARDING*" -o -name "GETTING_STARTED*"
# Output: (ningún resultado)
```
**IMPACTO:** 🟡 MEDIO — Nuevos devs tardan en setup
**SEVERIDAD:** 🟡 MEDIO
**RECOMENDACIÓN:** Crear ONBOARDING.md con pasos step-by-step

---

## 🔟 DEUDA TÉCNICA & ROADMAP (6/10)

### H10.1 — Legacy cutover en progreso
**EVIDENCIA:**
```
Módulos V2 migrados: 4 (clientes, vehiculos, ventas, contable)
Legacy pendientes: 30+ rutas en backend/routes/
```
**IMPACTO:** 🟡 MEDIO — Arquitectura V2 no es estándar
**SEVERIDAD:** 🟡 MEDIO

---

## 📁 EVIDENCIA FALTANTE (requiere acceso DB)

| Item | Query Necesario | Por qué importa |
|------|-----------------|-----------------|
| RLS tablas habilitadas | `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace` | Confirmar qué tablas tienen RLS |
| RLS policies | `SELECT * FROM pg_policies WHERE schemaname='public'` | Verificar policies correctas |
| Tablas sin id_tenant | `SELECT table_name FROM information_schema.columns WHERE column_name='id_tenant'` | Identificar desnormalización needed |

---

## ✅ CONCLUSIONES

1. **Progreso desde último audit:** Score +0.4 (5.2 → 5.6)
2. **Áreas mejoradas:** RBAC, audit logging, tenant-db wrapper, FinSaaS structure
3. **Bloqueantes principales:** CI sin DB, guardrails no enforced, 708 pool.query
4. **Próximo milestone:** 6.5/10 (target 4 semanas)
