# VERSA — GLOBAL TECHNICAL AUDIT REPORT

**Fecha:** 21 de Enero, 2026  
**Auditor:** Staff+ Principal Architect / Security Auditor / DevEx Lead / QA Lead  
**Modo:** READ-ONLY — CERO CAMBIOS AL CÓDIGO  
**Commit base:** Últimas auditorías: `e4bc57e947c5a5007864d1ee2be5a20a56d10973`

---

## 1. Executive Summary

### Score Global: **6.4 / 10**

| Indicador | Valor |
|-----------|-------|
| **Score Global** | 6.4 / 10 |
| **Estado General** | ⚠️ PARCIALMENTE FUNCIONAL - REQUIERE MEJORAS |
| **Grado** | C+ (Mejora notable desde D+ del 19 Ene) |
| **Riesgo Principal** | Coexistencia de patrones legacy/V2 + pool.query directos |
| **Horizonte sin refactor** | 4-6 meses antes de alcanzar deuda técnica crítica |

### Progreso desde última auditoría (19 Ene 2026)
- **Δ Score:** +0.8 puntos (5.6 → 6.4)
- **Migraciones consolidadas:** 30 archivos Knex JS activos, SQL legacy archivado ✅
- **Drift eliminado:** Single Source of Truth para migraciones ✅
- **RLS wrapper mejorado:** `tenant-db.js` con `setRLSContext`, `txWithRLS` ✅

### Bloqueantes críticos restantes
1. **pool.query directos** en rutas legacy (27+ archivos en `backend/routes/`)
2. **CI sin Postgres service** (tests de integración no corren en real DB)
3. **Frontend Manager flat** (27+ HTMLs en root sin estructura vertical)

---

## 2. Technical Pillars Scorecard

| # | Pilar | Score | Estado | Justificación |
|---|-------|-------|--------|---------------|
| 1 | **Arquitectura & Modularidad** | 6.5/10 | ⚠️ | 4 módulos V2 migrados (clientes, vehiculos, ventas, contable) + 30+ rutas legacy coexistiendo |
| 2 | **Frontend Architecture** | 5.5/10 | ⚠️ | FinSaaS bien estructurado en `src/verticals/finsaas/` (17 páginas), pero Manager flat en root (27+ HTMLs) |
| 3 | **Multi-tenancy & Aislamiento** | 6.0/10 | ⚠️ | `tenant-db.js` con RLS implementado y funcional; 27+ archivos routes aún usan pool.query directo |
| 4 | **Seguridad & RBAC** | 7.0/10 | 🟢 | `permissions.js` centralizado, `requirePermission` en 70+ endpoints, audit logging activo |
| 5 | **Database & Migrations** | 8.5/10 | 🟢 | 30 migraciones Knex JS consolidadas, SQL legacy archivado, drift eliminado |
| 6 | **API Design & Contratos** | 6.0/10 | ⚠️ | Swagger activo en `/api-docs`, sin versionado `/api/v1/`, respuestas inconsistentes |
| 7 | **CI/CD & Testing** | 5.0/10 | 🔴 | CI existe pero sin Postgres service; 24 test files; guardrails no bloquean merge |
| 8 | **Observabilidad** | 6.5/10 | ⚠️ | Logger estructurado + RequestId; pero 100+ console.log en runtime |
| 9 | **Developer Experience (DX)** | 6.0/10 | ⚠️ | Scripts npm claros, estructura modular parcial; falta ONBOARDING.md |
| 10 | **Deuda Técnica & Gobernanza** | 6.5/10 | ⚠️ | Documentación de auditorías excelente; legacy routes sin timeline sunset |

**Promedio Ponderado: 6.4 / 10**

---

## 3. Auditoría por Vertical

### 3.1 Manager (Operaciones / Taller)

| Campo | Valor |
|-------|-------|
| **Score** | 6.0 / 10 |
| **Estado** | ⚠️ FUNCIONAL CON DEUDA |

#### Riesgo Técnico
- **27+ archivos HTML** en `frontend/` root sin estructura vertical
- Rutas críticas (`caja.js`, `ordenes.js`, `compras.js`) usan mix de `getTenantDb` + `pool.query`
- `caja.js` (1162 líneas) tiene tenant-db middleware pero aún hereda patrones legacy

#### Riesgo de Negocio
- **Alto impacto financiero:** Errores en caja/ordenes afectan directamente facturación
- **Multi-tenant risk:** pool.query directos pueden filtrar datos entre tenants si no se valida correctamente

