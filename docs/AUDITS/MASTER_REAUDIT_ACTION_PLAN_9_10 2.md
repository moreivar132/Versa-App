# VERSA — ACTION PLAN TO 9/10
**Fecha:** 19 de Enero, 2026  
**Objetivo:** Elevar score de 5.6/10 → 9/10  
**Timeline Total:** 12 semanas

---

## 📊 ROADMAP DE SCORES

| Fase | Timeline | Score Target | Hito Principal |
|------|----------|--------------|----------------|
| **Fase 0** | 48-72h | 6.0/10 | CI funcional con DB + guardrails |
| **Fase 1** | 2 semanas | 7.0/10 | 50% pool.query migrados, tests críticos |
| **Fase 2** | 6 semanas | 8.0/10 | Zero pool.query, RLS verified, coverage 60% |
| **Fase 3** | 12 semanas | 9.0/10 | Production-ready multi-tenant SaaS |

---

## 🚀 FASE 0: BLOQUEANTES (48-72h)

### F0.1 — CI: Añadir Postgres Service
**Acción:** Modificar `.github/workflows/ci.yml` para incluir Postgres real

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: versa_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Definition of Done:**
- [ ] CI workflow pasa con tests de integración ejecutándose
- [ ] `npm run test:integration` completa sin errores de conexión

**Cómo Validar:**
```bash
# Verificar en GitHub Actions que el job tiene service postgres
# El step "Run Tests" debe completar sin "ECONNREFUSED"
```

**Owner:** DevOps  
**Esfuerzo:** 2 horas

---

### F0.2 — CI: Execute Migrations Pre-Tests
**Acción:** Añadir step de migraciones antes de tests

```yaml
- name: Run Migrations
  run: cd backend && npm run migrate:latest
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/versa_test
```

**Definition of Done:**
- [ ] Step `migrate:latest` se ejecuta exitosamente en CI
- [ ] Tests corren contra schema actualizado

**Cómo Validar:**
```bash
# En GitHub Actions output, buscar:
# "Batch 1 ran: X migrations"
# Tests pasan sin "relation does not exist"
```

**Owner:** DevOps  
**Esfuerzo:** 1 hora

---

### F0.3 — CI: Guardrails Bloqueantes
**Acción:** Configurar branch protection para requerir guardrails pass

**Pasos:**
1. GitHub → Settings → Branches → main
2. Add rule: Require status checks before merging
3. Select: `quality-check` job

**Definition of Done:**
- [ ] PR con pool.query nuevo NO puede mergearse
- [ ] Status check "quality-check" es required

**Cómo Validar:**
```bash
# Crear PR con pool.query nuevo
# Verificar que merge button está disabled
```

**Owner:** DevOps  
**Esfuerzo:** 30 minutos

---

## 📈 FASE 1: CRÍTICOS (2 semanas)

### F1.1 — Migrar 100 pool.query Críticos
**Acción:** Refactorizar pool.query → getTenantDb en rutas financieras

**Archivos Prioritarios (por riesgo business):**
1. `backend/routes/facturas.js` (facturación)
2. `backend/routes/caja.js` (cash register)
3. `backend/routes/ordenPago.js` (pagos)
4. `backend/routes/ordenes.js` (órdenes)
5. `backend/routes/billingRoutes.js` (suscripciones)

**Patrón de Migración:**
```javascript
// ANTES (legacy):
const result = await pool.query('SELECT * FROM ordenes WHERE id_tenant = $1', [tenantId]);

// DESPUÉS (V2):
const db = getTenantDb(req.ctx);
const result = await db.query('SELECT * FROM ordenes WHERE id_tenant = $1', [tenantId]);
```

**Definition of Done:**
- [ ] 100 pool.query migrados a getTenantDb
- [ ] Zero regresiones en tests existentes
- [ ] `npm run check:db-guardrails` reporta 608 (vs 708 actual)

**Cómo Validar:**
```bash
grep -R "pool\.query" -n backend/routes/facturas.js backend/routes/caja.js | wc -l
# Debe ser 0
```

**Owner:** Backend Lead  
**Esfuerzo:** 16 horas (4h/archivo principal)

---

### F1.2 — Eliminar 50 console.log Críticos
**Acción:** Reemplazar console.log → logger.info/debug en rutas principales

**Patrón:**
```javascript
// ANTES:
console.log('[Facturas] Creating invoice:', data);

// DESPUÉS:
logger.info({ data }, '[Facturas] Creating invoice');
```

