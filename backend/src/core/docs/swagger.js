/**
 * Swagger/OpenAPI Configuration
 * 
 * Configuración central de documentación de API.
 * Se usa swagger-jsdoc para lectura de JSDoc en routes.
 * 
 * @see docs/API.md para guía de uso
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'VERSA API',
            version: '1.0.0',
            description: `
API Backend para VERSA - Sistema de Gestión para Talleres Automotrices.

## Autenticación
Todas las rutas privadas requieren un token JWT en el header \`Authorization\`:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Multi-tenancy
El sistema es multi-tenant. El \`tenantId\` se extrae automáticamente del token JWT.
No es necesario enviarlo manualmente en cada request.

## Errores Estándar
| Código | Significado |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token faltante o inválido |
| 403 | Forbidden - Sin permisos para la acción |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error |

Cada error incluye un \`requestId\` para trazabilidad.
            `,
            contact: {
                name: 'Equipo VERSA',
                email: 'soporte@versa.app'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desarrollo'
            },
            {
                url: 'https://versa-app.up.railway.app',
                description: 'Servidor de Producción (Railway)'
            }
        ],
        tags: [
            { name: 'Auth', description: 'Autenticación y registro' },
            { name: 'Ventas', description: 'Gestión de ventas directas (TPV)' },
            { name: 'Ordenes', description: 'Órdenes de trabajo del taller' },
            { name: 'Clientes', description: 'Gestión de clientes' },
            { name: 'Inventario', description: 'Productos y stock' },
            { name: 'Caja', description: 'Movimientos de caja' },
            { name: 'Facturas', description: 'Facturación' },
            { name: 'Marketplace', description: 'Tienda pública de repuestos' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT obtenido en /api/auth/login'
                }
            },
            schemas: {
                // === Schemas reutilizables ===
                Error: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Mensaje de error' },
                        code: { type: 'string', example: 'VALIDATION_ERROR' },
                        requestId: { type: 'string', example: 'abc-123-def' }
                    }
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean', example: true }
                    }
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer', example: 100 },
                        limit: { type: 'integer', example: 50 },
                        offset: { type: 'integer', example: 0 }
                    }
                },
                // === Schemas del módulo Ventas ===
                Venta: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 15 },
                        fecha: { type: 'string', format: 'date-time' },
                        total_bruto: { type: 'string', example: '100.00' },
                        total_iva: { type: 'string', example: '21.00' },
                        total_neto: { type: 'string', example: '121.00' },
                        estado: { type: 'string', enum: ['COMPLETADA', 'ANULADA'], example: 'COMPLETADA' },
                        observaciones: { type: 'string' },
                        cliente_nombre: { type: 'string', example: 'Juan Pérez' },
                        sucursal_nombre: { type: 'string', example: 'Sucursal Centro' }
                    }
                },
                VentaInput: {
                    type: 'object',
                    required: ['idSucursal', 'idCliente', 'lineas'],
                    properties: {
                        idSucursal: { type: 'integer', example: 1 },
                        idCliente: { type: 'integer', example: 1 },
                        idCaja: { type: 'integer', nullable: true },
                        observaciones: { type: 'string' },
                        lineas: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/VentaLineaInput' }
                        },
                        pagos: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/VentaPagoInput' }
                        }
                    }
                },
                VentaLineaInput: {
                    type: 'object',
                    required: ['descripcion', 'cantidad', 'precio'],
                    properties: {
                        idProducto: { type: 'integer', nullable: true },
                        descripcion: { type: 'string', example: 'Aceite 5W40' },
                        cantidad: { type: 'number', example: 2 },
                        precio: { type: 'number', example: 25.00 },
                        descuento: { type: 'number', example: 0, description: 'Porcentaje de descuento' },
                        iva: { type: 'number', example: 21, description: 'Porcentaje de IVA' }
                    }
                },
                VentaPagoInput: {
                    type: 'object',
                    required: ['importe'],
                    properties: {
                        idMedioPago: { type: 'integer' },
                        codigoMedioPago: { type: 'string', enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] },
                        importe: { type: 'number', example: 60.50 },
                        referencia: { type: 'string' }
                    }
                },
                VentaCreateResponse: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean', example: true },
                        id: { type: 'integer', example: 16 },
                        total_bruto: { type: 'number', example: 50.00 },
                        total_iva: { type: 'number', example: 10.50 },
                        total_neto: { type: 'number', example: 60.50 },
                        lineas: { type: 'integer', example: 2 },
                        pagos: { type: 'integer', example: 1 }
                    }
                },
                VentasListResponse: {
                    type: 'object',
                    properties: {
                        ventas: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Venta' }
                        },
                        total: { type: 'integer', example: 100 },
                        limit: { type: 'integer', example: 50 },
                        offset: { type: 'integer', example: 0 }
                    }
                }
            }
        }
    },
    apis: [
        './src/modules/**/api/*.routes.js',  // Rutas de módulos migrados
        './routes/*.js'                       // Rutas legacy (si se documentan)
    ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
