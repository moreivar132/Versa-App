# Permisos RBAC — Módulo Contable

## Permisos Definidos

| Permiso | Código | Descripción |
|---------|--------|-------------|
| Lectura Contable | `CONTABLE_READ` | Ver facturas, movimientos, reportes |
| Escritura Contable | `CONTABLE_WRITE` | Crear/editar borradores, registrar movimientos |
| Aprobación Contable | `CONTABLE_APPROVE` | Emitir facturas, anular, cerrar caja |
| Exportación | `CONTABLE_EXPORT` | Descargar reportes CSV/XLS |
| Administración | `CONTABLE_ADMIN` | Configurar series, plantillas, categorías |

## Matriz Endpoint → Permiso

### Facturas
| Acción | Endpoint | Permiso Requerido | Super Admin |
|--------|----------|-------------------|-------------|
| Listar facturas | `GET /invoices` | CONTABLE_READ | ✅ |
| Ver factura | `GET /invoices/:id` | CONTABLE_READ | ✅ |
| Descargar PDF | `GET /invoices/:id/pdf` | CONTABLE_READ | ✅ |
| Crear borrador | `POST /invoices` | CONTABLE_WRITE | ✅ |
| Editar borrador | `PUT /invoices/:id` | CONTABLE_WRITE | ✅ |
| Eliminar borrador | `DELETE /invoices/:id` | CONTABLE_WRITE | ✅ |
| **Emitir factura** | `POST /invoices/:id/issue` | CONTABLE_APPROVE | ✅ |
| **Anular factura** | `POST /invoices/:id/cancel` | CONTABLE_APPROVE | ✅ |

### Caja
| Acción | Endpoint | Permiso Requerido | Super Admin |
|--------|----------|-------------------|-------------|
| Ver estado caja | `GET /cash/status` | CONTABLE_READ | ✅ |
| Registrar movimiento | `POST /cash/movements` | CONTABLE_WRITE | ✅ |
| Abrir caja | `POST /cash/open` | CONTABLE_WRITE | ✅ |
| **Cerrar caja** | `POST /cash/close` | CONTABLE_APPROVE | ✅ |

### Configuración
| Acción | Endpoint | Permiso Requerido | Super Admin |
|--------|----------|-------------------|-------------|
| Ver series | `GET /config/series` | CONTABLE_ADMIN | ✅ |
| Crear serie | `POST /config/series` | CONTABLE_ADMIN | ✅ |
| Editar config tenant | `PUT /config/tenant` | CONTABLE_ADMIN | ✅ |

### Reportes y Exports
| Acción | Endpoint | Permiso Requerido | Super Admin |
|--------|----------|-------------------|-------------|
| Ver reporte IVA | `GET /reports/vat` | CONTABLE_READ | ✅ |
| Ver dashboard | `GET /reports/dashboard` | CONTABLE_READ | ✅ |
| **Exportar CSV** | `GET /reports/export/*` | CONTABLE_EXPORT | ✅ |

## Roles Sugeridos

### Cajero/Recepcionista
```json
["CONTABLE_READ", "CONTABLE_WRITE"]
```
- Puede ver facturas y movimientos
- Puede registrar ingresos/egresos
- **NO puede** emitir facturas ni cerrar caja

### Contador/Administrativo
```json
["CONTABLE_READ", "CONTABLE_WRITE", "CONTABLE_APPROVE", "CONTABLE_EXPORT"]
```
- Acceso completo a operaciones contables
- Puede emitir y anular facturas
- Puede exportar reportes

### Gerente/Administrador
```json
["CONTABLE_READ", "CONTABLE_WRITE", "CONTABLE_APPROVE", "CONTABLE_EXPORT", "CONTABLE_ADMIN"]
```
- Todo lo anterior
- Puede configurar series y plantillas

## Implementación en Middleware

```javascript
// Ejemplo de uso en rutas
router.post('/invoices/:id/issue',
    verifyJWT,
    requirePermission('CONTABLE_APPROVE'),
    invoicesController.issue
);

router.get('/reports/export/:type',
    verifyJWT,
    requirePermission('CONTABLE_EXPORT'),
    reportsController.export
);
```

## Auditoría de Acciones Críticas

Las siguientes acciones disparan un registro en `audit_log`:

| Acción | Tipo Audit | Datos Registrados |
|--------|------------|-------------------|
| Emitir factura | `INVOICE_ISSUED` | id_factura, numero, total, usuario |
| Anular factura | `INVOICE_CANCELLED` | id_factura, numero, motivo, usuario |
| Cerrar caja | `CASH_CLOSED` | id_caja, saldo_final, diferencia, usuario |
| Registrar cobro CC | `PAYMENT_RECEIVED` | id_cuenta, importe, usuario |
| Exportar reporte | `REPORT_EXPORTED` | tipo, rango_fechas, usuario |
