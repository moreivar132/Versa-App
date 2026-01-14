# Documentación de API (VERSA)

## Acceso a la Documentación

### Swagger UI (Interactivo)
```
http://localhost:3000/api-docs
```
Interfaz visual para explorar y probar endpoints.

### Especificación JSON
```
http://localhost:3000/api-docs.json
```
Útil para integraciones, generadores de clientes, y herramientas como Postman.

---

## Cómo Documentar Endpoints Nuevos

### 1. Ubicación
Añade la documentación JSDoc directamente encima de la definición del endpoint en el archivo de rutas:

```javascript
// src/modules/mi-modulo/api/mi-modulo.routes.js

/**
 * @openapi
 * /api/mi-modulo:
 *   get:
 *     tags: [MiModulo]
 *     summary: Breve descripción
 *     description: Descripción más detallada si es necesario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', controller.list);
```

### 2. Plantilla Completa

```javascript
/**
 * @openapi
 * /api/mi-modulo/{id}:
 *   get:
 *     tags: [MiModulo]
 *     summary: Obtener recurso por ID
 *     description: |
 *       Descripción multilínea.
 *       Puedes usar markdown aquí.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del recurso
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *         description: Incluir detalles adicionales
 *     responses:
 *       200:
 *         description: Recurso encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MiRecurso'
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 */
```

### 3. Para POST/PUT con Body

```javascript
/**
 * @openapi
 * /api/mi-modulo:
 *   post:
 *     tags: [MiModulo]
 *     summary: Crear recurso
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Ejemplo"
 *               descripcion:
 *                 type: string
 *           example:
 *             nombre: "Mi Recurso"
 *             descripcion: "Descripción del recurso"
 *     responses:
 *       201:
 *         description: Creado exitosamente
 */
```

---

## Convenciones

### Tags
Cada módulo tiene su propio tag (definidos en `src/core/docs/swagger.js`):
- `Auth` - Autenticación
- `Ventas` - Ventas directas
- `Ordenes` - Órdenes de trabajo
- `Clientes` - Gestión de clientes
- `Inventario` - Productos y stock
- `Caja` - Movimientos de caja
- `Facturas` - Facturación
- `Marketplace` - Tienda pública

### Schemas Reutilizables
Definidos en `src/core/docs/swagger.js`:
- `Error` - Respuesta de error estándar
- `SuccessResponse` - Respuesta exitosa simple
- `Pagination` - Metadatos de paginación

Para añadir nuevos schemas:
```javascript
// En src/core/docs/swagger.js
components: {
    schemas: {
        MiNuevoSchema: {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' }
            }
        }
    }
}
```

### Security
- Usa `security: [{ bearerAuth: [] }]` para rutas privadas
- Omite `security` para rutas públicas

---

## Reglas del Equipo

1. **Al crear endpoints nuevos**: Documenta al menos `summary`, `tags`, `security` y `responses` principales.

2. **Al modificar endpoints**: Actualiza la documentación si cambian parámetros o responses.

3. **PRs**: La documentación de API debe incluirse en el mismo PR que el código.

4. **No inventar**: Documenta solo lo que realmente existe en el código.

---

## Verificación

Después de añadir documentación:

1. Reinicia el servidor
2. Abre http://localhost:3000/api-docs
3. Verifica que aparece tu endpoint con la documentación correcta
4. Prueba el endpoint desde Swagger UI

---

## Recursos

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)
- [Swagger Editor Online](https://editor.swagger.io/)
