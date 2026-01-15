# LEGACY_CUTOVER_STATUS.md

**Fecha:** 2026-01-15  
**Última revisión:** CRIT-FIX-00

---

## Estado de Rutas: V2 vs Legacy

### ✅ Migradas a V2 (Montadas desde `/src/modules/`)

| Endpoint | Módulo V2 | Montaje en `index.js` |
|----------|-----------|----------------------|
| `/api/clientes` | `src/modules/clientes` | ✅ Línea 80 |
| `/api/vehiculos` | `src/modules/vehiculos` | ✅ Línea 81 |
| `/api/ventas` | `src/modules/ventas` | ✅ Línea 82 |
| `/api/contabilidad` | `src/modules/contable` | ✅ Línea 85 |

---

### ⚠️ Todavía en Legacy (Montadas desde `/routes/`)

| Endpoint | Archivo Legacy | Línea en `index.js` |
|----------|----------------|---------------------|
| `/api/citas` | `routes/citas.js` | 88 |
| `/api/inventory` | `routes/inventory.js` | 89 |
| `/api/sucursales` | `routes/sucursales.js` | 90 |
| `/api/compras` | `routes/compras.js` | 91 |
| `/api/chat` | `routes/chat.js` | 92 |
| `/api/crm/chat` | `routes/crm_chat.js` | 93 |
| `/api/upload` | `routes/upload.js` | 94 |
| `/api/whatsapp` | `routes/whatsapp.js` | 95 |
| `/api/stripe` | `routes/stripe.js` | 96 |
| `/api/subscriptions` | `routes/subscriptions.js` | 97 |
| `/api/billing` | `routes/billingRoutes.js` | 98 |
| `/api/ordenes` | `routes/ordenes.js` | 99 |
| `/api/ordenpago` | `routes/ordenPago.js` | 100 |
| `/api/medio-pago` | `routes/medioPago.js` | 101 |
| `/api/impuestos` | `routes/impuestos.js` | 102 |
| `/api/caja` | `routes/caja.js` | 103 |
| `/api/tecnicos` | `routes/tecnicos.js` | 104 |
| `/api/trabajadores` | `routes/trabajadores.js` | 105 |
| `/api/facturas` | `routes/facturas.js` | 106 |
| `/api/cuentas-corrientes` | `routes/cuentasCorrientes.js` | 107 |
| `/api/income-events` | `routes/incomeEvents.js` | 108 |
| `/api/dashboard` | `routes/dashboardPrefs.js` | 109 |
| `/api/marketplace` | `routes/marketplace.js` | 112 |
| `/api/marketplace/admin` | `routes/marketplaceAdmin.js` | 113 |
| `/api/marketing/email` | `routes/marketingEmail.js` | 116 |
| `/api/marketing/campaigns` | `routes/emailCampaign.js` | 117 |
| `/api/public/fidelizacion` | `routes/fidelizacionPublic.js` | 120 |
| `/api/admin/fidelizacion` | `routes/fidelizacionAdmin.js` | 121 |
| `/api/open-banking` | `routes/openBankingRoutes.js` | 124 |

---

## Archivos Legacy Eliminables (NO montados)

Los siguientes archivos en `routes/` YA NO se usan porque fueron reemplazados por V2:

| Archivo | Razón | Acción Sugerida |
|---------|-------|-----------------|
| `routes/clientes.js` | Reemplazado por `src/modules/clientes` | ⚠️ Verificar y mover a `legacy/` |
| `routes/vehiculos.js` | Reemplazado por `src/modules/vehiculos` | ⚠️ Verificar y mover a `legacy/` |
| `routes/ventas.js` | Reemplazado por `src/modules/ventas` | ⚠️ Verificar y mover a `legacy/` |

> **NOTA:** Estos archivos aún existen pero NO están montados en `index.js`. Deben moverse a `legacy/backend/routes/` en la siguiente fase de cleanup.

---

## Próximas Migraciones (Priorizadas)

1. **caja** — Alto volumen de código, crítico para finanzas
2. **ordenes** — Core del taller
3. **facturas** — Relacionado con contabilidad
4. **compras** — Relacionado con inventario
