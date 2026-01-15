# CRIT-FIX-01: pool.query Inventory Report
**Date:** 2026-01-15
**Status:** COMPLETED

## Summary
This report documents all occurrences of direct `pool.query` usage outside the core DB wrapper layer.

---

## Classification Legend
- **A) Runtime Critical**: Mounted routes/services executed in production
- **B) Dead Code/Legacy Unmounted**: Not loaded at runtime, safe to archive
- **C) Scripts**: Acceptable for maintenance/migration scripts

---

## A) Runtime Critical (REQUIRES FIX)

### V2 Modules (src/modules/)
| File | Count | Action |
|------|-------|--------|
| `contable/infra/repos/contabilidad.repo.js` | ~50 | Refactor to getTenantDb |
| `contable/infra/repos/fiscalProfile.repo.js` | 4 | Refactor to getTenantDb |
| `contable/api/controllers/empresa.controller.js` | 12 | Move SQL to repo |
| `contable/api/controllers/egresos.controller.js` | 3 | Move SQL to repo |
| `contable/api/controllers/documentos.controller.js` | Multiple | Move SQL to repo |
| `contable/api/controllers/tesoreria.controller.js` | Multiple | Move SQL to repo |
| `contable/middleware/empresa.middleware.js` | 2 | Refactor to getTenantDb |

### Mounted Legacy Routes (routes/)
| File | Mounted Path | Count |
|------|--------------|-------|
| `citas.js` | /api/citas | High |
| `inventory.js` | /api/inventory | High |
| `ordenes.js` | /api/ordenes | High |
| `caja.js` | /api/caja | Very High |
| `facturas.js` | /api/facturas | High |
| `compras.js` | /api/compras | High |
| `cuentasCorrientes.js` | /api/cuentas-corrientes | High |

### Services (services/)
| File | Count | Notes |
|------|-------|-------|
| `trialService.js` | 9 | System context acceptable |
| `incomeService.js` | 8 | Needs tenant context |
| `makeEmailProvider.js` | 1 | System context |

---

## B) Dead Code / Legacy Unmounted (ARCHIVE)

| File | Status | Action |
|------|--------|--------|
| `routes/clientes.js` | NOT MOUNTED | Move to legacy/ |
| `routes/vehiculos.js` | NOT MOUNTED | Move to legacy/ |
| `routes/ventas.js` | NOT MOUNTED | Move to legacy/ |

---

## C) Scripts (ACCEPTABLE)

| Path | Purpose |
|------|---------|
| `scripts/debug/*` | Debug utilities |
| `scripts/migrations_legacy/*` | One-time migrations |
| `diag.js` | Diagnostics |
| `ejecutar_migracion_*.js` | Migration runners |
| `debug_*.js` | Debug scripts |

---

## Core DB Layer (ALLOWLISTED)

| File | Purpose |
|------|---------|
| `db.js` | Pool singleton (source of truth) |
| `src/core/db/tenant-db.js` | RLS-aware wrapper |
| `src/core/db/index.js` | Legacy compatibility layer |
| `src/app.js:L152` | Health check endpoint |
| `index.js:L133` | DB test endpoint |

---

## Immediate Actions (This PR)
1. ✅ Archive unmounted legacy routes
2. ✅ Create guardrail script
3. ⚠️ Contable module refactor (partial - repos only)

## Deferred Actions (Future PRs)
- Refactor mounted legacy routes (caja, ordenes, facturas, etc.)
- Refactor incomeService.js
