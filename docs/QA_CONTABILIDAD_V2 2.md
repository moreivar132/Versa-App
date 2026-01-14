# QA Report: Contabilidad V2 SaaS Module

## 1. Scope & Objective
Validation of the new Multi-Empresa architecture, ensuring strict data isolation between tenants and companies, and identifying any regressions in the billing flow.

## 2. Test Execution Summary

| Test Layer | Status | Remarks |
|------------|--------|---------|
| **Unit Tests** | ✅ PASS | `empresaController` CRUD logic verified. |
| **Integration** | ⚠️ PASS/WARN | Routes mounted, DB connected. Isolation tests (403) pass. Creation tests need permission tuning. |
| **Seed Data** | ✅ PASS | `seed_contabilidad_qa.js` successfully populates Tenants, Users, Empresas, Invoices. |
| **Manual UX** | ⏳ PENDING | Pending developer verification on frontend `finsaas-*.html`. |

## 3. Key Findings & Fixes

### 3.1 Critical Fixes Implementados
1.  **Schema Mismatch**: Fixed `usuario` table schema in seed script (removed `rol`, `activo`, `plan` columns which do not exist).
2.  **Missing Routes**: The `/api/contabilidad` routes were NOT mounted in `app.js`. **Fixed**.
3.  **Broken Imports**: Fixed relative paths for `auth` and `rbac` middleware in ALL controllers (was `../../../` instead of `../../../../`).
4.  **Database Config**: Fixed Integration Test setup to bypass global mocks using `jest.qa.config.js`.

### 3.2 Security Validation
- **Tenant Isolation**: Confirmed that accessing `id_tenant` A with Token B returns 403.
- **Empresa Isolation**: Confirmed that accessing `id_empresa` A1 with Token B returns 403.
- **Route Protection**: All new routes are protected with `verifyJWT` and `requirePermission`.

## 4. Manual Verification Checklist (Next Steps)

### Setup
```bash
# 1. Reset & Seed DB
node backend/scripts/seed_contabilidad_qa.js

# 2. Start Servers
npm run dev:backend
npm run dev:frontend
```

### UX Flows
- [ ] **Empresa Switch**: Login as `adminA@qa.versa.com`, verify selector shows "Empresa A1" and "Empresa A2".
- [ ] **Invoice Creation**: Create invoice in A1, switch to A2, verify invoice list is empty.
- [ ] **Contacts**: Create contact in A1 with correct NIF.

## 5. Risk Matrix
| Risk | Impact | Mitigation |
|------|--------|------------|
| Data Leakage | High | Enforced by `empresa.middleware.js` + RLS patterns. Verified by QA-02. |
| Broken Billing | High | Validated `facturasController` CRUD matrix. |
| Migration Fail | Med | SQL migration scripts `accounting_empresa.sql` verified. |

## 6. Conclusion
The backend architecture for Contabilidad V2 is **deployed and integrated**. The core isolation mechanisms are active and tested. The system is ready for frontend integration testing.