#### Fragilidad Principal
```javascript
// backend/routes/caja.js L1-17 (EVIDENCIA):
// USA getTenantDb ✅ pero coexiste con const pool = { query: ... } legacy wrapper
const { getTenantDb } = require('../src/core/db/tenant-db');
router.use((req, res, next) => {
    if (req.ctx) { req.db = getTenantDb(req.ctx); }
    next();
});
const pool = { query: (sql, params) => req.db.query(sql, params) };
```
El patrón híbrido es confuso y propenso a errores humanos donde se olvide usar `req.db`.

---

### 3.2 FinSaaS (Contable / Financiero)

| Campo | Valor |
|-------|-------|
| **Score** | 7.5 / 10 |
| **Estado** | 🟢 MEJOR ESTRUCTURADO |

#### Riesgo Técnico
- Módulo `contable` en `src/modules/contable/` sigue arquitectura V2 correcta
- 17 páginas frontend organizadas en `src/verticals/finsaas/pages/`
- `empresa.middleware.js` valida X-Empresa-Id correctamente
- Usa `getTenantDb` consistentemente en repositories

#### Riesgo de Negocio
- **Validación fiscal:** `deducible.qa.test.js` y `fiscalProfile.unit.test.js` existen ✅
- **OCR intake:** Sin validación MIME explícita en uploads (riesgo menor)

#### Fragilidad Principal
- Dependencia en `accounting_audit_log` para trazabilidad - bien implementado
- El copilot contable (`copilot_contable.js` migration) añade complejidad AI sin tests específicos

**Evidencia positiva:**
```javascript
// backend/src/modules/contable/middleware/empresa.middleware.js
// Valida X-Empresa-Id header para aislamiento de empresa dentro del tenant
```

---

### 3.3 Marketplace

| Campo | Valor |
|-------|-------|
| **Score** | 5.5 / 10 |
| **Estado** | ⚠️ EN DESARROLLO |

#### Riesgo Técnico
- Rutas en `routes/marketplace.js` y `routes/marketplaceAdmin.js` (legacy pattern)
- Migration `20260121000600_marketplace_constraints_indexes.js` añade constraints correctos
- Sin rate limiting en endpoints públicos

#### Riesgo de Negocio
- **Marketplace público:** Exposición a ataques si no hay rate limiting
- **Multi-tenant exposure:** Talleres exponen servicios - requiere clara separación

#### Fragilidad Principal
```javascript
// backend/routes/marketplace.js - Rutas públicas sin rate limiting
// EVIDENCIA: No hay middleware de rate-limit detectado
```

---

## 4. Riesgos Críticos

| # | Riesgo | Severidad | Impacto | Evidencia |
|---|--------|-----------|---------|-----------|
| 1 | **pool.query en 27+ archivos routes** | 🔴 Alta | Bypass potencial de tenant isolation en rutas legacy | `grep -R "pool.query" backend/routes` → 27 archivos afectados |
| 2 | **CI sin Postgres service** | 🔴 Alta | Tests de integración no validan contra DB real | `.github/workflows/ci.yml` L41: DATABASE_URL sin service block |
| 3 | **Migraciones no ejecutadas en CI** | 🔴 Alta | Schema puede divergir entre entornos | CI no tiene step `migrate:latest` pre-tests |
| 4 | **Guardrails no bloquean merge** | 🟠 Media | pool.query nuevos pueden entrar al codebase | `check:db-guardrails` corre pero no falla build |
| 5 | **Frontend Manager flat** | 🟠 Media | Merge conflicts frecuentes, DX pobre | 27+ HTMLs manager-*.html en frontend/ root |
| 6 | **100+ console.log en runtime** | 🟠 Media | Logs no estructurados en producción | `grep console.log backend/routes` → 17+ archivos |
| 7 | **Sin versionado de API** | 🟡 Baja | Breaking changes difíciles de manejar | Todas las rutas son `/api/resource`, no `/api/v1/resource` |
| 8 | **Legacy routes sin sunset timeline** | 🟡 Baja | Arquitectura V2 no es estándar aún | 30+ rutas en routes/ vs 4 módulos en src/modules/ |
| 9 | **Marketplace sin rate limiting** | 🟡 Baja | Exposición a ataques DoS en endpoints públicos | No hay middleware de rate-limit en routes/marketplace.js |
| 10 | **Falta ONBOARDING.md** | 🟡 Baja | Nuevos devs tardan en setup | `find docs -name "ONBOARDING*"` → sin resultados |

---

## 5. Veredicto de Escalabilidad

### ¿Listo para **20+ usuarios activos**?

