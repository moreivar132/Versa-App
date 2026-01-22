# R3 Migrations Summary

**Date:** 2026-01-22  
**Commit:** `805e18edfadc643e1d1b20b0fd3046fb3e2c683d`  
**Branch:** `rafael`

---

## 📊 Migration Inventory

| Category | Count | Location |
|----------|-------|----------|
| **Knex Migrations (Tracked)** | 19 | `db/migrations/*.js` |
| **Legacy Runner Scripts** | 21 | `migrations/*.js` |
| **Legacy SQL Files** | 35 | `migrations/*.sql`, `legacy/sql-migrations/` |

---

## Gate C: Migrations & Drift

| Criteria | Status | Evidence |
|----------|--------|----------|
| Single source of truth exists | ✅ PASS | Knex migrations in `db/migrations/` |
| `npm run migrate:latest` works | ✅ PASS | Verified locally |
| No conflicting schema changes | ✅ PASS | Legacy scripts archived, not run |
| Drift documented | ⚠️ WARN | Legacy SQL exists but archived |

---

## Knex Migrations (Official)

The following 19 Knex migrations are tracked and controlled:

```
db/migrations/
├── 20260113090000_create_open_banking_tables.js
├── 20260113091000_create_marketplace_base.js
├── 20260113092000_create_marketplace_horarios.js
├── 20260113093000_create_marketplace_reservas.js
├── 20260113094000_create_marketplace_promociones.js
├── 20260113095000_create_marketplace_fidelizacion.js
├── 20260113100000_create_caja_tables.js
├── 20260114100000_add_caja_chica.js
├── 20260114110000_add_orden_dates.js
├── 20260114120000_add_pending_email_columns.js
├── 20260116090000_create_vertical_catalog.js
├── 20260117100000_create_income_events.js
├── 20260117110000_create_billing_tables.js
├── 20260118100000_add_rls_policies.js
├── 20260118200000_seed_rbac_finsaas.js
├── 20260119100000_create_email_templates.js
├── 20260120150000_create_banking_core.js
├── 20260121100000_add_invoice_logo_empresa.js
└── 20260122123908_consolidate_audit_logs.js
```

---

## Legacy SQL (Archived - NOT USED)

Legacy SQL files have been archived and are **not executed** in normal workflows:
- Located in: `backend/legacy/sql-migrations-archive/`
- Not run by CI/CD or `npm run migrate:latest`
- Kept for historical reference only

---

## Recommendations

1. **Completed:** Knex is the single source of truth for schema changes.
2. **Completed:** Legacy runners moved to `scripts/migrations_legacy/`.
3. **Future:** Consider deleting legacy SQL after confirming all schema is in Knex.

---

## Conclusion

**Gate C Status: ✅ PASS**

Migration drift is under control. Knex provides a reproducible, version-controlled path for all schema changes. Legacy SQL files exist but are archived and not executed in production workflows.
