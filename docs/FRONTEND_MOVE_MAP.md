# Frontend Move Map — VERSA

**Fecha:** 2026-01-13  
**Estado:** 📋 Mapa de referencia (sin movimientos ejecutados)

---

## 1. Archivos por Producto

### 🔧 Versa Manager (30 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `manager-admin-accesos.html` | Admin | Manager | Mantener |
| `manager-marketing-email.html` | Marketing | Manager | Mantener |
| `manager-taller-billing.html` | Taller | Manager | Mantener |
| `manager-taller-caja.html` | Taller | Manager | Mantener |
| `manager-taller-chat.html` | Taller | Manager | Mantener |
| `manager-taller-citas.html` | Taller | Manager | Mantener |
| `manager-taller-clientes.html` | Taller | Manager | Mantener |
| `manager-taller-compras.html` | Taller | Manager | Mantener |
| `manager-taller-compras-historial.html` | Taller | Manager | Mantener |
| `manager-taller-config-facturas.html` | Taller | Manager | Mantener |
| `manager-taller-config-ordenes.html` | Taller | Manager | Mantener |
| `manager-taller-configuracion.html` | Taller | Manager | Mantener |
| `manager-taller-cuentas-corrientes.html` | Taller | Manager | Mantener |
| `manager-taller-facturas.html` | Taller | Manager | Mantener |
| `manager-taller-facturas-pendientes.html` | Taller | Manager | Mantener |
| `manager-taller-fidelizacion.html` | Taller | Manager | Mantener |
| `manager-taller-historial-unificado.html` | Taller | Manager | Mantener |
| `manager-taller-inicio.html` | Taller | Manager | Mantener |
| `manager-taller-inventario.html` | Taller | Manager | Mantener |
| `manager-taller-inventario-nuevo.html` | Taller | Manager | Mantener |
| `manager-taller-marketplace.html` | Taller | Manager | Mantener |
| `manager-taller-ordenes.html` | Taller | Manager | Mantener |
| `manager-taller-ordenes-lista.html` | Taller | Manager | Mantener |
| `manager-taller-proveedores.html` | Taller | Manager | Mantener |
| `manager-taller-sucursales.html` | Taller | Manager | Mantener |
| `manager-taller-trabajadores.html` | Taller | Manager | Mantener |
| `manager-taller-vehiculos.html` | Taller | Manager | Mantener |
| `manager-taller-ventas.html` | Taller | Manager | Mantener |
| `manager-taller-ventas-historial.html` | Taller | Manager | Mantener |
| `manager-taller-whatsapp.html` | Taller | Manager | Mantener |

### 💰 FinSaaS (4 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `finsaas-caja.html` | Contable | FinSaaS | Mantener |
| `finsaas-dashboard.html` | Contable | FinSaaS | Mantener |
| `finsaas-facturas.html` | Contable | FinSaaS | Mantener |
| `finsaas-trimestres.html` | Contable | FinSaaS | Mantener |

### 🛒 Marketplace & Portal (7 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `marketplace-busqueda.html` | Marketplace | Público | Mantener |
| `marketplace-taller.html` | Marketplace | Público | Mantener |
| `cliente-dashboard.html` | Portal | Cliente | Mantener |
| `cliente-login.html` | Portal | Cliente | Mantener |
| `cliente-register.html` | Portal | Cliente | Mantener |
| `cliente-reset.html` | Portal | Cliente | Mantener |
| `cita-previa.html` | Portal | Cliente | Mantener |

### 🏠 Landing & Auth (5 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `index.html` | Landing | Común | Mantener |
| `FinSaaS.html` | Landing | FinSaaS | Mantener |
| `login.html` | Auth | Manager | Mantener |
| `login-finsaas.html` | Auth | FinSaaS | Mantener |
| `admin-accesos.html` | Admin | Común | Mantener |