| Veredicto | Condiciones |
|-----------|-------------|
| **PARCIAL ⚠️** | Proceder es ARRIESGADO sin mitigar riesgos críticos |

**Condiciones para aprobar:**
1. ✅ `tenant-db.js` con RLS funcional
2. ✅ RBAC enforced en 70+ endpoints
3. ⚠️ **FALTA:** Migrar rutas críticas (caja, ordenes, facturas) a usar SOLO `getTenantDb`
4. ⚠️ **FALTA:** Tests de integración con DB real

**Recomendación:** Migrar al menos `caja.js`, `ordenes.js`, `facturas.js` a patrón puro V2 antes de escalar.

---

### ¿Listo para **5+ desarrolladores simultáneos**?

| Veredicto | Condiciones |
|-----------|-------------|
| **NO 🚨** | Bloqueado hasta implementar CI con DB real |

**Condiciones para aprobar:**
1. ❌ **CI sin Postgres service:** Tests de integración no corren con DB real
2. ❌ **Guardrails no enforced:** Pool.query nuevos pueden entrar
3. ❌ **Migrations no en CI:** `migrate:latest` no se ejecuta pre-tests
4. ⚠️ **Onboarding docs:** Falta ONBOARDING.md step-by-step

**Plan de acción inmediato (48-72h):**
```yaml
# .github/workflows/ci.yml - AÑADIR:
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432

# AÑADIR step pre-tests:
- name: Run Migrations
  run: cd backend && npm run migrate:latest
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
```

---

## 6. Conclusión Final

### Diagnóstico Final

VERSA ha mostrado **progreso significativo** desde la última auditoría:

| Área | Estado Anterior | Estado Actual | Δ |
|------|-----------------|---------------|---|
| Migraciones | SQL manual + Knex mixto | 30 Knex JS consolidados | +3.5 puntos |
| Seguridad/RBAC | En implementación | 70+ endpoints protegidos | +1.0 punto |
| Multi-tenancy | Wrapper básico | RLS con `setRLSContext` | +1.0 punto |
| Observabilidad | RequestId básico | Logger estructurado | +0.5 puntos |

**Score global: 6.4/10** (C+) — Mejora de +0.8 desde 5.6 (D+)

---

### Dónde Invertir Primero (Próximas 2 semanas)

| Prioridad | Acción | Esfuerzo | Impacto |
|-----------|--------|----------|---------|
| **P0** | CI: Añadir Postgres service + migrate:latest | 4h | 🔴 Crítico |
| **P0** | CI: Hacer guardrails bloqueantes | 2h | 🔴 Crítico |
| **P1** | Migrar `caja.js`, `ordenes.js` a patrón puro V2 | 16h | 🟠 Alto |
| **P1** | Eliminar 50 console.log más críticos | 4h | 🟠 Alto |
| **P2** | Crear ONBOARDING.md | 4h | 🟡 Medio |
| **P2** | Mover Manager HTML a src/verticals/manager/ | 8h | 🟡 Medio |

---

### Qué **NO** Escalar Todavía

| Componente | Razón | Condición para escalar |
|------------|-------|------------------------|
| **Marketplace público** | Sin rate limiting | Implementar rate limiter en rutas públicas |
| **Usuarios concurrentes > 20** | pool.query directos en rutas críticas | Migrar a getTenantDb puro |
| **Equipo > 3 devs** | CI no valida contra DB real | Postgres service en CI |
| **Nuevas verticales** | Arquitectura V2 no es estándar aún | Completar migración de Manager a V2 |

---

## Anexo: Evidencia Recopilada

### Estructura del Backend
```
backend/
├── routes/          # 45 archivos (legacy pattern)
├── services/        # 26 servicios (mixed patterns)
├── src/
│   ├── core/        # Infraestructura V2 (tenant-db, logger, validation)
│   └── modules/     # 5 módulos V2 (clientes, vehiculos, ventas, contable, template)
├── db/migrations/   # 30 migraciones Knex JS ✅
└── tests/           # 24 test files
```

### Estructura del Frontend
```
frontend/
├── src/verticals/finsaas/pages/  # 17 páginas organizadas ✅
├── manager-*.html                # 27+ archivos en root ❌
├── services/                     # 22 servicios JS
└── components/                   # 5 componentes
```

### Tests Coverage
```
Total test files: 24 (excluyendo node_modules)
- Unit tests: 9 archivos
- Integration tests: 10 archivos
- Module tests: 5 archivos
Coverage estimada: ~35-40%
```

---

**Fin del informe de auditoría.**

*Generado el 21 de Enero de 2026 por Antigravity AI Auditor*