**Definition of Done:**
- [ ] Zero console.log en facturas.js, caja.js, ordenPago.js
- [ ] Logs aparecen estructurados en output

**Cómo Validar:**
```bash
grep -R "console\.log" backend/routes/facturas.js | wc -l
# Debe ser 0
```

**Owner:** Backend  
**Esfuerzo:** 4 horas

---

### F1.3 — Tests de Integración para Caja y Facturas
**Acción:** Escribir tests que cubran flujos críticos

**Tests Requeridos:**
1. `tests/integration/caja.cierre.test.js` - Cierre de caja con movimientos
2. `tests/integration/facturas.emision.test.js` - Emisión de factura
3. `tests/integration/facturas.anulacion.test.js` - Anulación de factura

**Definition of Done:**
- [ ] 3 nuevos test files creados
- [ ] Coverage en caja/facturas > 40%
- [ ] CI pasa con nuevos tests

**Cómo Validar:**
```bash
npm run test:integration -- --testPathPattern="caja|facturas"
# Todos deben pasar
```

**Owner:** QA Lead  
**Esfuerzo:** 12 horas

---

### F1.4 — Documentar SQL Manual Ejecutados
**Acción:** Crear checklist de migraciones SQL en `docs/MIGRATIONS_MANUAL.md`

**Incluir:**
- Lista de todos los 69 SQL en `backend/migrations/`
- Estado: ✅ Ejecutado / ⏳ Pendiente
- Orden de ejecución correcto

**Definition of Done:**
- [ ] MIGRATIONS_MANUAL.md creado
- [ ] Checklist verificado contra staging

**Owner:** Backend  
**Esfuerzo:** 4 horas

---

## 🎯 FASE 2: CONSOLIDACIÓN (6 semanas)

### F2.1 — Migrar Remaining pool.query (600+)
**Acción:** Continuar migración batch por batch

**Timeline por Semana:**
- Semana 3-4: routes/compras.js, routes/citas.js, routes/inventory.js
- Semana 5-6: routes/trabajadores.js, routes/chat.js
- Semana 7-8: services/, remaining routes

**Definition of Done:**
- [ ] `npm run check:db-guardrails` reporta 0 violations
- [ ] Zero pool.query en backend/routes/
- [ ] Zero pool.query en backend/services/

**Cómo Validar:**
```bash
grep -R "pool\.query" backend/routes backend/services | wc -l
# Debe ser 0
```

**Owner:** Backend Team  
**Esfuerzo:** 40 horas (5h/semana)

---

### F2.2 — Verificar RLS Policies en Staging
**Acción:** Ejecutar queries de verificación en staging DB

```sql
-- Query 1: Tablas con RLS habilitado
SELECT c.relname AS table, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

-- Query 2: Policies existentes
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

**Definition of Done:**
- [ ] Tablas críticas tienen RLS: clientes, ordenes, facturas, caja
- [ ] Policies correctas para tenant isolation

**Cómo Validar:**
```bash
# Conectar a staging y ejecutar queries
# Todas las tablas críticas deben tener rls_enabled = true
```

**Owner:** Backend Lead  
**Esfuerzo:** 8 horas

---

### F2.3 — Frontend Manager a Verticals
**Acción:** Migrar 27 HTMLs de root a `frontend/src/verticals/manager/`

**Estructura Target:**
```
frontend/src/verticals/manager/
├── pages/
│   ├── caja.html
│   ├── citas.html
│   ├── clientes.html
│   ├── facturas.html
│   ├── inicio.html
│   ├── inventario.html
│   ├── ordenes.html
│   └── ...
├── layout/
│   └── manager-shell.html
└── nav/
    └── manager-nav.json
