# Roadmap Contable V2

Este documento define los pasos incrementales para implementar el Módulo Contable V2 sin romper funcionalidad existente.

---

## MOD-CONTABLE-02: Crear Tablas y Migraciones

### Objetivo
Añadir las tablas faltantes para completar el modelo de datos V2.

### Tareas
- [ ] Crear migración `contable_category` (categorías de ingreso/gasto)
- [ ] Crear migración `contable_bill` + `contable_bill_line` (facturas recibidas)
- [ ] Crear migración `audit_log` (si no existe globalmente)
- [ ] Añadir columna `id_tenant` a `facturacabecera` (desnormalización para queries)
- [ ] Poblar `id_tenant` en registros existentes
- [ ] Añadir columna `id_categoria` a `cajamovimiento`

### Criterios de Aceptación
- [ ] Migraciones idempotentes (IF NOT EXISTS)
- [ ] Índices creados para queries frecuentes
- [ ] Script de rollback documentado

---

## MOD-CONTABLE-03: Refactorizar Facturas Emitidas

### Objetivo
Migrar código de `routes/facturas.js` a la nueva estructura modular.

### Tareas
- [ ] Crear `src/modules/contable/infra/repos/invoice.repo.js`
- [ ] Crear `src/modules/contable/application/services/invoice.service.js`
- [ ] Crear `src/modules/contable/api/controllers/invoices.controller.js`
- [ ] Crear `src/modules/contable/api/invoices.routes.js`
- [ ] Usar `getTenantDb(ctx)` en todas las queries
- [ ] Añadir RBAC (CONTABLE_READ, CONTABLE_WRITE, CONTABLE_APPROVE)
- [ ] Mantener aliases en `routes/facturas.js` para compatibilidad

### Tests Mínimos
- [ ] Test OK: Listar facturas con tenant
- [ ] Test NoTenant: 403 sin contexto
- [ ] Test NoPerm: 403 sin CONTABLE_READ

---

## MOD-CONTABLE-04: Refactorizar Caja y Movimientos

### Objetivo
Migrar código de `routes/caja.js` a la nueva estructura modular.

### Tareas
- [ ] Crear `invoice.repo.js` → `cash.repo.js`
- [ ] Crear `cash.service.js`
- [ ] Crear `cash.controller.js`
- [ ] Crear `cash.routes.js`
- [ ] Unificar endpoints ingreso/egreso en `POST /movements`
- [ ] Añadir RBAC para cerrar caja (CONTABLE_APPROVE)

### Tests Mínimos
- [ ] Test OK: Estado de caja
- [ ] Test OK: Registrar movimiento
- [ ] Test NoPerm: 403 al cerrar sin CONTABLE_APPROVE

---

## MOD-CONTABLE-05: Facturas Recibidas (Proveedores)

### Objetivo
Implementar CRUD de facturas de proveedores.

### Tareas
- [ ] Crear endpoints en `bills.routes.js`
- [ ] Crear `bills.controller.js`, `bills.service.js`, `bills.repo.js`
- [ ] Validar que proveedor pertenece al tenant
- [ ] Calcular IVA soportado automáticamente
- [ ] Vincular a compras existentes (opcional)

### Tests Mínimos
- [ ] Test OK: Crear factura recibida
- [ ] Test: Calcular IVA soportado correctamente

---

## MOD-CONTABLE-06: Reportes IVA y Dashboard

### Objetivo
Implementar reportes fiscales básicos y KPIs consolidados.

### Tareas
- [ ] `GET /reports/vat` — Libro IVA repercutido/soportado
- [ ] `GET /reports/dashboard` — Ingresos, egresos, margen, IVA estimado
- [ ] Agregar por período (mes, trimestre, año)
- [ ] Cache de resultados (opcional, si performance lo requiere)

### Criterios de Aceptación
- [ ] IVA repercutido = suma `importe_iva` de facturas emitidas
- [ ] IVA soportado = suma `importe_iva` de facturas recibidas + compras
- [ ] Redondeo a 2 decimales consistente

---

## MOD-CONTABLE-07: Audit Log y Hardening

### Objetivo
Añadir trazabilidad completa y reforzar seguridad.

### Tareas
- [ ] Crear middleware `auditAction(accion, entidad)`
- [ ] Registrar en `audit_log` para acciones críticas:
  - Emitir factura
  - Anular factura
  - Cerrar caja
  - Registrar cobro CC
  - Exportar reportes
- [ ] Incluir `request_id`, `ip_address`, `user_agent`
- [ ] Crear endpoint `GET /audit` (solo CONTABLE_ADMIN)

### Tests Mínimos
- [ ] Al emitir factura, existe registro en audit_log
- [ ] Solo admin puede listar audit

---

## MOD-CONTABLE-08: Exports CSV/XLS

### Objetivo
Permitir descarga de datos contables en formatos estándar.

### Tareas
- [ ] `GET /reports/export/invoices` — Facturas emitidas
- [ ] `GET /reports/export/bills` — Facturas recibidas
- [ ] `GET /reports/export/vat` — Libro IVA
- [ ] Usar librería `xlsx` o `csv-stringify`
- [ ] RBAC: `CONTABLE_EXPORT`

---

## MOD-CONTABLE-09: Integraciones (Fase 3)

### Objetivo
Conectar con fuentes externas de datos financieros.

### Tareas
- [ ] Sync pagos Stripe → facturas/cobros
- [ ] Import CSV bancario para conciliación manual
- [ ] Marcar movimientos como "conciliados"

---

## Checklist de Seguridad (Todas las Fases)

Cada PR de este módulo debe validar:

- [ ] ¿Se usa `getTenantDb(ctx)` en todas las queries?
- [ ] ¿Se valida el permiso RBAC en el endpoint?
- [ ] ¿Los totales se calculan con 2 decimales?
- [ ] ¿Las acciones críticas disparan audit_log?
- [ ] ¿Se incluyen los 3 tests mínimos (OK, NoTenant, NoPerm)?
