# Módulo: Contable

## Objetivo del módulo
Centralizar la información financiera del negocio: facturación, flujos de caja, cuentas por cobrar/pagar y cumplimiento fiscal.

## Alcance
- **Incluye**:
    - Emisión de facturas (Invoices).
    - Gestión de Caja Diaria.
    - Cuentas Corrientes de clientes y proveedores.
    - Reportes de pérdidas y ganancias (P&L).
- **NO incluye**:
    - Gestión de la operación técnica del taller (Módulo Taller).
    - Logística de envíos (Módulo Marketplace).

## Endpoints
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | `/api/facturas` | Generar factura legal |
| GET | `/api/caja/resumen` | Estado actual de la caja |
| GET | `/api/cuentas-corrientes/:id` | Saldo pendiente de un tercero |
| ... | ... | ... |

## Tablas usadas
- `ventas`
- `facturas`
- `caja_movimientos`
- `cuentas_corrientes`
- `income_event`

## Permisos/RBAC
- `contable:ver`: Visualización de reportes básicos.
- `contable:full`: Capacidad de anular facturas y cerrar caja.

## Eventos/Webhooks
- `contable.factura.emitida`: Actualiza el saldo en la cuenta corriente.
- `contable.caja.cerrada`: Genera reporte diario para administración.

## Tests esperados (mínimos)
- Unitarios: Validación de impuestos (IVA, RETENCIONES).
- Integración: Flujo "Pago de Orden de Taller -> Registro en Caja -> Generación de Factura".

## Riesgos típicos y cómo evitarlos
- **Descuadre de caja**: Forzar que cada movimiento en la tabla `ventas` tenga un `id_movimiento_caja` asociado.
- **Facturación duplicada**: Implementar llaves de idempotencia en el endpoint de creación de facturas.
