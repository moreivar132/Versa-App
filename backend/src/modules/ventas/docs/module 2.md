# Módulo: Ventas

## Objetivo
Gestionar el ciclo de vida de las ventas directas (mostrador/TPV), incluyendo líneas de productos, métodos de pago, inventario y movimientos de caja.

## Alcance
- **Incluye**:
    - Creación de ventas con líneas de productos
    - Registro de pagos (efectivo, tarjeta, transferencia)
    - Descuento automático de stock
    - Movimientos de caja asociados
    - Generación de documentos PDF/HTML
    - Anulación con reversión de stock
- **NO incluye**:
    - Facturación legal (Módulo Facturas)
    - Órdenes de trabajo (Módulo Taller)
    - Compras a proveedores (Módulo Compras)

## Endpoints

| Método | Path | Descripción | Permiso |
|--------|------|-------------|---------|
| POST | `/api/ventas` | Crear nueva venta | `ventas.create` |
| GET | `/api/ventas` | Listar ventas con filtros | `ventas.view` |
| GET | `/api/ventas/:id` | Obtener venta por ID | `ventas.view` |
| GET | `/api/ventas/:id/pdf` | Documento HTML de venta | `ventas.view` |
| PUT | `/api/ventas/:id` | Actualizar venta | `ventas.edit` |
| DELETE | `/api/ventas/:id` | Eliminar venta | `ventas.delete` |
| POST | `/api/ventas/:id/anular` | Anular venta | `ventas.void` |

## Tablas Usadas
- `venta` - Cabecera de venta
- `ventalinea` - Líneas de productos
- `ventapago` - Pagos asociados
- `producto` - Para descuento de stock
- `almacen` - Para movimientos de inventario
- `movimientoinventario` - Registro de salidas
- `cajamovimiento` - Ingresos en caja
- `mediopago` - Catálogo de métodos de pago
- `clientefinal` - Cliente asociado
- `sucursal` - Sucursal donde se realiza

## Permisos/RBAC
- `ventas.view` - Ver listado y detalle
- `ventas.create` - Crear ventas
- `ventas.edit` - Editar ventas existentes
- `ventas.delete` - Eliminar ventas
- `ventas.void` - Anular ventas

## Eventos/Webhooks
- `income_event` emitido por cada pago para el ledger central

## Cómo Probar

### Crear Venta
```bash
curl -X POST http://localhost:3000/api/ventas \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "idSucursal": 1,
    "idCliente": 1,
    "lineas": [
      {"descripcion": "Aceite 5W40", "cantidad": 2, "precio": 25.00, "iva": 21}
    ],
    "pagos": [
      {"codigoMedioPago": "EFECTIVO", "importe": 60.50}
    ]
  }'
```

### Listar Ventas
```bash
curl http://localhost:3000/api/ventas?limit=10 \
  -H "Authorization: Bearer <token>"
```

### Anular Venta
```bash
curl -X POST http://localhost:3000/api/ventas/123/anular \
  -H "Authorization: Bearer <token>"
```

## Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Fuga cross-tenant | Todas las queries usan `tenantDb` con `ctx.tenantId` |
| Descuadre de stock | Transacciones para operaciones multi-tabla |
| Descuadre de caja | Movimiento de caja siempre asociado al pago |
| Venta sin pago | Validación en frontend + permitido para ventas a crédito |

## Estructura del Módulo
```
src/modules/ventas/
├── api/
│   ├── ventas.routes.js    # Definición de endpoints
│   └── ventas.controller.js # Manejo de requests
├── application/
│   └── ventas.service.js   # Lógica de negocio
├── infra/
│   └── ventas.repo.js      # Acceso a datos (SQL)
├── validation/
│   └── (schemas futuros)
├── docs/
│   └── module.md           # Esta documentación
└── __tests__/
    └── (tests futuros)
```
