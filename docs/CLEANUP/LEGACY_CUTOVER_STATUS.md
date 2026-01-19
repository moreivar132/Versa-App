# Legacy Cutover Status
**Last Updated:** 2026-01-15

## Overview
This document tracks the migration status from legacy routes to V2 modular architecture.

## Completed Migrations

| Module | Legacy Route | V2 Module | Status |
|--------|-------------|-----------|--------|
| Clientes | routes/clientes.js | src/modules/clientes/ | ✅ Archived |
| Vehiculos | routes/vehiculos.js | src/modules/vehiculos/ | ✅ Archived |
| Ventas | routes/ventas.js | src/modules/ventas/ | ✅ Archived |
| Contabilidad | N/A (new) | src/modules/contable/ | ✅ V2 Only |

## Pending Migrations (Legacy Still Mounted)

| Module | Legacy Route | Priority | Notes |
|--------|-------------|----------|-------|
| Ordenes | routes/ordenes.js | HIGH | Critical business logic |
| Caja | routes/caja.js | HIGH | Financial operations |
| Facturas | routes/facturas.js | HIGH | Billing critical |
| Citas | routes/citas.js | MEDIUM | Scheduling |
| Inventario | routes/inventory.js | MEDIUM | Stock management |
| Compras | routes/compras.js | MEDIUM | Purchasing |
| Cuentas Corrientes | routes/cuentasCorrientes.js | MEDIUM | Credit accounts |

## Archive Location
Legacy routes that have been retired are stored in:
```
legacy/backend/routes/
```

## Notes
- All archived routes contain direct `pool.query` calls (RLS bypass)
- V2 modules use `getTenantDb(ctx)` for tenant-aware queries
- Do not re-enable archived routes without full RLS refactor
