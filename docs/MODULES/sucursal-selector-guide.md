# Guía de Integración: Selector de Sucursal

## Descripción
Componente reutilizable para mostrar y cambiar la sucursal actual en todas las páginas del panel de gestión.

## Archivos del componente
| Archivo | Descripción |
|---------|-------------|
| `frontend/services/sucursal-selector.js` | Lógica del componente |
| `frontend/styles/sucursal-selector.css` | Estilos CSS estandarizados |
| `frontend/docs/sucursal-selector-guide.md` | Esta guía |

## Cómo integrar en una página

### Paso 1: Verificar CSS en el `<head>`
Asegúrate de que el archivo CSS esté incluido:

```html
<link rel="stylesheet" href="styles/sucursal-selector.css">
```

### Paso 2: Agregar el contenedor HTML
En el `<main>`, agrega el contenedor centrado arriba del contenido principal:

```html
<main class="flex-1 overflow-y-auto p-6 relative z-10">
  <!-- Selector de Sucursal Centrado -->
  <div class="sucursal-selector-wrapper">
    <div id="sucursal-selector-container"></div>
  </div>

  <!-- Resto del contenido -->
</main>
```

### Paso 3: Importar e inicializar en el script module
En el bloque `<script type="module">`:

```javascript
import { initSucursalSelector, getCurrentSucursalId, onSucursalChange } from '/services/sucursal-selector.js';

(async () => {
    // Inicializar el selector de sucursal
    const sucursalId = await initSucursalSelector('sucursal-selector-container', {
        onchange: async (nuevaSucursalId) => {
            console.log('Sucursal cambiada a:', nuevaSucursalId);
            // Recargar los datos de la página con la nueva sucursal
            await cargarDatos();
        }
    });

    // Cargar datos iniciales
    await cargarDatos();

    async function cargarDatos() {
        const sucursalActual = getCurrentSucursalId();
        // Usar sucursalActual en las llamadas API
        const response = await fetch(`/api/datos?sucursal=${sucursalActual}`);
        // ...
    }
})();
```

### Paso 4: (Opcional) Escuchar cambios de sucursal globalmente
Si necesitas reaccionar a cambios desde cualquier parte del código:

```javascript
import { onSucursalChange } from '/services/sucursal-selector.js';

onSucursalChange((nuevaSucursalId) => {
    console.log('La sucursal cambió a:', nuevaSucursalId);
});
```

---

## API del Componente

### `initSucursalSelector(containerId, options)`
Inicializa el selector en el contenedor especificado.

**Parámetros:**
- `containerId` (string): ID del elemento contenedor
- `options` (object): Opciones de configuración
  - `onchange` (function): Callback cuando cambia la sucursal

**Retorna:** `Promise<number|null>` - ID de la sucursal actual

### `getCurrentSucursalId()`
Obtiene el ID de la sucursal actual.

**Retorna:** `number|null`

### `getCurrentSucursal()`
Obtiene el objeto completo de la sucursal actual.

**Retorna:** `object|null` - `{ id, nombre, tenant_nombre, ... }`

### `getSucursales()`
Obtiene todas las sucursales disponibles.

**Retorna:** `array`

### `onSucursalChange(callback)`
Suscribe una función al evento de cambio de sucursal.

### `setSucursal(sucursalId)`
Cambia la sucursal actual programáticamente.

### `SUCURSAL_STORAGE_KEY`
Constante exportada: `'versa_selected_sucursal'`

---

## Estado de integración

### ✅ Páginas CON selector (12)
- [x] manager-taller-chat.html
- [x] manager-taller-clientes.html
- [x] manager-taller-compras-historial.html
- [x] manager-taller-compras.html
- [x] manager-taller-config-facturas.html
- [x] manager-taller-facturas-pendientes.html
- [x] manager-taller-inventario-nuevo.html
- [x] manager-taller-inventario.html
- [x] manager-taller-ordenes-lista.html
- [x] manager-taller-ordenes.html
- [x] manager-taller-proveedores.html
- [x] manager-taller-vehiculos.html

### ❌ Páginas SIN selector (14) - PENDIENTES
- [ ] manager-taller-caja.html
- [ ] manager-taller-citas.html
- [ ] manager-taller-config-ordenes.html
- [ ] manager-taller-configuracion.html
- [ ] manager-taller-cuentas-corrientes.html
- [ ] manager-taller-facturas.html
- [ ] manager-taller-fidelizacion.html
- [ ] manager-taller-historial-unificado.html
- [ ] manager-taller-inicio.html
- [ ] manager-taller-marketplace.html
- [ ] manager-taller-trabajadores.html
- [ ] manager-taller-ventas-historial.html
- [ ] manager-taller-ventas.html
- [ ] manager-taller-whatsapp.html

---

## Evento Global

El componente dispara un evento global cuando cambia la sucursal:

```javascript
window.addEventListener('sucursalChanged', (e) => {
    const nuevaSucursalId = e.detail.sucursalId;
    // Hacer algo...
});
```

## Persistencia

La sucursal seleccionada se guarda en `localStorage` con la clave:
```
versa_selected_sucursal
```

Esto permite que la sucursal se mantenga al navegar entre páginas.
