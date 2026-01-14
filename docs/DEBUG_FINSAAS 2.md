# FinSaaS Debug Report

## Problem
FinSaaS module was not saving or displaying data. Error: `invalid input syntax for type integer: ""`

## Root Causes

### 1. Empty String → Integer Parse Error
- **Location**: [contactos.controller.js](file:///Users/admin/Library/Mobile%20Documents/com~apple~CloudDocs/Versa-App/backend/src/modules/contable/api/controllers/contactos.controller.js) line 95-98
- **Evidence**: Frontend sends `id_empresa: ""` when no empresa selected
- **Fix**: Sanitize empty strings to `null`

### 2. Response Format Mismatch
- **Location**: [empresa.controller.js](file:///Users/admin/Library/Mobile%20Documents/com~apple~CloudDocs/Versa-App/backend/src/modules/contable/api/controllers/empresa.controller.js) line 56-59
- **Evidence**: Controller returned `{data: rows}`, frontend expected `{data: {items: rows}}`
- **Fix**: Changed response to `{data: {items: rows, total: rows.length}}`

### 3. Missing RBAC Permissions
- **Evidence**: 403 Forbidden on protected endpoints
- **Fix**: Seed script assigns 8 contabilidad permissions to user's role

## Verification

| Check | Status |
|-------|--------|
| DB tables exist | ✅ 10 tables |
| Empresas in DB | ✅ 2 records |
| Contactos in DB | ✅ 4 records |
| API ping | ✅ 200 OK |
| Permissions assigned | ✅ 8 permissions |

## Commands to Reproduce Fix
```bash
# Run seed script
node scripts/seed_finsaas_qa.js

# Restart backend (if using nodemon, auto-restarts)
```

## Files Changed
- `backend/src/modules/contable/api/controllers/empresa.controller.js`
- `backend/src/modules/contable/api/controllers/contactos.controller.js`
- **NEW**: `backend/scripts/seed_finsaas_qa.js`
