# SECURITY: Tenant Resolution Flow

This document describes how VERSA identifies and enforces the tenant context for every request.

## 1. Authentication Layer (`verifyJWT`)
- User provides a Bearer Token.
- Middleware decodes the token and attaches `req.user`.
- **Primary Field:** `req.user.id_tenant` (the owner of the account).

## 2. Context Layer (`tenantContextMiddleware`)
- Executed after `auth`.
- It calls `resolveTenantContext(req)` to determine the `tenantId`.

### Resolution Logic:
1. **Normal Users:** The `tenantId` is STRICTLY taken from `req.user.id_tenant`. Any override header is ignored.
2. **SuperAdmins:** Can impersonate tenants using (in order):
   - Header: `x-tenant-id`
   - Query: `?tenantId=...`
   - Body: `{ "id_tenant": ... }`
   - Fallback: JWT tenant ID.

When a SuperAdmin impersonates, a `SECURITY_WARNING` is logged with the impersonation details.

## 3. Database Layer (`tenant-db`)
- Every query MUST use `getTenantDb(ctx)`.
- **RLS Enforcement:** It executes `SET LOCAL app.tenant_id = '...'` before the actual query.
- This ensures that even if a developer forgets a `WHERE id_tenant` clause, PostgreSQL Row Level Security (RLS) will block cross-tenant data access.

## 4. Vertical Layer (`requireEmpresa`)
- Specifically for **FinSaaS/Contable** routes.
- Requires `x-empresa-id` header.
- Validates that the requested `empresaId` belongs to the resolved `tenantId`.

---

## Technical Stack
- **Enforcement:** `src/core/security/tenant-context.js`
- **DB Wrapper:** `src/core/db/tenant-db.js`
- **Guardrail:** `scripts/check-no-pool-query.js`
