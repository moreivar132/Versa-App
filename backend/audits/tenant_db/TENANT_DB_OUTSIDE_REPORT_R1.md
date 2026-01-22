# Tenant DB Bypass Audit — R1 Report

**Date:** 2026-01-21  
**Auditor:** Antigravity (Staff+ SaaS Architect)  
**Scope:** `backend/` only  
**Evidence:** `backend/audits/tenant_db/R1_*.txt`

---

## 1. Executive Summary

| Metric | R0 (prev) | R1 (now) | Δ |
|--------|-----------|----------|---|
| **Guardrails Total** | 86 | **48** | -38 ✅ |
| **Files with violations (runtime A)** | ~32 | **20** | -12 |
| **S1 Critical files** | ~12 | **8** | -4 |

### Batches Completed Since R0
- **A11:** Security Core (auth.js, rbac.js, context.js, etc.)
- **A12:** Routes (dashboardPrefs, subscriptions, tecnicos, customerPortal, impuestos)

---

## 2. Violation Breakdown

| Runtime | Count | Description |
|---------|-------|-------------|
| A (Production) | 20 | Routes, services, middleware in active use |
| B (Legacy) | 2 | `legacy/` folder — not mounted |
| C (Scripts) | 31+ | migrations, seeds, debug, tests |

| Risk | Count | Description |
|------|-------|-------------|
| S1 (Critical) | 8 | Auth, billing, RBAC, contabilidad |
| S2 (High) | 9 | Notifications, marketplace, PDF services |
| S3 (Low) | 36+ | Scripts, seeds, tests, legacy models |

---

## 3. Top 10 by Volume (Runtime A only)

| # | File | Type | pool | client | Total | Risk |
|---|------|------|------|--------|-------|------|
| 1 | services/marketplaceService.js | service | 4 | 25 | **29** | S1 |
| 2 | routes/invitePublic.js | route | 0 | 17 | **17** | S1 |
| 3 | services/googleAuthService.js | service | 0 | 12 | **12** | S1 |
| 4 | routes/customerGoogleAuth.js | route | 0 | 6 | **6** | S1 |
| 5 | models/vehiculoModel.js | model | 6 | 0 | **6** | S3 |
| 6 | routes/trabajadores.js | route | 0 | 5 | **5** | S1 |
| 7 | services/ordenPDFService.js | service | 4 | 0 | **4** | S2 |
| 8 | src/modules/contable/.../documentos.controller.js | controller | 3 | 0 | **3** | S1 |
| 9 | services/unifiedNotificationService.js | service | 3 | 0 | **3** | S2 |
| 10 | services/customerPortalService.js | service | 3 | 0 | **3** | S2 |

> [!NOTE]
> Files #2–6 use `client.query` **inside proper transaction wrappers** (`getSystemDb().connect()` or `getTenantDb.tx()`). These are **SAFE patterns** but still flagged by grep.

---

## 4. Production Queue (Runtime A + Risk S1/S2)

Files that must be cleaned for multi-tenant production safety:

| # | File | Type | Total | Risk | Notes |
|---|------|------|-------|------|-------|
| 1 | services/marketplaceService.js | service | 29 | S1 | Complex transactions |
| 2 | services/ordenPDFService.js | service | 4 | S2 | PDF generation |
| 3 | services/unifiedNotificationService.js | service | 3 | S2 | Notifications |
| 4 | services/customerPortalService.js | service | 3 | S2 | Customer payments |
| 5 | services/ventaPDFService.js | service | 3 | S2 | PDF generation |
| 6 | services/auditService.js | service | 2 | S1 | Audit trail |
| 7 | src/modules/contable/.../documentos.controller.js | controller | 3 | S1 | Contabilidad |
| 8 | middleware/subscriptionCheck.js | middleware | 2 | S1 | Billing |
| 9 | routes/meRoutes.js | route | 1 | S1 | User profile |
| 10 | routes/marketplace.js | route | 1 | S2 | Public marketplace |
| 11 | routes/marketplaceAdmin.js | route | 1 | S2 | Admin marketplace |
| 12 | middleware/featureGate.js | middleware | 1 | S2 | Feature flags |
| 13 | api/marketplace/sucursales.js | route | 1 | S2 | Branches |
| 14 | api/marketplace/busqueda.js | route | 2 | S2 | Search |

**Total Production Queue:** 14 files (~56 violations)

---

## 5. Batch A13 Targets (Auto-Selected)

Criteria: Runtime A, Risk S1/S2, highest total_count, not in SAFE-pattern group.

| # | Path | Type | Runtime | Risk | Total | Notes |
|---|------|------|---------|------|-------|-------|
| 1 | services/marketplaceService.js | service | A | S1 | 29 | Complex - may split |
| 2 | services/ordenPDFService.js | service | A | S2 | 4 | PDF |
| 3 | src/modules/contable/.../documentos.controller.js | controller | A | S1 | 3 | Remaining 3 from A6 |
| 4 | services/unifiedNotificationService.js | service | A | S2 | 3 | Notifications |
| 5 | services/auditService.js | service | A | S1 | 2 | Audit trail |

**Expected Reduction:** ~41 violations (48 → ~7)

> [!WARNING]
> `marketplaceService.js` is large (29 occurrences). Consider splitting into A13a/A13b if needed.

---

## 6. Docs Drift Detected

The following docs reference outdated numbers:

| Doc | Issue |
|-----|-------|
| `TENANT_DB.md` line 9 | Says "195 archivos" — actual is ~53 |
| `RLS_PLAN.md` line 9 | Says "195 archivos" — actual is ~53 |

**Action:** Update in a separate documentation batch after A13.

---

## 7. Evidence Files

| File | Purpose |
|------|---------|
| `R1_guardrails_output.txt` | Official guardrails (48 violations) |
| `R1_grep_pool.txt` | Raw pool.query/connect matches (282 lines) |
| `R1_grep_client.txt` | Raw client.query matches (411 lines) |
| `R1_grep_require_db.txt` | Direct require('../db') matches (132 lines) |
| `TENANT_DB_OUTSIDE_INVENTORY_R1.csv` | Normalized inventory |

---

## Definition of Done

✅ Evidence files created  
✅ CSV inventory generated  
✅ Report with Batch A13 selection created  
✅ Guardrails count traceable to evidence  
