# Endpoints Contable V2

## Tabla de Endpoints Propuestos

### Facturas Emitidas
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| POST | `/api/contable/invoices` | Crear factura directa | CONTABLE_WRITE |
| POST | `/api/contable/invoices/from-order/:id` | Emitir desde orden | CONTABLE_WRITE |
| GET | `/api/contable/invoices` | Listar facturas | CONTABLE_READ |
| GET | `/api/contable/invoices/:id` | Obtener factura | CONTABLE_READ |
| GET | `/api/contable/invoices/:id/pdf` | Generar/obtener PDF | CONTABLE_READ |
| PUT | `/api/contable/invoices/:id` | Actualizar borrador | CONTABLE_WRITE |
| POST | `/api/contable/invoices/:id/issue` | Emitir (BORRADOR→EMITIDA) | CONTABLE_APPROVE |
| POST | `/api/contable/invoices/:id/cancel` | Anular factura | CONTABLE_APPROVE |
| DELETE | `/api/contable/invoices/:id` | Eliminar borrador | CONTABLE_WRITE |

### Facturas Recibidas (Fase 2)
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| POST | `/api/contable/bills` | Registrar factura proveedor | CONTABLE_WRITE |
| GET | `/api/contable/bills` | Listar facturas recibidas | CONTABLE_READ |
| GET | `/api/contable/bills/:id` | Obtener factura recibida | CONTABLE_READ |
| PUT | `/api/contable/bills/:id` | Actualizar | CONTABLE_WRITE |

### Series y Configuración
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| GET | `/api/contable/config/series` | Listar series | CONTABLE_ADMIN |
| POST | `/api/contable/config/series` | Crear serie | CONTABLE_ADMIN |
| PUT | `/api/contable/config/series/:id` | Actualizar serie | CONTABLE_ADMIN |
| GET | `/api/contable/config/tenant` | Config diseño tenant | CONTABLE_ADMIN |
| PUT | `/api/contable/config/tenant` | Actualizar config | CONTABLE_ADMIN |

### Caja y Movimientos
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| GET | `/api/contable/cash/status` | Estado actual caja | CONTABLE_READ |
| POST | `/api/contable/cash/open` | Abrir caja | CONTABLE_WRITE |
| POST | `/api/contable/cash/close` | Cerrar caja | CONTABLE_APPROVE |
| GET | `/api/contable/cash/movements` | Listar movimientos | CONTABLE_READ |
| POST | `/api/contable/cash/movements` | Registrar movimiento | CONTABLE_WRITE |
| GET | `/api/contable/cash/verify-funds` | Verificar fondos | CONTABLE_READ |

### Cuentas Corrientes
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| GET | `/api/contable/accounts` | Listar cuentas | CONTABLE_READ |
| GET | `/api/contable/accounts/:id` | Detalle cuenta | CONTABLE_READ |
| GET | `/api/contable/accounts/:id/movements` | Movimientos cuenta | CONTABLE_READ |
| POST | `/api/contable/accounts/:id/charge` | Registrar cargo | CONTABLE_WRITE |
| POST | `/api/contable/accounts/:id/payment` | Registrar abono | CONTABLE_WRITE |

### Reportes (Fase 2)
| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| GET | `/api/contable/reports/vat` | Libro IVA por período | CONTABLE_READ |
| GET | `/api/contable/reports/pnl` | P&L simplificado | CONTABLE_READ |
| GET | `/api/contable/reports/dashboard` | KPIs consolidados | CONTABLE_READ |
| GET | `/api/contable/reports/export/:type` | Export CSV/XLS | CONTABLE_EXPORT |

---

## Mapeo de Compatibilidad: Endpoints Actuales → V2

| Endpoint Actual | Nuevo Endpoint V2 | Notas |
|-----------------|-------------------|-------|
| `POST /api/facturas/ordenes/:id/emitir` | `POST /api/contable/invoices/from-order/:id` | Añadir RBAC |
| `GET /api/facturas` | `GET /api/contable/invoices` | Añadir tenant context |
| `GET /api/facturas/:id` | `GET /api/contable/invoices/:id` | Sin cambios |
| `GET /api/facturas/:id/pdf` | `GET /api/contable/invoices/:id/pdf` | Sin cambios |
| `GET /api/facturas/series` | `GET /api/contable/config/series` | RBAC: CONTABLE_ADMIN |
| `POST /api/facturas/series` | `POST /api/contable/config/series` | RBAC: CONTABLE_ADMIN |
| `GET /api/facturas/config-tenant` | `GET /api/contable/config/tenant` | Sin cambios |
| `GET /api/caja/estado-actual` | `GET /api/contable/cash/status` | Migrar helper |
| `POST /api/caja/ingreso` | `POST /api/contable/cash/movements` | Unificar tipo |
| `POST /api/caja/egreso` | `POST /api/contable/cash/movements` | Unificar tipo |
| `POST /api/caja/cerrar` | `POST /api/contable/cash/close` | RBAC |
| `GET /api/cuentas-corrientes` | `GET /api/contable/accounts` | Sin cambios |
| `GET /api/cuentas-corrientes/:id` | `GET /api/contable/accounts/:id` | Sin cambios |
| `POST /api/cuentas-corrientes/:id/cobro` | `POST /api/contable/accounts/:id/payment` | Renombrar |

> **Estrategia de Migración**: Los endpoints legacy se mantendrán como aliases durante 2 releases, redirigiendo internamente a los nuevos controllers con un header `X-Deprecated: true`.
