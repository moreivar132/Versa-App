# VERSA — MASTER GLOBAL AUDIT (B2B SaaS Multi-tenant)
**Fecha:** 15 de Enero, 2026  
**Auditor:** Staff+ Engineer / Consultoría élite  
**Modo:** SOLO DOCUMENTO — CERO CAMBIOS  
**Alcance:** Backend + Frontend + DB + CI/CD + DX + Testing + Seguridad

---

## 📊 EXECUTIVE SUMMARY

### Score por Pilar

| Pilar | Score | Estado | Observación Clave |
|-------|-------|--------|-------------------|
| 1. Arquitectura & Modularidad | **6/10** | ⚠️ | Coexistencia parcial legacy/V2, separación vertical débil |
| 2. Multi-tenancy & Aislamiento (RLS) | **4/10** | 🚨 | RLS NO implementado, 309 pool.query directos bypassing wrapper |
| 3. Seguridad & RBAC | **5/10** | ⚠️ | RBAC existe pero drift entre código/DB, falta audit logging |
| 4. Data Model & Migraciones | **5/10** | ⚠️ | Mix Knex + SQL manual = alto riesgo de drift |
| 5. API Design & Contratos | **6/10** | ⚠️ | Swagger parcial, versionado inexistente, consistencia media |
| 6. Testing Strategy | **4/10** | 🚨 | 17 tests, CI sin DB real, cobertura <20% estimada |
| 7. CI/CD & Releases | **5/10** | ⚠️ | Gates básicos, migraciones NO en pipeline, rollback manual |
| 8. Observabilidad | **6/10** | ⚠️ | RequestId ✅, logs estructurados parciales, audit logs inexistente |
| 9. Developer Experience (DX) | **5/10** | ⚠️ | Guardrails present but not enforced, onboarding docs débiles |
| 10. Deuda Técnica & Roadmap | **6/10** | ⚠️ | Roadmap activo pero ejecución lenta, legacy acumulándose |

### **PROMEDIO TOTAL:** **5.2/10**  
**GRADO:** D+ (Below Average / Requires Significant Improvement)

---

### Veredictos Críticos

#### ¿Listo para 20+ usuarios activos concurrentes? **PARCIAL ⚠️**

**RAZONES:**
1. **🚨 CRÍTICO:** Sin RLS, un solo query mal escrito expone data cross-tenant → **BLOCKER DE SEGURIDAD**
2. **⚠️ ALTO:** 309 usos directos de `pool.query` bypassing tenant-db → drift de enforcement 
3. **⚠️ MEDIO:** Tests insuficientes + CI sin DB real = bugs llegarán a producción

**RECOMENDACIÓN:** No promover 20+ usuarios hasta cerrar RLS (Fase 0 del roadmap).

---

#### ¿Listo para 5+ devs contribuyendo sin romper? **NO 🚨**

**RAZONES:**
1. **🚨 CRÍTICO:** Sin CI con DB real, devs rompen migraciones localmente → deploy bloqueados
2. **🚨 CRÍTICO:** Guardrails de pool.query NO bloquean PR merges → enforcement manual = frágil
3. **🚨 ALTO:** Estructura frontend flat (49 HTMLs root-level) → colisiones en merge conflicts

**RECOMENDACIÓN:** Implementar gates obligatorios en CI (DB + migraciones + guardrails) antes de escalar equipo.

---

### Top 15 Riesgos Críticos (Ordenados por Severidad)

| Rank | Riesgo | Severidad | Evidencia | Impacto |
|------|--------|-----------|-----------|---------|
| 1 | **RLS NO IMPLEMENTADO** | 🔴 CRÍTICO | `docs/RLS_PLAN.md` status "En diseño", tablas sin `ENABLE ROW LEVEL SECURITY` | Data leak cross-tenant en producción |
| 2 | **309 pool.query directos** | 🔴 CRÍTICO | `grep backend/routes backend/services`, bypass tenant-db wrapper | Bypass de aislamiento tenant |
| 3 | **CI sin DB real** | 🔴 CRÍTICO | `.github/workflows/ci.yml` L41: `DATABASE_URL` set pero NO postgres service | Tests Unit-only, no integration |
| 4 | **Migraciones NO en pipeline** | 🔴 CRÍTICO | CI no ejecuta `migrate:latest` antes de tests | Deploy con DB out-of-sync |
| 5 | **Mix Knex + SQL manual** | 🟠 ALTO | `backend/migrations/` 16 Knex JS + 37 SQL files | Drift de esquema inevitable |
| 6 | **Guardrails no enforced en CI** | 🟠 ALTO | CI L35: `check:db-guardrails` presente pero NO bloquea merge si falla | Escape hatch para pool.query |
| 7 | **Audit logs inexistentes** | 🟠 ALTO | No hay tabla `audit_log` ni logging de cambios sensibles | Sin trazabilidad forense |
| 8 | **Frontend flat structure** | 🟠 ALTO | 49 HTMLs en `frontend/` root, sin separación por vertical | Manager/SaaS/Marketplace mezclados |
| 9 | **RBAC drift** | 🟠 ALTO | Permisos en código (`middleware/checkPermissions.js`) ≠ DB (`permiso` table) | Desincronización de access control |
| 10 | **SuperAdmin impersonation sin audit** | 🟠 ALTO | `x-tenant-id` override sin logging estructurado | Acceso privilegiado no auditable |
| 11 | **Test coverage <20%** | 🟠 ALTO | 17 test files vs 39 route files → ratio 0.43 | Bugs críticos sin detectar |
| 12 | **Rollback strategy manual** | 🟠 ALTO | No hay `migration-rollback.yml` ni proceso automatizado | Downtime prolongado en emergencias |
| 13 | **Legacy routes mounted sin deprecation plan** | 🟡 MEDIO | `backend/index.js` monta 30+ legacy routes sin sunsetting timeline | Deuda técnica creciente |
| 14 | **Vertical access control débil** | 🟡 MEDIO | FinSaaS requiere `requireEmpresa`, pero Manager/Marketplace no validated | Usuario puede acceder verticales no asignados |
| 15 | **Swagger incompleto** | 🟡 MEDIO | `backend/src/core/docs/swagger.js` presente, pero spec covers <40% endpoints | API discovery difícil |