### 📝 Templates (2 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `_head-template.html` | Template | Compartido | Mantener |
| `_sidebar-template.html` | Template | Compartido | Mantener |

### ⚙️ Otros HTML (5 archivos)

| Archivo Actual | Categoría | Producto | Acción |
|---------------|-----------|----------|--------|
| `cancel.html` | Stripe | Común | Mantener |
| `card.html` | Stripe | Común | Mantener |
| `success.html` | Stripe | Común | Mantener |
| `stripe-cancel.html` | Stripe | Común | Mantener |
| `stripe-success.html` | Stripe | Común | Mantener |

---

## 2. JavaScript Compartido

| Archivo | Usado por | Riesgo si se mueve |
|---------|-----------|-------------------|
| `auth.js` | Todos | ALTO |
| `api.js` | Todos | ALTO |
| `main.js` | Manager | ALTO |
| `caja.js` | Manager | MEDIO |
| `inventory.js` | Manager | MEDIO |
| `login.js` | Auth | ALTO |
| `sidebar-manager.js` | Manager | ALTO |
| `head-manager.js` | Manager | ALTO |
| `pagos-logic.js` | Manager | MEDIO |
| `loadSucursales.js` | Manager | MEDIO |
| `admin-accesos.js` | Admin | MEDIO |
| `manager-taller-chat.js` | Manager | BAJO |
| `manager-taller-citas-logic.js` | Manager | BAJO |
| `manager-taller-marketplace.js` | Manager | BAJO |
| `manager-taller-ventas.js` | Manager | BAJO |

---

## 3. Directorios

| Directorio | Contenido | Usado por | Riesgo |
|------------|-----------|-----------|--------|
| `components/` | Web Components | Todos | ALTO |
| `services/` | Servicios JS | Todos | ALTO |
| `styles/` | CSS | Todos | ALTO |
| `assets/` | Imágenes | Todos | ALTO |
| `public/` | Estáticos | Todos | ALTO |
| `dist/` | Build output | N/A | NO MOVER |
| `node_modules/` | Deps | N/A | NO MOVER |

---

## 4. Decisión: NO Mover (Justificación)

### Razones para NO reorganizar ahora:

1. **53 archivos HTML** con referencias cruzadas
2. **Vite bundler** compila múltiples entry points
3. **Backend** sirve estáticos desde `/frontend/dist/`
4. **URLs** pueden estar hardcodeadas en frontend/backend
5. **Sin urgencia funcional** - el prefijo `manager-*` ya separa
6. **Riesgo de regresión** alto sin tests E2E

### Acción Tomada:
- ✅ Documentar estructura actual
- ✅ Definir reglas de nomenclatura
- ✅ NO mover archivos físicamente
- ✅ Separación lógica (Manager vs FinSaaS) ya existe via prefijos

---

## 5. Reorganización Futura (Cuando sea necesario)

### Prerequisitos antes de mover:
1. Tests E2E que validen navegación
2. Build script que valide todos los entry points
3. Redirects configurados (para URLs antiguas)
4. Actualización de todas las referencias en HTML/JS

### Pasos de reorganización:
1. Crear estructura de carpetas (`manager/`, `finsaas/`, etc.)
2. Mover archivos uno por uno
3. Actualizar imports en cada archivo
4. Actualizar `vite.config.js`
5. Probar build completo
6. Probar navegación en staging

---

## 6. Archivos Sin Clasificar

Estos archivos parecen obsoletos o de debug:

| Archivo | Descripción | Recomendación |
|---------|-------------|---------------|
| `build_error.log` | Log de error | Borrar |
| `test_modal_only.js` | Test manual | Mover a `tests/` |
| `roles.js` | Roles legacy | Verificar uso |

---

## 7. Conclusión

**Estado actual:** Estructura plana pero bien organizada via prefijos.  
**Deuda técnica:** Baja (nomenclatura consistente).  
**Prioridad de reorganización:** BAJA (no bloquea desarrollo).
