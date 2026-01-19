# Legacy Routes Archive

These routes have been archived as part of CRIT-FIX-01.

## Reason
These routes were NOT mounted in `backend/index.js` because they have been replaced by V2 modular implementations in `backend/src/modules/`.

## Replacement Locations
| Legacy File | V2 Replacement |
|-------------|----------------|
| clientes.js | src/modules/clientes/api/clientes.routes.js |
| vehiculos.js | src/modules/vehiculos/api/vehiculos.routes.js |
| ventas.js | src/modules/ventas/api/ventas.routes.js |

## Do NOT Re-enable
These files contain direct `pool.query` calls that bypass tenant isolation (RLS).

If you need to modify client/vehicle/sales logic, do so in the V2 modules.

**Archived on:** 2026-01-15