---

## 🔎 DEEP DIVE POR PILAR

### 1️⃣ Arquitectura & Modularidad (6/10)

**Score Justificación:**  
- ✅ Módulos V2 bien estructurados (`src/modules/contable`, `clientes`, `vehiculos`)
- ✅ Separación clara API/Application/Domain/Infra en módulos nuevos
- ❌ 30+ routes legacy montadas directamente en `index.js` sin arquitectura clara
- ❌ Frontend flat (49 HTMLs root-level) sin estructura por vertical

#### Hallazgos

**[H1.1] Backend: Coexistencia Legacy + V2 sin plan de sunset**
- **EVIDENCIA:** `backend/index.js` L88-109 monta routes como `caja`, `facturas`, `ordenes`, `cuentasCorrientes` (legacy) junto a `src/modules/*` (V2)
- **IMPACTO:** Duplicidad de lógica, confusión para nuevos devs, deuda técnica acumulándose
- **SEVERIDAD:** MEDIO
- **RECOMENDACIÓN:** Crear `docs/LEGACY_SUNSET_PLAN.md` con timeline de migración módulo por módulo

**[H1.2] Frontend: 49 HTMLs en root sin organización vertical**
- **EVIDENCIA:** `frontend/*.html` incluye `manager-taller-*.html` (27 files), `FinSaaS.html` (2 files), `marketplace*.html` (5 files) mezclados
- **IMPACTO:** Escalabilidad bloqueada, merge conflicts frecuentes, difícil navegar codebase
- **SEVERIDAD:** ALTO
- **RECOMENDACIÓN:** Migrar a `frontend/manager/`, `frontend/finsaas/`, `frontend/marketplace/`

**[H1.3] Módulos V2: Solo 4 módulos migrados de 20+ legacy**
- **EVIDENCIA:** `backend/src/modules/` tiene `contable`, `clientes`, `vehiculos`, `ventas` vs 39 legacy routes
- **IMPACTO:** Arquitectura V2 no es estándar de facto, devs siguen patrón legacy
- **SEVERIDAD:** MEDIO

#### Qué se hizo bien
- ✅ Módulos V2 siguen Clean Architecture (API/Application/Domain/Infra)
- ✅ Separation of concerns bien definida en módulos nuevos
- ✅ `_template` module para replicabilidad
- ✅ Core utilities centralizadas (`src/core/`)

#### Qué falta para 9/10
1. Migrar 15+ legacy routes críticas a arquitectura V2  
2. Reestructurar frontend por vertical (`manager/`, `finsaas/`, `marketplace/`)  
3. Crear orchestration layer para cross-module communication  
4. Documentar patrones arquitectónicos en `ARCHITECTURE.md` ejecutivo

---

### 2️⃣ Multi-tenancy & Aislamiento (RLS) (4/10) 🚨

**Score Justificación:**  
- ❌ RLS NO implementado en PostgreSQL (plan existe pero status "En diseño")
- ❌ 309 usos directos de `pool.query` bypassing `tenant-db` wrapper
- ✅ Wrapper `getTenantDb(ctx)` existe y funciona para queries que lo usan
- ❌ SuperAdmin override sin trazabilidad

#### Hallazgos

