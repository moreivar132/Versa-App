# Módulo: Taller

## Objetivo del módulo
Gestionar el ciclo de vida de las órdenes de reparación, vehículos y clientes dentro del entorno físico del taller automotriz.

## Alcance
- **Incluye**:
    - Gestión de Vehículos (VIN, Placas, Histórico).
    - Órdenes de Trabajo (Estatus, Repuestos, Mano de obra).
    - Calendario de Citas.
    - Recepción de vehículos y fotos de estado.
- **NO incluye**:
    - Pagos de suscripción de la plataforma (Módulo Suscripciones).
    - Venta de repuestos externos (Módulo Marketplace).
    - Gestión de nómina de mecánicos (Módulo Contable).

## Endpoints
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | `/api/ordenes` | Listar órdenes del taller |
| POST | `/api/ordenes` | Crear nueva orden de trabajo |
| GET | `/api/vehiculos/:id` | Detalle de vehículo y su historial |
| ... | ... | ... |

## Tablas usadas
- `ordenes`
- `vehiculos`
- `clientes` (compartida o vía referencia)
- `citas`
- `orden_items`

## Permisos/RBAC
- `taller:leer`: Ver órdenes y vehículos.
- `taller:escribir`: Crear o modificar órdenes.
- `taller:admin`: Eliminar registros o configurar tipos de servicio.

## Eventos/Webhooks
- `taller.orden.creada`: Emitido cuando se abre una OT.
- `taller.orden.finalizada`: Notifica al cliente y al módulo contable.

## Tests esperados (mínimos)
- Unitarios: Cálculo de totales en la OR (mano de obra + materiales).
- Integración: Flujo completo de "Crea Cita -> Convierte a Orden -> Cierra Orden".

## Riesgos típicos y cómo evitarlos
- **Abatimiento de stock fantasma**: Asegurar que al añadir un repuesto a la orden, se use el `InventoryService` para reservar stock, no descontarlo directamente en DB.
- **Inconsistencia de historial**: Validar que el kilometraje de una orden nueva no sea menor al de la orden anterior del mismo vehículo.
