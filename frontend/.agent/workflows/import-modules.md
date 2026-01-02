---
description: Cómo importar módulos JavaScript en archivos HTML (evitar errores de Vite)
---

# Importación de Módulos en HTML

## ⚠️ REGLA IMPORTANTE

Al usar `import` dentro de `<script type="module">` en archivos HTML, **SIEMPRE usar rutas absolutas** (comenzando con `/`).

## ❌ MAL (causará errores en Vite)

```javascript
<script type="module">
    import { fetchWithAuth } from './auth.js';
    import { initSucursalSelector } from './services/sucursal-selector.js';
</script>
```

## ✅ BIEN (funciona correctamente)

```javascript
<script type="module">
    import { fetchWithAuth } from '/auth.js';
    import { initSucursalSelector } from '/services/sucursal-selector.js';
</script>
```

## Explicación

Vite maneja los archivos HTML de manera especial, creando "proxies" virtuales para el hot-reload. Cuando se usan rutas relativas (`./`), Vite no puede resolver correctamente la ubicación de los módulos porque el contexto de la ruta cambia.

Las rutas absolutas (`/`) siempre se resuelven desde la raíz del proyecto frontend, lo cual funciona tanto en desarrollo como en producción.

## Archivos de Servicios Disponibles

Estos son los principales módulos que puedes importar:

| Módulo | Ruta de Importación |
|--------|---------------------|
| Auth | `/auth.js` |
| Sucursal Selector | `/services/sucursal-selector.js` |
| Ordenes Service | `/services/ordenes-service.js` |
| Clientes Service | `/services/clientes-service.js` |
| Vehiculos Service | `/services/vehiculos-service.js` |
| Tecnicos Service | `/services/tecnicos-service.js` |
| Inventory Service | `/services/inventory-service.js` |
| Pagos Service | `/services/pagos-service.js` |
| Impuestos Service | `/services/impuestos-service.js` |
| API Client | `/services/api-client.js` |
| Load Sucursales | `/loadSucursales.js` |
| Chat Widget | `/components/ChatWidget.js` |

## Creando un Nuevo Archivo HTML

Al crear un nuevo archivo HTML que use módulos:

1. Agregar el archivo al `vite.config.js` en `rollupOptions.input`
2. Usar rutas absolutas para todas las importaciones de módulos
3. Probar con `npm run dev` para verificar que no hay errores de resolución