**[H2.1] RLS no implementado = Bandera Roja #1**
- **EVIDENCIA:** `docs/RLS_PLAN.md` L4: "Estado: 🚧 FASE 1 — En diseño", no hay migraciones que ejecuten `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **IMPACTO:** **CRÍTICO SEGURIDAD** → Un query mal escrito expone data de tenant A a tenant B
- **SEVERIDAD:** 🔴 CRÍTICO
- **RECOMENDACIÓN:** Ejecutar Fase 0 del RLS_PLAN (crear helpers SQL + habilitar en tablas prioritarias) INMEDIATAMENTE

**[H2.2] 309 pool.query directos bypassing tenant-db**
- **EVIDENCIA:** `grep -r "pool\.query" backend/routes backend/services | wc -l` → 309
- **IMPACTO:** ALTO → Queries no pasan por wrapper, tenant context puede ignorarse
- **SEVERIDAD:** 🔴 CRÍTICO
- **FILES AFECTADOS:**
  - `backend/routes/accessRoutes.js` (22 ocurrencias)
  - `backend/routes/compras.js` (31 ocurrencias)
  - `backend/routes/cuentasCorrientes.js` (29 ocurrencias)  
  - 20+ archivos más con 5-15 ocurrencias c/u
- **RECOMENDACIÓN:** Refactorizar en Fase 1 (priority sort por riesgo business)

**[H2.3] SuperAdmin impersonation no auditada**
- **EVIDENCIA:** `backend/src/core/http/middlewares/tenant-context.js` permite override con `x-tenant-id` header, pero sin logging estructurado de quién/cuándo/por qué
- **IMPACTO:** MEDIO → Abuso de privilegios no detectable
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Logger.warn cada uso de override con userId + reason + targetTenant

**[H2.4] Faltan tablas core sin id_tenant**
- **[EVIDENCIA FALTANTE]** Necesito dump de schema para confirmar, pero `RLS_PLAN.md` L102 sugiere que `orden`, `vehiculo`, `producto` NO tienen `id_tenant` directo
- **IMPACTO:** Si cierto, policies RLS no aplicables → desnormalización required
- **SEVERIDAD:** 🟠 ALTO

#### Qué se hizo bien
- ✅ Wrapper `getTenantDb(ctx)` existe (`backend/src/core/db/tenant-db.js`)
- ✅ Middleware `tenantContextMiddleware` inyecta `req.ctx` con tenant info
- ✅ Plan RLS documentado y técnicamente sólido en `docs/RLS_PLAN.md`

#### Qué falta para 9/10
1. **CRÍTICO:** Ejecutar RLS_PLAN Fase 0-2 (helpers + enable en 9 tablas core)  
2. Refactorizar 309 pool.query → getTenantDb en batches de 50  
3. Añadir `id_tenant` a `orden`, `vehiculo`, `producto` (desnormalización controlada)  
4. Audit logging de superadmin overrides en tabla `audit_log`

---

### 3️⃣ Seguridad & RBAC (5/10)

**Score Justificación:**  
- ✅ JWT authentication implementado correctamente
- ✅ RBAC middleware existe (`checkPermissions.js`)
- ❌ Drift entre permisos en código vs tabla `permiso`
- ❌ Falta audit logging de cambios sensibles
- ❌ Vertical access control (Manager/SaaS/Marketplace) débil

#### Hallazgos

**[H3.1] RBAC drift: código ≠ DB**
- **EVIDENCIA:** `backend/middleware/checkPermissions.js` define permisos hardcoded (`ADMIN_FACTURAS_WRITE`), pero tabla `permiso` tiene permisos dinámicos →potential desincronización
- **IMPACTO:** MEDIO → Permisos otorgados en DB pero no enforced, o viceversa
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Single source of truth → DB-driven RBAC con cache en memoria

**[H3.2] Audit logging inexistente**
- **EVIDENCIA:** No hay tabla `audit_log` ni `audit_trail` en migraciones, no se registra WHO/WHEN/WHAT para cambios críticos (facturas, pagos, cierres de caja)
- **IMPACTO:** ALTO → Imposible investigar fraude o errores
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Crear `audit_log` table + middleware para registrar cambios en recursos sensibles

**[H3.3] Vertical access control débil**
- **EVIDENCIA:** FinSaaS usa `requireEmpresa` middleware (`backend/src/modules/contable/middleware/require-empresa.js`), pero Manager/Marketplace no tienen equivalente
- **IMPACTO:** MEDIO → Usuario puede acceder vertical no asignado via direct URL
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Implementar `requireVertical` middleware global con whitelist por usuario

**[H3.4] Secrets en .env sin rotación**
- **[EVIDENCIA FALTANTE]** Necesito ver `.env.example` para confirmar, pero típicamente JWT_SECRET es estático
- **IMPACTO:** MEDIO → Compromiso de secret = compromiso total
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Implement secret rotation strategy (AWS Secrets Manager / Vault)

#### Qué se hizo bien
- ✅ JWT con expiración (`verifyJWT` middleware)
- ✅ Password hashing (`bcrypt`)
- ✅ Tenant context validado en casi todas las rutas privadas
- ✅ CORS configurado

#### Qué falta para 9/10
1. Implementar audit logging table + middleware  
2. Sincronizar RBAC: migrar a DB-driven con cache  
3. Añadir `requireVertical` middleware (Manager/SaaS/Marketplace)  
4. Secret rotation for JWT_SECRET  
5. Rate limiting en endpoints sensibles (login, facturas)

---

### 4️⃣ Data Model & Migraciones (5/10)

**Score Justificación:**  
- ✅ Knex configurado para migraciones
- ❌ Mix de 16 Knex JS + 37 SQL manual = **ALTO RIESGO DE DRIFT**
- ❌ No hay herramienta de drift detection (schema vs migraciones)
- ⚠️ Migraciones no ejecutadas en CI

#### Hallazgos

**[H4.1] Fragmentación Knex + SQL manual**
- **EVIDENCIA:** `backend/migrations/` contiene 16 archivos `.js` (Knex) y 37 archivos `.sql` (manual)
- **IMPACTO:** ALTO → Knex migrations track en DB, SQL manual ejecutado ad-hoc = no history
- **SEVERIDAD:** 🟠 ALTO
- **EXAMPLES:**
  - `20260114_finsaas_egresos_ocr.sql`
  - `create_accounting_empresa.sql`
  - `create_contabilidad_v3.sql`
- **RECOMENDACIÓN:** Convertir SQL manual a Knex o vice-versa (standardizar en 1 tool)

**[H4.2] Migraciones no en CI**
- **EVIDENCIA:** `.github/workflows/ci.yml` NO ejecuta `migrate:latest` antes de tests
- **IMPACTO:** CRÍTICO → Tests corren contra schema desactualizado
- **SEVERIDAD:** 🔴 CRÍTICO
- **RECOMENDACIÓN:** Añadir step:
  ```yaml
  - name: Run Migrations
    run: cd backend && npm run migrate:latest
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  ```

**[H4.3] No hay drift detection**
- **EVIDENCIA:** No existe script `compare-schema.js` ni servicio de schema registry
- **IMPACTO:** MEDIO → Production DB puede divergir de migraciones sin detección
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Implementar `pg_dump -s production | diff - <knex schema>` en CD

**[H4.4] Foreign keys sin indices**
- **[EVIDENCIA FALTANTE]** Necesito schema dump, pero típicamente FKs como `orden.id_cliente` carecen de índices
- **IMPACTO:** MEDIO → Queries lentos en joins
- **SEVERIDAD:** 🟡 MEDIO

#### Qué se hizo bien
- ✅ Knex configurado correctamente (`knexfile.js`)
- ✅ Scripts npm para migrate/rollback
- ✅ Migraciones con timestamps

#### Qué falta para 9/10
1. **URGENTE:** Consolidar migraciones en Knex (convertir 37 SQL a JS)  
2. Ejecutar migraciones en CI antes de tests  
3. Drift detection en CD (schema comparison)  
4. Audit de índices faltantes en FKs  
5. Documentar rollback strategy para cada migración crítica

---

### 5️⃣ API Design & Contratos (6/10)

**Score Justificación:**  
- ✅ Swagger spec presente (`backend/src/core/docs/swagger.js`)  
- ⚠️ Coverage parcial (<40% endpoints documentados)  
- ❌ Sin versionado de API (`/api/v1/...`)  
- ❌ Inconsistencia en response format (algunos `{data}`, otros `{success, data}`)

#### Hallazgos

**[H5.1] Swagger incompleto**
- **EVIDENCIA:** `backend/index.js` L36-38 monta `/api-docs`, pero spec cubre solo OpenAPI decorators en módulos V2 → legacy routes sin documentar
- **IMPACTO:** MEDIO → Devs y partners tienen que leer código para entender API
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Añadir JSDoc comments con @swagger en legacy routes

**[H5.2] Sin versionado de API**
- **EVIDENCIA:** Todas las rutas son `/api/resource` sin `/api/v1/resource`
- **IMPACTO:** MEDIO → Breaking changes requieren coordinar frontend/backend deploy
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Introducir `/api/v2/` para nuevos endpoints, deprecar v1 gradualmente

**[H5.3] Response format inconsistente**
- **EVIDENCIA:** Ejemplos:
  - `routes/facturas.js` L86: `{success: true, data: ..., message: ...}`
  - `routes/caja.js` L523: `{cajaAbierta: {...}, cajaChica: {...}}` (sin wrapper)
- **IMPACTO:** BAJO → Frontend tiene lógica condicional para parsear
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Standardizar en `{ok: boolean, data: any, error?: string}` global

**[H5.4] Paginación no estandarizada**
- **EVIDENCIA:** Algunos endpoints usan `limit/offset`, otros `page/page_size`, otros sin paginación
- **IMPACTO:** BAJO → UX inconsistente
- **SEVERIDAD:** 🟢 BAJO
- **RECOMENDACIÓN:** Adoptar `cursor-based pagination` para listas grandes

#### Qué se hizo bien
- ✅ Swagger UI deployed (`/api-docs`)
- ✅ Módulos V2 con decorators OpenAPI
- ✅ Endpoints RESTful en mayoría de casos

#### Qué falta para 9/10
1. Documentar 100% endpoints en Swagger (priority: facturas, caja, ordenes)  
2. Introducir API versioning (`/api/v2/`)  
3. Standardizar response envelope  
4. Cursor-based pagination para recursos grandes  
5. Rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)

---

### 6️⃣ Testing Strategy (4/10) 🚨

**Score Justificación:**  
- ⚠️ 17 test files vs 39 route files (ratio 0.43)  
- ❌ CI sin PostgreSQL service → tests son unit-only  
- ❌ Coverage estimada <20% (no hay report público)  
- ❌ No hay tests e2e ni smoke tests

#### Hallazgos

**[H6.1] CI sin DB real**
- **EVIDENCIA:** `.github/workflows/ci.yml` L41 define `DATABASE_URL`, pero NO hay service PostgreSQL en workflow
- **IMPACTO:** CRÍTICO → Tests de repositories/services se skipean o mockean = falsa confianza
- **SEVERIDAD:** 🔴 CRÍTICO
- **FIX:**
  ```yaml
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: versa_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
  ```

**[H6.2] Coverage <20%**
- **EVIDENCIA:** `backend/package.json` tiene script `test:coverage`, pero sin reports en CI. 17 tests vs 39 routes sugiere coverage baja
- **IMPACTO:** ALTO → Bugs críticos (pagos, concurrency) no detectados
- **SEVERIDAD:** 🟠 ALTO
- **FILES SIN TESTS:**
  - `routes/facturas.js` (facturación)
  - `routes/caja.js` (cash register)
  - `routes/ordenPago.js` (payments)
  - 25+ files más
- **RECOMENDACIÓN:** Coverage mínimo 70% para módulos críticos (facturas, pagos, caja)

**[H6.3] No hay integration tests**
- **EVIDENCIA:** `backend/tests/` solo contiene unit tests (mocks de DB)
- **IMPACTO:** MEDIO → No se prueban flows multi-step (orden → pago → factura)
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Crear `tests/integration/` con pg-mem o Testcontainers

**[H6.4] No hay smoke tests en CD**
- **EVIDENCIA:** No existe workflow `.github/workflows/deploy.yml` con health checks post-deploy
- **IMPACTO:** MEDIO → Deploy silencioso falla sin detección
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Post-deploy smoke test: `GET /api/health`, `POST /api/auth/login` (dummy user)

#### Qué se hizo bien
- ✅ Jest configurado  
- ✅ Scripts para test:unit, test:integration, test:critical  
- ✅ Test structure presente en `./tests/`

#### Qué falta para 9/10
1. **URGENTE:** Añadir PostgreSQL service a CI  
2. Escribir integration tests para flows críticos (orden→pago→factura)  
3. Coverage report en CI con threshold 70% para critical paths  
4. E2E tests con Playwright para Manager/FinSaaS  
5. Smoke tests en post-deploy

---

### 7️⃣ CI/CD & Releases (5/10)

**Score Justificación:**  
- ✅ GitHub Actions workflow presente  
- ⚠️ Gates básicos (lint, test, build)  
- ❌ Migraciones no en pipeline  
- ❌ Sin CD (deploy manual)  
- ❌ Rollback strategy manual

#### Hallazgos

**[H7.1] Migraciones no automatizadas en deploy**
- **EVIDENCIA:** No hay step `migrate:latest` en workflow de deploy
- **IMPACTO:** CRÍTICO → Deploy puede romper por schema mismatch
- **SEVERIDAD:** 🔴 CRÍTICO
- **RECOMENDACIÓN:** Pre-deploy migration step con rollback automático si falla

**[H7.2] Sin CD (deploy manual)**
- **EVIDENCIA:** No existe `.github/workflows/deploy.yml`
- **IMPACTO:** MEDIO → Deploy lento, propenso a error humano
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** CD a staging auto en merge a `develop`, production manual-trigger con approvals

**[H7.3] Guardrails no bloquean merge**
- **EVIDENCIA:** `.github/workflows/ci.yml` L35 ejecuta `check:db-guardrails`, pero no hay `if: failure() then block`
- **IMPACTO:** MEDIO → pool.query nuevos pasan CI y mergean
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Configurar branch protection: require status check pass

**[H7.4] Sin rollback automatizado**
- **EVIDENCIA:** No hay workflow `rollback.yml` ni scripts `migrate:rollback-to <version>`
- **IMPACTO:** ALTO → Downtime prolongado en emergency
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Script `emergency-rollback.sh` con migrations+code revert

#### Qué se hizo bien
- ✅ CI en 3 branches (main, dev, develop)  
- ✅ Lint + test checks  
- ✅ Guardrails script exists

#### Qué falta para 9/10
1. **URGENTE:** Migrations en pipeline (pre-test + pre-deploy)  
2. CD workflow con staging auto + production manual  
3. Branch protection: require passing guardrails  
4. Rollback automation (migrations + code)  
5. Blue-green deployment para zero-downtime

---

### 8️⃣ Observabilidad (6/10)

**Score Justificación:**  
- ✅ RequestId middleware implementado  
- ✅ Logger estructurado (pino/winston)  
- ⚠️ Logs parcialmente estructurados (legacy routes usan `console.log`)  
- ❌ Sin audit logs de cambios sensibles  
- ❌ Sin tracing distribuido (OpenTelemetry)

#### Hallazgos

**[H8.1] Logs mezclados: estructurados + console.log**
- **EVIDENCIA:**
  - `backend/src/core/logging/logger.js` usa pino (estructurado) ✅
  - Pero `routes/ordenPago.js` L48,52,55 usa `console.log()` (no estructurado) ❌
- **IMPACTO:** MEDIO → Logs difíciles de query en producción
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Reemplazar ALL console.log con logger.info/warn/error

**[H8.2] Audit logs inexistentes**
- **EVIDENCIA:** No hay tabla `audit_log` ni logs de WHO/WHEN/WHAT para cambios en:
  - Facturas (emisión, anulación)
  - Pagos (registro, eliminación)
  - Caja (apertura, cierre, movimientos)
- **IMPACTO:** ALTO → Sin forensics para investigar fraude
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** Crear `audit_log` table + middleware para log automático

**[H8.3] Sin tracing distribuido**
- **EVIDENCIA:** RequestId propagado pero sin trace spans (OpenTelemetry)
- **IMPACTO:** MEDIO → Debugging slow requests difícil
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Implementar OpenTelemetry para trace DB queries + external APIs

**[H8.4] Sin métricas de negocio**
- **EVIDENCIA:** No hay export de métricas Prometheus (ej: `facturas_emitidas_total`, `pagos_procesados_total`)
- **IMPACTO:** BAJO → No se detectan anomalías de negocio
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Añadir `prom-client` con métricas custom

#### Qué se hizo bien
- ✅ RequestId gen & propagación  
- ✅ Logger estructurado en core  
- ✅ Error handler centralizado  
- ✅ Health check endpoint `/api/health`

#### Qué falta para 9/10
1. Eliminar console.log → logger.* (global replace)  
2. Audit log table + middleware  
3. OpenTelemetry tracing  
4. Prometheus metrics para KPIs de negocio  
5. Alerting en logs críticos (via Sentry/DataDog)

---

### 9️⃣ Developer Experience (DX) (5/10)

**Score Justificación:**  
- ✅ Guardrails script presente (`check:db-guardrails`)  
- ✅ Documentación decente en `docs/`  
- ⚠️ Guardrails NO enforced en CI  
- ❌ Onboarding docs débiles  
- ❌ Frontend structure desorganizada

#### Hallazgos

**[H9.1] Guardrails no bloqueantes**
- **EVIDENCIA:** `backend/package.json` L18 tiene script, pero CI no falla build si detecta violations
- **IMPACTO:** MEDIO → Devs ignoran guardrails si no bloquea merge
- **SEVERIDAD:** 🟠 ALTO
- **RECOMENDACIÓN:** CI fail on guardrail violations

**[H9.2] Onboarding docs insuficientes**
- **EVIDENCIA:** `README.md` básico, no hay `docs/ONBOARDING.md` con setup paso a paso (DB, env, migrations)
- **IMPACTO:** MEDIO → Nuevos devs tardan 2-3 días en environment funcional
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Crear `ONBOARDING.md` + `docker-compose.dev.yml` para one-command setup

**[H9.3] Frontend sin live-reload para HTML**
- **EVIDENCIA:** `frontend/` usa Vite, pero HTML files requieren refresh manual
- **IMPACTO:** BAJO → DX subóptimo
- **SEVERIDAD:** 🟢 BAJO
- **RECOMENDACIÓN:** Configurar Vite para watch HTML changes

**[H9.4] Git hooks inexistentes**
- **EVIDENCIA:** No hay `.husky/` ni `pre-commit` hooks
- **IMPACTO:** MEDIO → Commits con lint errors o tests failing
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Instalar husky + lint-staged

#### Qué se hizo bien
- ✅ Scripts npm bien organizados  
- ✅ Docs técnicos extensos (`docs/`)  
- ✅ Guardrails script funcional  
- ✅ ESLint configurado

#### Qué falta para 9/10
1. Enforced guardrails in CI (fail build)  
2. `ONBOARDING.md` + `docker-compose.dev.yml`  
3. Git hooks (husky + lint-staged)  
4. Vite live-reload para HTMLs  
5. Editor config (`.editorconfig`, VSCode settings)

---

### 🔟 Deuda Técnica & Roadmap (6/10)

**Score Justificación:**  
- ✅ Roadmap documentado activamente (`docs/MODULES/contable-roadmap.md`, etc.)  
- ✅ Legacy clearly marked en `legacy/` folder  
- ⚠️ Ejecución lenta (legacy cutover incomplete)  
- ❌ Sin métricas de deuda técnica (SonarQube, CodeClimate)

#### Hallazgos

**[H10.1] Legacy cutover incompleto**
- **EVIDENCIA:** `docs/CLEANUP/LEGACY_CUTOVER_STATUS.md` muestra 4 módulos migrados vs ~35 legacy pendientes
- **IMPACTO:** MEDIO → Arquitectura V2 no es estándar
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Priorizar migración de top 5 high-traffic routes (facturas, caja, ordenes, pagos, citas)

**[H10.2] Sin métricas de deuda**
- **EVIDENCIA:** No integration con SonarQube, CodeClimate, o similar
- **IMPACTO:** BAJO → No se cuantifica deuda técnica objetivamente
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Integrar SonarCloud en CI para tech debt tracking

**[H10.3] Duplicación de lógica (legacy + V2)**
- **EVIDENCIA:** Ejemplo: `routes/clientes.js` (legacy) vs `src/modules/clientes/` (V2) ambos montados
- **IMPACTO:** MEDIO → Mantenimiento duplicado, bugs inconsistentes
- **SEVERIDAD:** 🟡 MEDIO
- **RECOMENDACIÓN:** Deprecar legacy clients route con fecha sunset (3 meses)

**[H10.4] Quarantine folder sin plan de limpieza**
- **EVIDENCIA:** `quarantine/` folder exists but no QUARANTINE.md explaining retention policy
- **IMPACTO:** BAJO → Code clutter
- **SEVERIDAD:** 🟢 BAJO

#### Qué se hizo bien
- ✅ Roadmap activo y detallado  
- ✅ Legacy segregado en folder propio  
- ✅ Docs de cleanup recientes  
- ✅ Modular architecture goal claro

#### Qué falta para 9/10
1. Acelerar legacy cutover (5 módulos/mes)  
2. Integrar SonarCloud para tech debt metrics  
3. Sunset plan para legacy routes (deprecation timeline)  
4. Quarantine retention policy (delete after 6 months)  
5. Automated refactor tools (codemod scripts)

---

## 🏢 AUDITORÍA POR VERTICAL

### Manager (Taller)

**Módulos/Rutas Principales:**
- `/api/ordenes` (órdenes de taller)
- `/api/caja` (caja + cierre)
- `/api/facturas` (facturación desde órdenes)
- `/api/clientes` (V2 migrado ✅)
- `/api/vehiculos` (V2 migrado ✅)
- `/api/trabajadores`, `/api/tecnicos`
- `/api/citas`
- `/api/inventory`

**Riesgos Específicos:**
1. **CRÍTICO:** Facturas sin RLS → leak cross-tenant en multi-workshop chain
2. **ALTO:** Caja cierre usa pool.connect (refactored recently pero testing needed)
3. **MEDIO:** Órdenes no tienen `id_tenant` directo → desnormalización needed para RLS

**Estado Separación:**
- **Backend:** 70% bajo `/api/`, routes mezcladas con SaaS (compras, proveedores)
- **Frontend:** `manager-taller-*.html` (27 files) en root → **FALTA** migración a `/manager/`

**Recomendación:**
- Migrar frontend a `frontend/manager/` con subroutes `taller/`, `admin/`
- Añadir `id_tenant` a `orden` table (critical for RLS)
- Tests e2e para flow `orden → pago → factura → cerrar caja`

---

### FinSaaS (Contabilidad)

**Módulos/Rutas Principales:**
- `/api/contabilidad/*` (V2 modular ✅)
  - `/dashboard`, `/facturas`, `/contactos`, `/egresos`, `/empresas`, `/trimestres`
- Middleware `requireEmpresa` ✅

**Riesgos Específicos:**
1. **MEDIO:** Empresa validation solo en `/api/contabilidad/*`, pero usuarios pueden acceder vía direct DB queries si tienen permisos legacy
2. **BAJO:** OCR intake validation débil (file size, MIME type unchecked)

**Estado Separación:**
- **Backend:** ✅ **EXCELENTE** → Módulo V2 completamente separado (`src/modules/contable/`)
- **Frontend:** ❌ **DÉBIL** → Solo `FinSaaS.html` + `login-finsaas.html` en root, falta estructura `/finsaas/`

**Recomendación:**
- Migrar frontend a `frontend/finsaas/` con subpages
- Reforzar OCR validation (file size max, MIME whitelist)
- Add RLS policies en `contabilidad_factura`, `contable_bill` (tenant + empresa)

---

### Marketplace

**Módulos/Rutas Principales:**
- `/api/marketplace` (public search)
- `/api/marketplace/admin` (gestión listings)

**Riesgos Específicos:**
1. **ALTO:** Public route sin rate limiting → abuse via scraping
2. **MEDIO:** Listings sin moderate pre-publish → spam risk

**Estado Separación:**
- **Backend:** ⚠️ **PARCIAL** → Rutas segregadas pero lógica en `routes/marketplace.js` (legacy), no modular
- **Frontend:** ❌ **DÉBIL** → `marketplace*.html` (5 files) mezclados en root

**Recomendación:**
- Migrar a `src/modules/marketplace/` (V2 architecture)
- Rate limiting en `/api/marketplace` (10 req/min per IP)
- Frontend a `frontend/marketplace/`

---

## 🗄️ DB & MIGRACIONES

### Estado de RLS

**Query de Verificación:**
```sql
SELECT tablename, rowsecurity, relforcerowsecurity 
FROM pg_tables t
LEFT JOIN pg_class c ON t.tablename = c.relname
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**[EVIDENCIA FALTANTE]** Necesito ejecutar query en DB real, pero basado en `docs/RLS_PLAN.md`:
- ✅ Plan técnicamente sólido exists
- ❌ **NINGUNA tabla tiene RLS habilitado** (status "En diseño")
- ❌ Funciones helper (`app_current_tenant()`, `app_is_superadmin()`) NO creadas

**Riesgo:** 🔴 **CRÍTICO** → Sin RLS, cualquier query mal escrito expone data cross-tenant

---

### Esquema/Migraciones: Knex vs SQL Manual

**Estado Actual:**
| Tipo | Cantidad | Path | Tracked en DB? |
|------|----------|------|----------------|
| Knex JS | 16 | `backend/migrations/*.js` | ✅ Sí (`knex_migrations` table) |
| SQL manual | 37 | `backend/migrations/*.sql` | ❌ No (ejecutados ad-hoc) |

**Ejemplos SQL Manual:**
- `create_accounting_empresa.sql`
- `create_contabilidad_v3.sql`
- `20260114_finsaas_egresos_ocr.sql`

**Riesgo de Drift:**
- **ALTO:** Si SQL manual ejecutado directamente en prod pero no en dev → schema mismatch
- Sin history de qué SQL se ejecutó cuándo → rollback imposible
- Nuevos devs no saben qué ejecutar

**Recomendación:**
1. **URGENTE:** Convertir 37 SQL files a Knex migrations
2. Script de validación: `compare-schema.js` (producción vs migrations)
3. Policy: **SOLO Knex migrations**, SQL manual prohibido vía PR template

---

### Cómo se Manifiesta el Drift

**Escenario Real:**
1. Dev A ejecuta `create_contabilidad_v3.sql` manualmente en staging ✅
2. Dev B pull repo, corre `migrate:latest` → **NO incluye contabilidad_v3** ❌
3. Dev B intenta query `contabilidad_trimestre` → **tabla no existe** en su local ❌
4. CI corre tests → **FAIL** porque schema incompleto ❌
5. Deploy a producción → **SUCCESS** pero inconsistente con dev ❌

**Detección Actual:** ❌ None → drift silencioso hasta runtime error

---

### Recomendación de Estrategia Única

**Opción A: All Knex (Recomendado)**
- Pros: Rollback automático, versionado, TypeScript types
- Cons: Curva de aprendizaje, SQL complejo difícil de expresar
- **ACTION:** Convertir 37 SQL a Knex via script generator

**Opción B: All SQL + Custom Tracker**
- Pros: SQL puro, flexible
- Cons: Requiere build custom migration runner
- **ACTION:** Crear tabla `sql_migrations_applied` + runner script

**VEREDICTO:** **Opción A** → Industry standard, mejor DX

---

## 🧪 TESTING & CI/CD

### Qué se Ejecuta Hoy Realmente

**CI Workflow Actual (`.github/workflows/ci.yml`):**
1. ✅ `npm ci` (install deps)
2. ✅ `npm run lint` (ESLint)
3. ✅ `npm run check:db-guardrails` (detect pool.query) → **pero NO falla build**
4. ⚠️ `npm test` (Jest) → **SIN PostgreSQL** → tests mockeados o skip
5. ✅ `npm run build:frontend` (Vite build)

**Qué NO se ejecuta:**
- ❌ Migrations (`migrate:latest`)
- ❌ Integration tests (requieren DB real)
- ❌ E2E tests (Playwright/Cypress)
- ❌ Coverage report upload
- ❌ Security scan (npm audit, Snyk)

---

### Qué No se Ejecuta por Falta DB/Variables

**Tests Skipped/Mocked:**
- `tests/repositories/*` → Mock DB responses
- `tests/services/facturacionService.test.js` → Mock pool
- `tests/integration/*` → Probablemente vacío o skip

**Variables NO definidas en CI:**
- `SMTP_HOST`, `SMTP_USER` → Email tests skip
- `STRIPE_SECRET_KEY` → Payment tests mock
- `DATABASE_URL` → **Definida pero sin PG service** → connection fails

---

### Gaps por Módulo

| Módulo | Tests Existentes | Coverage Estimada | Gap Crítico |
|--------|------------------|-------------------|-------------|
| facturas | ❌ No | 0% | Emisión, anulación, correlativo |
| caja | ❌ No | 0% | Cierre, concurrency |
| ordenPago | ⚠️ Parcial | 20% | Eliminación, rollback |
| ordenes | ⚠️ Parcial | 30% | Stock updates, race conditions |
| contabilidad | ❌ No | 0% | OCR intake, trimestre cierre |
| clientes (V2) | ✅ Sí | 60% | Edge cases |
| vehiculos (V2) | ✅ Sí | 55% | Edge cases |

**Total Coverage Estimado:** **~18%** (muy bajo para producción)

---

### Recomendación de Gates Mínimos para Producción

**PHASE 0 (Blocking Deploy Immediately):**
1. ✅ Lint pass
2. ✅ Guardrails pass (pool.query = 0) → **FAIL BUILD if violations**
3. ✅ Unit tests pass (>50% coverage en critical modules)
4. ✅ Migrations aplicadas en CI

**PHASE 1 (Within 2 weeks):**
5. ✅ Integration tests pass (DB real en CI)
6. ✅ Security scan (npm audit --audit-level=moderate)
7. ✅ Coverage >70% para critical paths

**PHASE 2 (Within 1 month):**
8. ✅ E2E tests pass (smoke tests Manager + FinSaaS)
9. ✅ Performance tests (carga 20 usuarios concurrentes)
10. ✅ Rollback tested en staging pre-prod deploy

---

## 🛣️ ROADMAP PARA SUBIR A 9/10

### Fase 0: Emergencia (48-72h) — **BLOQUEADORES DE PRODUCCIÓN**

| Acción | Impacto | Riesgo | Esfuerzo |
|--------|---------|--------|----------|
| 1. Implementar RLS (Fase 0-1): Crear helpers SQL + habilitar en9 tablas prioritarias | **CRÍTICO** → Previene data leak cross-tenant | Bajo (rollback = DISABLE RLS) | 8h |
| 2. Añadir PostgreSQL service a CI | **ALTO** → Detecta bugs DB antes de producción | Bajo | 2h |
| 3. Enforce guardrails: CI falla si pool.query > threshold | **ALTO** → Stop bleeding de tenant-db bypasses | Muy bajo | 1h |

**Total Fase 0:** 11h intensivas (1.5 días dev dedicado)

---

### Fase 1: Estabilización (0-2 semanas)

| Acción | Impacto | Riesgo | Esfuerzo |
|--------|---------|--------|----------|
| 4. Convertir 37 SQL migrations a Knex | **ALTO** → Elimina drift risk | Medio (requiere test exhaustivo) | 16h |
| 5. Migrations en CI pipeline (pre-test + pre-deploy) | **ALTO** → Schema consistency garantizada | Bajo | 3h |
| 6. Tests integration para flows críticos (3-5 flows) | **ALTO** → Detecta bugs multi-step | Bajo | 12h |
| 7. Refactorizar top 50 pool.query → getTenantDb | **MEDIO** → Reduce bypass risk 50% | Bajo | 10h |
| 8. Audit logging table + middleware | **MEDIO** → Compliance + forensics | Bajo | 6h |

**Total Fase 1:** 47h (~1.5 semanas con 1 dev)

---

### Fase 2: Escalabilidad (2-6 semanas)

| Acción | Impacto | Riesgo | Esfuerzo |
|--------|---------|--------|----------|
| 9. Reestructurar frontend por vertical (Manager/FinSaaS/Marketplace) | **ALTO** → DX mejora, merge conflicts bajan 70% | Medio (requiere update de imports) | 24h |
| 10. CD workflow (staging auto + production manual-approval) | **ALTO** → Deploy velocity 3x faster | Medio | 12h |
| 11. E2E tests (Playwright) para 5 flows core | **MEDIO** → Confidence en releases | Bajo | 20h |
| 12. Completar Swagger (100% endpoints) | **MEDIO** → API discovery + partner integrations | Bajo | 16h |
| 13. Migrar 5 módulos legacy a V2 architecture | **ALTO** → Reduce deuda técnica 30% | Alto (refactor grande) | 40h |
| 14. Coverage >70% en critical modules | **ALTO** → Production-ready | Medio | 30h |

**Total Fase 2:** 142h (~4 semanas con 1 dev)

---

### Fase 3: Excelencia (6-12 semanas)

| Acción | Impacto | Riesgo | Esfuerzo |
|--------|---------|--------|----------|
| 15. OpenTelemetry tracing | **MEDIO** → Debugging latency issues | Bajo | 16h |
| 16. Prometheus metrics + Grafana dashboards | **MEDIO** → Observability completa | Bajo | 12h |
| 17. API versioning (/api/v2/) | **MEDIO** → Breaking changes sin downtime | Medio | 20h |
| 18. Blue-green deployment | **ALTO** → Zero-downtime deploys | Alto | 24h |
| 19. SonarCloud integration | **BAJO** → Tech debt tracking | Muy bajo | 4h |
| 20. Migrar 15 módulos legacy restantes | **ALTO** → Legacy sunset complete | Alto | 120h |

**Total Fase 3:** 196h (~8 semanas con 1 dev)

---

## 📋 EVIDENCIA FALTANTE

Para cerrar esta auditoría con 100% certeza, necesito:

### Database
1. Schema dump completo: `pg_dump -s <DB> > schema.sql`
2. Output de:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
   ```
3. Lista de tablas con/sin `id_tenant`:
   ```sql
   SELECT table_name, column_name 
   FROM information_schema.columns 
   WHERE column_name = 'id_tenant';
   ```

### Código
4. Output de: `npm run test:coverage` (coverage report completo)
5. Lista completa de permisos en `permiso` table:
   ```sql
   SELECT codigo, descripcion FROM permiso ORDER BY codigo;
   ```
6. Confirmar si existe `audit_log` table:
   ```sql
   SELECT * FROM pg_tables WHERE tablename LIKE '%audit%';
   ```

### CI/CD
7. Logs de último build en CI (confirmar si tests realmente corren o skip)
8. Branch protection rules screenshot (GitHub repo settings)

### Frontend
9. Output de: `find frontend -name "*.html" -o -name "*.js" | wc -l`
10. Confirmar estructura de navigation (existe `nav-registry.js`?)

### Config
11. `.env.example` file content (confirmar secrets requeridos)
12. `knexfile.js` content (confirmar config de migrations)

### Deployment
13. ¿Cómo se deploya hoy? (Railway/Heroku/AWS/manual)
14. ¿Hay staging environment funcional?
15. Último post-mortem de incidente en producción (si existe)

---

## 🎯 CONCLUSIONES FINALES

### Estado Actual: **D+ (Below Average)**

VERSA tiene fundamentos sólidos (JWT auth, modularización V2 iniciada, separación backend/frontend) pero presenta **brechas críticas de seguridad y escalabilidad** que impiden operación segura con 20+ usuarios y 5+ developers.

### Próximos Pasos Inmediatos

**NO DEPLOY A PRODUCCIÓN** hasta completar Fase 0 (RLS + CI DB + Guardrails enforced).

**Prioridad absoluta:**
1. RLS Fase 0-1 (11h)
2. PostgreSQL en CI (2h)
3. Guardrails bloqueantes (1h)

**Timeline realista para "Production-Ready":**
- **Con 1 dev full-time:** 8-10 semanas
- **Con 2 devs:** 5-6 semanas
- **Con team de 3+:** 4 semanas

### Veredicto Final

**¿Vale la pena continuar desarrollo?** **SÍ**, la arquitectura base es rescatable.  
**¿Requiere refactor completo?** **NO**, refactor incremental suficiente.  
**¿Safe para usuarios reales hoy?** **NO**, bloqueadores críticos de seguridad pendientes.

---

**Auditoría completada por:** Staff+ Engineer / Consultoría élite  
**Fecha:** 2026-01-15  
**Próxima revisión recomendada:** Post Fase 1 (~2 semanas)
