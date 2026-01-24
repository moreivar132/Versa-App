# Tenant DB Bypass - Resumen Ejecutivo (Cycle R0)

**Fecha:** 21 de Enero, 2026  
**Para:** Rafael y equipo  
**Estado Actual:** Post-Batch A1–A10  
**Prioridad:** 🔴 CRÍTICA (Disminuyendo)

---

## 📈 Progreso de Limpieza

Desde el inicio de las tareas de refactorización (Batches A1–A10), hemos logrado reducir significativamente la superficie de riesgo:

| Métrica | Base (Inicial) | **Ciclo R0 (Hoy)** | Mejora |
|---------|:--------------:|:------------------:|:------:|
| Archivos con bypass (Total) | 195 | **145** | -50 |
| Violaciones (Guardrails Runtime) | ~144 | **86** | -40% |
| Rutas críticas (S1) pendientes | 40+ | **12** | -70% |

---

## ¿Qué Falta Por Hacer?

Aunque hemos limpiado más de **40 archivos clave** (incluyendo todo FinSaaS Controllers y Banking), aún quedan **32 archivos en runtime de producción** que requieren atención inmediata.

### 🔴 Top Batches Pendientes (S1/S2)

#### Batch A11: Seguridad Core & RBAC
- `backend/routes/auth.js`
- `backend/middleware/rbac.js`
- `backend/src/core/security/context.js`
- Otros modelos de seguridad.
*Riesgo:* Estos controlan el acceso global al sistema.

#### Batch A12: Marketplace & Facturación Restante
- `services/marketplaceService.js` (24 ocurrencias)
- `models/vehiculoModel.js`
- `documentos.controller.js` (Pendiente de limpieza final)

---

## ¿Por Qué Sigue Siendo Peligroso?

> ⚠️ **Aislamiento Incompleto**

1. **Rutas de Auth:** Siguen usando `pool.query` directo, lo que dificulta la trazabilidad de auditoría unificada.
2. **Servicios de Marketplace:** Tienen el mayor conteo de violaciones individuales (24 en un solo archivo).
3. **Falsa Seguridad:** Algunos archivos muestran `client.query`, pero hemos verificado que en los batches A9/A10 se implementó el patrón transaccional CORRECTO (`getSystemDb().connect()`), por lo que ya son seguros.

---

## Score Estimado: Aislamiento & Multi-tenancy

| Estado | Score | Justificación |
|--------|-------|---------------|
| **Base (Inicial)** | **3/10** | Bypass masivo, sin RLS, riesgo extremo de leak. |
| **ACTUAL (R0)** | **7/10** | ~70% de rutas críticas migradas. Patrones de sistema/tenant establecidos. |
| **Meta (Tras A11/A12)** | **9/10** | Todos los archivos de producción limpios. RLS habilitado. |

---

## Archivos Detallados

Ver documentos actualizados:
- **Inventario CSV:** `TENANT_DB_OUTSIDE_INVENTORY.csv` (82 entradas significativas)
- **Reporte completo:** `TENANT_DB_OUTSIDE_REPORT.md`

---

**Actualizado automáticamente tras Auditoría R0 por Antigravity AI**  
*Reflejando el estado real del repositorio después de 10 batches de refactorización.*
