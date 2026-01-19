# Módulo: Marketplace

## Objetivo del módulo
Facilitar la compra y venta de repuestos y servicios entre proveedores y usuarios finales, integrando pasarelas de pago.

## Alcance
- **Incluye**:
    - Catálogo de productos.
    - Carrito de compras.
    - Integración con Stripe (Pagos y Connect).
    - Reseñas y calificaciones.
- **NO incluye**:
    - Gestión interna del inventario del taller (Módulo Taller).
    - Conciliación bancaria profunda (Módulo Contable).

## Endpoints
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | `/api/marketplace/search` | Búsqueda de productos |
| POST | `/api/marketplace/checkout` | Crear sesión de pago |
| POST | `/api/marketplace/reviews` | Publicar reseña |
| ... | ... | ... |

## Tablas usadas
- `products`
- `orders_marketplace`
- `reviews`
- `stripe_accounts`

## Permisos/RBAC
- `marketplace:comprar`: Usuario final con acceso al catálogo.
- `marketplace:seller`: Acceso a subir productos y ver ventas.

## Eventos/Webhooks
- `marketplace.pago.completado`: Dispara la notificación de envío.
- `marketplace.review.nueva`: Notifica al vendedor.

## Tests esperados (mínimos)
- Integración: Simulación de webhook de Stripe indicando pago exitoso.
- Unitarios: Validación de precios y cálculo de comisiones.

## Riesgos típicos y cómo evitarlos
- **Double Spending / Race Conditions**: Usar transacciones SQL al confirmar el pago y reducir el stock del vendedor.
- **Fraude en pagos**: Validar siempre el origen del webhook mediante firma secreta de Stripe.
