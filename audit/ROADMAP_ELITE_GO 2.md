# 🚀 ROADMAP VERSA "ELITE" — Hacia el 9/10

Este plan detalla los pasos exactos para resolver los bloqueos críticos detectados en la auditoría R2 y alcanzar un estado de **Production Readiness**.

---

## 📅 FASE 1: Red de Seguridad (CI/CD)
**Objetivo:** Activar el "Robot" de GitHub para que nada se rompa sin que nos demos cuenta.

### ✅ Bloque 1.1: Activación del Pipeline CI — COMPLETADO
> **Fecha:** 2026-01-22 | **Commit:** Pendiente de push

**Lo que se hizo:**
1. ✅ **Crear Workflow:** Creado `.github/workflows/backend-ci.yml`
2. ✅ **Definir Jobs:**
   - **Quality Check:** Linting del código (no bloquea por ahora, solo reporta).
   - **DB Guardrails:** Ejecuta `npm run check:db-guardrails` — **BLOQUEA** si hay violaciones.
   - **Tests:** Ejecuta `npm test` — Reporta pero no bloquea (hasta que arreglemos los 63 tests fallidos).
   - **CI Summary:** Genera resumen visual en GitHub.
3. ⏳ **Protección de Ramas:** Pendiente de configurar manualmente en GitHub Settings.

**Archivos creados:**
- `.github/workflows/backend-ci.yml` — Pipeline completo con 4 jobs

---

### ✅ Bloque 1.2: Visibilidad de Despliegue — COMPLETADO
> **Fecha:** 2026-01-22 | **Commit:** Pendiente de push

**Lo que se hizo:**
1. ✅ **Documentar Rollback:** Creado `docs/OPERATIONS/RUNBOOK.md` con:
   - Procedimiento de rollback via Git
   - Procedimiento de rollback via plataforma hosting
   - Rollback de migraciones de BD
   - Smoke tests manuales y automáticos
   - Checklist post-incidente

**Archivos creados:**
- `docs/OPERATIONS/RUNBOOK.md` — Manual de operaciones de emergencia

---

### 📋 Pasos Pendientes (Manual en GitHub)
1. Ir a **GitHub → Settings → Branches**
2. Añadir regla de protección para `main`/`master`
3. Activar "Require status checks to pass before merging"
4. Seleccionar "db-guardrails" como check requerido

---

## 🧪 FASE 2: Restauración de Confianza (Por Etapas)
**Objetivo:** Que los 306 tests vuelvan a pasar al 100% actualizándolos al nuevo patrón de base de datos.

### Etapa 2.1: Rutas y Configuración (Quick Wins)
**Estado:** ✅ COMPLETADO
**Logros:**
1. **Fix `src/app.js`:** Corregida ruta de importación de `clientes`.
2. **DB Mock:** Eliminado mock global problemático. Tests integración usan DB real (desmocked).
3. **Seeds:** Arreglados scripts de seed `seed_contabilidad_qa.js` (Foreign Keys).
4. **Seguridad:** Parcheada vulnerabilidad Crítica de Cross-Tenant Write en Facturas (QA-04).
5. **Tests:** 100% pasando en `tests/integration/contabilidad.qa.test.js` y `deducible.qa.test.js`.

### Etapa 2.2: Mock Drift (Controladores)
**Estado:** ✅ COMPLETADO
**Logros:**
1. **Refactor Mock:** Actualizados `empresaController.test.js`, `verticalAccess.test.js`, `ordenPagoService.test.js` y `ordenPagoRepository.test.js`.
2. **Patrón Base:** Creado mock reusable en `backend/src/core/db/__mocks__/tenant-db.js`.
3. **Green Suite:** 100% de los tests unitarios (151 tests) pasando correctamente.

### Etapa 2.3: Integración FinSaaS
**Estado:** ✅ COMPLETADO
**Logros:**
1. **Vertical Access:** Implementadas tablas de catálogo de verticales y habilitado acceso para tenants existentes.
2. **Security Fix:** Corregido bypass de RBAC en tests habilitando verificación real de permisos cross-tenant.
3. **Business Logic:** Corregida omisión de kilometraje obligatorio en Órdenes de Trabajo.
4. **Green Suite:** 100% de los tests de integración (157 tests) pasando correctamente.

---

## 📜 FASE 3: Trazabilidad B2B (Audit Log) ✅
**Objetivo:** Implementar la "Caja Negra" para saber quién hizo qué en el sistema.

### Bloque 3.1: Infraestructura de Auditoría ✅
**Estado:** ✅ COMPLETADO
**Logros:**
1. **Consolidación DB:** Tabla `audit_logs` estandarizada con `before/after_json` e IP tracking.
2. **Audit Service:** Implementado servicio centralizado en `src/core/logging/audit-service.js`.
3. **Security Bypass:** Integrado registro automático de "Impersonation" en el middleware RBAC.

### Bloque 3.2: Integración en Flujos Críticos ✅
**Estado:** ✅ COMPLETADO
**Logros:**
1. **FinSaaS:** Auditoría activa en el CRUD de Facturas y Contactos Contables.
2. **Manager:** Registro de creación/edición de órdenes, cambios de estado, movimientos de caja y cierres.
3. **Open Banking:** Trazabilidad completa de conexiones, sincronizaciones, conciliaciones y cuentas manuales.
4. **Reliability:** Uso de `getSystemDb()` para garantizar el log incluso ante fallos de transacción o restricciones RLS.

---

## 🏁 RESULTADO ESPERADO
Al finalizar este plan, VERSA pasará de un **5.9** a un **~8.5/10**:
- ✅ **CI/CD:** GitHub protegiendo cada commit.
- ✅ **Tests:** 100% passing (306/306).
- ✅ **Audit Log:** Trazabilidad total para clientes corporativos.
- ✅ **GO TO PRODUCTION:** Riesgo técnico mínimo.

---

### ¿Cómo empezamos?
Recomiendo ejecutar el **Bloque 1.1 (CI/CD)** inmediatamente, ya que es la base que protegerá todo lo demás. ¿Damos el primer paso?
