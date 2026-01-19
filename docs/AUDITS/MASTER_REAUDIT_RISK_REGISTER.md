# VERSA — MASTER RE-AUDIT RISK REGISTER
**Fecha:** 19 de Enero, 2026  
**Commit:** `e4bc57e947c5a5007864d1ee2be5a20a56d10973`

---

## 📊 MATRIZ DE RIESGOS

### Escala de Severidad
- 🔴 **CRÍTICO (9-10):** Puede causar pérdida de datos, breach de seguridad, o downtime total
- 🟠 **ALTO (7-8):** Impacto significativo en operaciones o seguridad
- 🟡 **MEDIO (4-6):** Impacto moderado, workarounds disponibles
- 🟢 **BAJO (1-3):** Impacto menor, mejora de calidad

### Escala de Probabilidad
- **ALTA (8-10):** Ocurrirá en las próximas 2 semanas
- **MEDIA (5-7):** Puede ocurrir en el próximo mes
- **BAJA (1-4):** Poco probable que ocurra

### Escala de Detectabilidad
- **FÁCIL (1-3):** Se detecta inmediatamente en tests/logs
- **MEDIA (4-6):** Requiere monitoreo activo para detectar
- **DIFÍCIL (7-10):** Puede pasar desapercibido por semanas

---

## 🚨 REGISTRO DE RIESGOS

| ID | Riesgo | Sev. | Prob. | Detect. | Score RPN | Categoría | Mitigación Propuesta | Owner | ETA |
|----|--------|------|-------|---------|-----------|-----------|---------------------|-------|-----|
| R001 | **708 pool.query directos bypassing tenant-db** | 🔴 10 | ALTA 9 | DIFÍCIL 8 | **720** | Seguridad | Migrar a getTenantDb en batches de 50 | Backend Lead | 4 sem |
| R002 | **CI sin Postgres service** | 🔴 9 | ALTA 10 | FÁCIL 2 | **180** | CI/CD | Añadir Postgres 16 service en workflow | DevOps | 48h |
| R003 | **Migraciones no ejecutadas en CI** | 🔴 9 | ALTA 10 | MEDIA 5 | **450** | CI/CD | Añadir step `migrate:latest` pre-tests | DevOps | 48h |
| R004 | **69 SQL manuales sin tracking** | 🟠 8 | MEDIA 6 | DIFÍCIL 8 | **384** | Data | Consolidar en Knex o crear tracker | Backend Lead | 2 sem |
| R005 | **Guardrails no bloquean merge** | 🟠 8 | ALTA 9 | FÁCIL 3 | **216** | CI/CD | Branch protection con required checks | DevOps | 24h |
| R006 | **100+ console.log en runtime** | 🟡 5 | ALTA 10 | FÁCIL 2 | **100** | Observability | Reemplazar con logger estructurado | Backend | 1 sem |
| R007 | **Frontend Manager flat (27 HTMLs root)** | 🟠 7 | MEDIA 5 | MEDIA 5 | **175** | DX | Migrar a src/verticals/manager/ | Frontend Lead | 2 sem |
| R008 | **Test coverage ~25%** | 🟠 8 | ALTA 8 | MEDIA 5 | **320** | Testing | Tests para facturas, caja, ordenes | QA Lead | 3 sem |
| R009 | **RLS policies incompletas** | 🟠 8 | MEDIA 6 | DIFÍCIL 7 | **336** | Seguridad | Verificar y completar RLS en staging | Backend Lead | 2 sem |
| R010 | **SuperAdmin override sin audit log** | 🟡 6 | BAJA 4 | DIFÍCIL 8 | **192** | Seguridad | Logger.warn en cada x-tenant-id override | Backend | 1 sem |
| R011 | **Sin versionado de API** | 🟡 5 | MEDIA 5 | FÁCIL 3 | **75** | API | Introducir /api/v2/ para nuevos endpoints | Backend | 4 sem |
| R012 | **Falta ONBOARDING.md** | 🟡 4 | MEDIA 5 | FÁCIL 2 | **40** | DX | Crear doc step-by-step | Tech Writer | 1 sem |
| R013 | **Legacy routes sin sunset timeline** | 🟡 5 | MEDIA 6 | MEDIA 5 | **150** | Deuda | Crear LEGACY_SUNSET_PLAN.md | Tech Lead | 2 sem |
| R014 | **Marketplace sin rate limiting** | 🟡 6 | MEDIA 5 | MEDIA 5 | **150** | Seguridad | Rate limiter en /api/marketplace | Backend | 2 sem |
| R015 | **OCR intake sin validación MIME** | 🟡 5 | BAJA 3 | MEDIA 5 | **75** | Seguridad | Validar MIME + file size en upload | Backend | 1 sem |

