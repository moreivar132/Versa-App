# Tenant DB Audit Report — Cycle R0

**Date:** 2026-01-21  
**Status:** Post-Batch A1–A10  
**Guardrails Total:** 86 violations (runtime files only)

---

## A) Executive Summary

| Metric | Count |
|--------|-------|
| **Total files with matches** | 145 |
| **After excluding allowlist** | 141 |
| **Runtime A (production)** | 32 |
| **Legacy B** | 2 |
| **Scripts/Migrations C** | 107 |
| **Risk S1 (critical)** | 12 |
| **Risk S2 (important)** | 14 |
| **Risk S3 (low)** | 115 |

### Allowlist (Excluded)
- `backend/db.js`
- `backend/src/core/db/index.js`
- `backend/src/core/db/tenant-db.js`
- `backend/src/core/db/with-tenant-db-from-req.js`

### Files Using Transactional Pattern (SAFE)
The following files use `client.query` within `getSystemDb().connect()` or `getTenantDb.tx()` wrapper — **NOT violations**:
- `backend/routes/customerGoogleAuth.js` (6 client.query within systemDb transaction)
- `backend/routes/invitePublic.js` (14 client.query within systemDb transaction)
- `backend/routes/trabajadores.js` (6 client.query within tenantDb.tx)
- `backend/services/googleAuthService.js` (9 client.query within systemDb transaction)

---

## B) Top 20 Violations by Count (Runtime A Only)

| # | Path | pool | client | Total | Vertical | Risk |
|---|------|------|--------|-------|----------|------|
| 1 | `services/marketplaceService.js` | 2 | 22 | 24 | Marketplace | S2 |
| 2 | `models/vehiculoModel.js` | 6 | 0 | 6 | Manager | S2 |
| 3 | `services/notificacionService.js` | 6 | 0 | 6 | Manager | S2 |
| 4 | `routes/auth.js` | 5 | 0 | 5 | Core | S1 |
| 5 | `src/core/security/context.js` | 5 | 0 | 5 | Core | S1 |
| 6 | `src/core/security/requireVerticalAccess.js` | 5 | 0 | 5 | Core | S1 |
| 7 | `middleware/rbac.js` | 4 | 0 | 4 | Core | S1 |
| 8 | `services/ordenPDFService.js` | 4 | 0 | 4 | Manager | S2 |
| 9 | `src/modules/contable/.../documentos.controller.js` | 3 | 0 | 3 | FinSaaS | S1 |
| 10 | `services/customerPortalService.js` | 3 | 0 | 3 | Marketplace | S2 |
| 11 | `services/unifiedNotificationService.js` | 3 | 0 | 3 | Manager | S2 |
| 12 | `services/ventaPDFService.js` | 3 | 0 | 3 | Manager | S2 |
| 13 | `routes/dashboardPrefs.js` | 3 | 0 | 3 | Manager | S3 |
| 14 | `routes/subscriptions.js` | 2 | 0 | 2 | Core | S1 |
| 15 | `services/auditService.js` | 2 | 0 | 2 | Core | S2 |
| 16 | `middleware/featureGate.js` | 1 | 0 | 1 | Core | S1 |
| 17 | `middleware/subscriptionCheck.js` | 1 | 0 | 1 | Core | S1 |
| 18 | `routes/customerPortal.js` | 1 | 0 | 1 | Marketplace | S2 |
| 19 | `routes/marketplace.js` | 1 | 0 | 1 | Marketplace | S2 |
| 20 | `routes/marketplaceAdmin.js` | 1 | 0 | 1 | Marketplace | S2 |

---

## C) Batch Candidates — Next 10 Files

Based on: **Runtime A** → **Risk S1** → **Highest Count**

### Batch A11 (Proposed)
1. `backend/routes/auth.js` (5 pool.query) — S1 Core
2. `backend/middleware/rbac.js` (4 pool.query) — S1 Core
3. `backend/src/core/security/context.js` (5 pool.query) — S1 Core
4. `backend/src/core/security/requireVerticalAccess.js` (5 pool.query) — S1 Core
5. `backend/middleware/featureGate.js` (1 pool.query) — S1 Core

### Batch A12 (Proposed)
1. `backend/middleware/subscriptionCheck.js` (1 pool.query) — S1 Core
2. `backend/routes/subscriptions.js` (2 pool.query) — S1 Core
3. `backend/src/modules/contable/.../documentos.controller.js` (3 pool.query) — S1 FinSaaS
4. `backend/services/marketplaceService.js` (24 total) — S2 Marketplace
5. `backend/models/vehiculoModel.js` (6 pool.query) — S2 Manager

---

## D) Confirmation of Progress (A1–A10)

### Files Cleaned (No Longer Violations)
The following files were refactored in previous batches and are now **CLEAN**:

| Batch | Files Cleaned |
|-------|---------------|
| A3 | `routes/citas.js`, `services/portalCitasService.js`, `routes/chat.js`, `routes/crmChat.js`, `routes/whatsapp.js` |
| A4 | `routes/accessRoutes.js`, `routes/proveedores.js`, `routes/sucursales.js`, `services/emailAutomationService.js`, `services/emailCampaignService.js` |
| A5 | `modules/contable/api/controllers/egresos.controller.js`, `tesoreria.controller.js`, `empresa.controller.js`, `modules/open_banking/openBankingService.js`, `modules/banking/services/bankImport.service.js` |
| A6 | `modules/contable/api/controllers/finsaasRbac.controller.js`, `deducible.controller.js`, `copiloto.controller.js`, `middleware/empresa.middleware.js` |
| A7 | `modules/banking/services/bankService.js`, `modules/banking/controllers/import.controller.js`, `services/incomeService.js`, `services/copilot/tools.service.js`, `services/copilot/alerts.service.js` |
| A8 | `models/userModel.js`, `models/tenantModel.js`, `models/roleModel.js`, `models/permisoModel.js`, `models/sucursalModel.js` |
| A9 | `routes/stripeWebhook.js`, `routes/stripe.js`, `routes/billingRoutes.js`, `services/stripeService.js`, `services/googleAuthService.js` |
| A10 | `routes/invitePublic.js`, `routes/trabajadores.js`, `routes/customerGoogleAuth.js`, `services/saasInviteService.js`, `services/trialService.js` |

**Total cleaned in A1-A10:** ~40 files

---

## E) Anomalies

### Files Still Showing `client.query` After Refactor
- `routes/invitePublic.js`: 14 `client.query` — **SAFE** (uses `getSystemDb().connect()`)
- `routes/trabajadores.js`: 6 `client.query` — **SAFE** (uses `getTenantDb.tx()`)
- `routes/customerGoogleAuth.js`: 6 `client.query` — **SAFE** (uses `getSystemDb().connect()`)
- `services/googleAuthService.js`: 9 `client.query` — **SAFE** (uses `getSystemDb().connect()`)

These are **transactional wrappers**, not direct pool access.

### Remaining `documentos.controller.js` Violations
- 3 `pool.query` remain in `documentos.controller.js` (lines 206, 216, 419)
- These were NOT fully cleaned in A6 batch

---

## F) Evidence Commands

```bash
# Guardrails check
cd backend && npm run check:db-guardrails
# Result: 86 violations

# Grep for raw inventory
grep -rlE "pool\.query|pool\.connect|client\.query" backend \
  --include="*.js" | grep -vE "node_modules" | wc -l
# Result: 145 files
```