```

**Definition of Done:**
- [ ] Zero `manager-*.html` en frontend root
- [ ] Vite sirve correctamente desde nueva ubicación
- [ ] Navegación funcional

**Cómo Validar:**
```bash
find frontend -maxdepth 1 -name "manager-*.html" | wc -l
# Debe ser 0
```

**Owner:** Frontend Lead  
**Esfuerzo:** 16 horas

---

### F2.4 — Coverage 60% en Módulos Críticos
**Acción:** Añadir tests hasta alcanzar 60% coverage

**Módulos Target:**
1. caja (0% → 60%)
2. facturas (0% → 60%)
3. ordenes (30% → 60%)
4. ordenPago (20% → 60%)

**Definition of Done:**
- [ ] `npm run test:coverage` muestra 60%+ en módulos críticos
- [ ] CI upload coverage report

**Cómo Validar:**
```bash
npm run test:coverage -- --collectCoverageFrom="routes/caja.js"
# Coverage debe ser ≥60%
```

**Owner:** QA Team  
**Esfuerzo:** 24 horas

---

## 🏆 FASE 3: PRODUCTION-READY (12 semanas)

### F3.1 — Consolidar Migraciones en Knex
**Acción:** Convertir 69 SQL manuales a Knex migrations

**Definition of Done:**
- [ ] Zero archivos .sql en backend/migrations/
- [ ] Todos los SQL convertidos a .js
- [ ] `knex_migrations` table tiene history completo

**Owner:** Backend  
**Esfuerzo:** 24 horas

---

### F3.2 — API Versioning
**Acción:** Introducir `/api/v2/` para endpoints nuevos

**Definition of Done:**
- [ ] Nuevos endpoints bajo `/api/v2/`
- [ ] Documentación de deprecation para v1

**Owner:** Backend  
**Esfuerzo:** 16 horas

---

### F3.3 — Rate Limiting
**Acción:** Implementar rate limiting en endpoints públicos

**Definition of Done:**
- [ ] /api/marketplace: 30 req/min per IP
- [ ] /api/auth/login: 10 req/min per IP
- [ ] Headers `X-RateLimit-*` presentes

**Owner:** Backend  
**Esfuerzo:** 8 horas

---

### F3.4 — Onboarding Documentation
**Acción:** Crear ONBOARDING.md completo

**Incluir:**
1. Prerequisites (Node, Postgres, etc.)
2. Clone + npm install
3. Database setup (create DB, migrate)
4. Environment variables (.env.example)
5. Run dev servers
6. Run tests
7. Architecture overview

**Definition of Done:**
- [ ] Nuevo dev puede setup en < 1 hora
- [ ] Documento reviewed por 2+ devs

**Owner:** Tech Writer  
**Esfuerzo:** 8 horas

---

### F3.5 — Coverage 80%
**Acción:** Alcanzar 80% coverage global

**Definition of Done:**
- [ ] `npm run test:coverage` muestra 80%+ global
- [ ] CI bloquea si coverage < 75%

**Owner:** QA Team  
**Esfuerzo:** 40 horas

---

## 📋 RESUMEN DE ESFUERZO

| Fase | Timeline | Esfuerzo Total | Recursos |
|------|----------|----------------|----------|
| Fase 0 | 48-72h | 4 horas | 1 DevOps |
| Fase 1 | 2 semanas | 36 horas | 1 Backend + 1 QA |
| Fase 2 | 6 semanas | 88 horas | 2 Backend + 1 Frontend + 1 QA |
| Fase 3 | 12 semanas | 96 horas | Team completo |

**TOTAL:** 224 horas (~6 person-weeks)

---

## ✅ CHECKLIST DE VALIDATION

### Pre-Flight (antes de cada fase)
- [ ] Branch protection activa
- [ ] CI passing
- [ ] No regressions en tests

### Post-Fase 0
- [ ] CI con Postgres service ✓
- [ ] Migrations en CI ✓
- [ ] Guardrails blocking ✓

### Post-Fase 1
- [ ] 100 pool.query migrados ✓
- [ ] 50 console.log eliminados ✓
- [ ] Tests caja/facturas ✓

### Post-Fase 2
- [ ] Zero pool.query ✓
- [ ] RLS verified ✓
- [ ] Frontend restructured ✓
- [ ] Coverage 60% ✓

### Post-Fase 3 (9/10)
- [ ] All Knex migrations ✓
- [ ] API v2 ✓
- [ ] Rate limiting ✓
- [ ] Onboarding docs ✓
- [ ] Coverage 80% ✓

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Actual | Fase 1 | Fase 2 | Fase 3 |
|---------|--------|--------|--------|--------|
| Score Global | 5.6 | 7.0 | 8.0 | 9.0 |
| pool.query | 708 | 608 | 0 | 0 |
| console.log | 100+ | 50 | 10 | 0 |
| Test files | 24 | 30 | 45 | 60 |
| Coverage | ~25% | 40% | 60% | 80% |
| CI con DB | ❌ | ✅ | ✅ | ✅ |
| Guardrails blocking | ❌ | ✅ | ✅ | ✅ |