---

## 📈 RESUMEN POR CATEGORÍA

| Categoría | Riesgos | Score RPN Promedio | Acción Urgente |
|-----------|---------|-------------------|----------------|
| **Seguridad** | R001, R009, R010, R014, R015 | 295 | R001 (pool.query) |
| **CI/CD** | R002, R003, R005 | 282 | R002, R003 (DB en CI) |
| **Testing** | R008 | 320 | R008 (coverage) |
| **Data** | R004 | 384 | R004 (migraciones) |
| **DX** | R007, R012 | 108 | R007 (frontend) |
| **API** | R011 | 75 | N/A (low priority) |
| **Observability** | R006 | 100 | R006 (console.log) |
| **Deuda** | R013 | 150 | R013 (sunset plan) |

---

## 🎯 TOP 5 RIESGOS POR RPN (Risk Priority Number)

1. **R001 - pool.query directo (RPN: 720)** → BLOQUEANTE para 20+ usuarios
2. **R003 - Migrations not in CI (RPN: 450)** → BLOQUEANTE para 5+ devs
3. **R004 - SQL manual sin tracking (RPN: 384)** → Causa drift inevitable
4. **R009 - RLS policies incompletas (RPN: 336)** → Riesgo de leak latente
5. **R008 - Test coverage 25% (RPN: 320)** → Bugs en módulos financieros

---

## 🔄 MATRIZ DE IMPACTO vs PROBABILIDAD

```
PROBABILIDAD
    ALTA │  R002,R003  │    R001    │
         │  R005,R006  │    R008    │
         │             │            │
   MEDIA │  R011,R012  │  R004,R007 │
         │             │  R009,R013 │
         │             │    R014    │
         │             │            │
    BAJA │             │  R010,R015 │
         │             │            │
         └─────────────┼────────────┼─────────
                 BAJO/MEDIO    ALTO/CRÍTICO
                                     SEVERIDAD
```

---

## 📋 PLAN DE MITIGACIÓN POR FASE

### Fase 0: Bloqueantes (48-72h)
| Riesgo | Acción | Definición de Done |
|--------|--------|-------------------|
| R002 | Añadir Postgres 16 service a CI | Tests de integración pasan |
| R003 | Step `migrate:latest` en CI | Schema synced antes de tests |
| R005 | Branch protection con checks | PRs bloqueados si guardrails fail |

### Fase 1: Críticos (2 semanas)
| Riesgo | Acción | Definición de Done |
|--------|--------|-------------------|
| R001 | Migrar 100 pool.query más críticos | facturas, caja, ordenes usando getTenantDb |
| R006 | Reemplazar 50 console.log | logger.* en routes críticos |
| R004 | Documentar SQL manual ejecutados | Checklist de qué correr en dev |

### Fase 2: Altos (6 semanas)
| Riesgo | Acción | Definición de Done |
|--------|--------|-------------------|
| R001 | Migrar remaining 600+ pool.query | Zero pool.query en routes/ |
| R008 | Coverage 50% en módulos críticos | Tests para caja, facturas, ordenes |
| R009 | Verificar RLS policies en staging | Query de verificación pasa |
| R007 | Frontend Manager a verticals/ | 0 HTMLs en root |

---

## 📊 KPIs DE SEGUIMIENTO

| Métrica | Valor Actual | Target Fase 1 | Target Fase 2 |
|---------|--------------|---------------|---------------|
| pool.query directos | 708 | < 600 | 0 |
| console.log en runtime | 100+ | < 50 | 0 |
| Test files | 24 | 35 | 50 |
| Coverage estimada | 25% | 40% | 60% |
| Guardrails blocking | NO | SÍ | SÍ |
| CI con DB real | NO | SÍ | SÍ |
| Migrations en CI | NO | SÍ | SÍ |

---

## ⚠️ RIESGOS RESIDUALES (post-mitigación)

| ID | Riesgo Residual | Severidad | Aceptación |
|----|-----------------|-----------|------------|
| R001-R | Algunos edge cases sin getTenantDb | 🟡 BAJO | Aceptable con tests |
| R009-R | RLS policies correctas pero no testeadas | 🟡 BAJO | Tests de RLS needed |
| R008-R | Coverage < 100% | 🟢 BAJO | Industry standard 70-80% |
