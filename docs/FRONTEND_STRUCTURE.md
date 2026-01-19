# Estructura del Frontend — VERSA

**Fecha:** 2026-01-13  
**Estado:** 📋 Documentación (sin reorganización física aún)

---

## 1. Productos y Líneas de Negocio

El repositorio VERSA contiene frontends para **DOS productos distintos**:

### 🔧 Versa Manager (Gestión de Talleres)
- **Audiencia:** Talleres mecánicos
- **Prefijo archivos:** `manager-*`
- **Características:** Órdenes, inventario, citas, facturación taller, CRM

### 💰 FinSaaS (Contabilidad SaaS)
- **Audiencia:** Autónomos y PYMEs
- **Prefijo archivos:** `finsaas-*`
- **Características:** Facturación contable, IVA, gastos, open banking

### 🛒 Marketplace Público
- **Audiencia:** Clientes finales
- **Prefijo archivos:** `marketplace-*`, `cliente-*`, `cita-previa`
- **Características:** Buscar talleres, reservar citas, portal cliente

---

## 2. Estructura Actual (Plana)

```
frontend/
├── FinSaaS.html                    # Landing FinSaaS
├── index.html                      # Landing principal/login
├── login.html                      # Login Manager
├── login-finsaas.html              # Login FinSaaS
│
├── manager-*.html (x30)            # 🔧 Versa Manager
│   ├── manager-admin-accesos.html
│   ├── manager-marketing-email.html
│   ├── manager-taller-*.html       # Módulos del taller
│   └── ...
│
├── finsaas-*.html (x4)             # 💰 FinSaaS
│   ├── finsaas-caja.html
│   ├── finsaas-dashboard.html
│   ├── finsaas-facturas.html
│   └── finsaas-trimestres.html
│
├── marketplace-*.html              # 🛒 Marketplace público
├── cliente-*.html                  # Portal cliente
├── cita-previa.html                # Reserva de citas
│
├── components/                     # Componentes compartidos
├── services/                       # Servicios JS compartidos
├── styles/                         # CSS
├── assets/                         # Imágenes
└── public/                         # Archivos estáticos
```

---

## 3. Regla de Separación

> **Los productos Manager y FinSaaS NO deben mezclarse en funcionalidad.**

| Módulo | Manager | FinSaaS | Notas |
|--------|---------|---------|-------|
| Órdenes de trabajo | ✅ | ❌ | Solo talleres |
| Inventario | ✅ | ❌ | Solo talleres |
| Facturación contable | ❌ | ✅ | IVA, gastos |
| Caja taller | ✅ | ❌ | manager-taller-caja |
| Caja contable | ❌ | ✅ | finsaas-caja |
| Clientes CRM | ✅ | ⚠️ | manager-taller-clientes |
| Contactos fiscales | ❌ | ✅ | En FinSaaS |

---

## 4. Nomenclatura de Archivos

### Convención de prefijos
- `manager-taller-*.html` → Módulo de taller (Manager)
- `manager-admin-*.html` → Administración (Manager)
- `manager-marketing-*.html` → Marketing (Manager)
- `finsaas-*.html` → Contabilidad SaaS
- `marketplace-*.html` → Marketplace público
- `cliente-*.html` → Portal del cliente final

### Archivos compartidos
- `_head-template.html` → Header HTML compartido
- `_sidebar-template.html` → Sidebar compartido
- `*.js` en raíz → Lógica compartida (auth, api, main)

---

## 5. Componentes Reutilizables

### Directorio `/components/`
```
components/
├── modal/                # Modales reutilizables
├── forms/                # Formularios
├── tables/               # Tablas dinámicas
├── alerts/               # Notificaciones
└── navigation/           # Navegación
```

### Directorio `/services/`
```
services/
├── api.service.js        # Llamadas HTTP
├── auth.service.js       # Autenticación
├── storage.service.js    # LocalStorage
├── pdf.service.js        # Generación PDFs
└── ...
```

---

## 6. Rutas Críticas (No Modificar)

Estas rutas son referenciadas por el backend o URLs públicas:

| Ruta | Descripción | Crítico |
|------|-------------|---------|
| `/` o `/index.html` | Landing principal | ⚠️ SEO |
| `/login.html` | Login Manager | ⚠️ Redirect backend |
| `/login-finsaas.html` | Login FinSaaS | ⚠️ Redirect backend |
| `/cliente-login.html` | Login portal cliente | ⚠️ Redirect backend |
| `/public/` | Assets estáticos | ⚠️ URLs absolutas |
| `/uploads/` | Archivos subidos | ⚠️ Backend serve |

---

## 7. Vite Configuration

El archivo `vite.config.js` define:
- **Root:** `frontend/`
- **Build output:** `frontend/dist/`
- **Proxy:** Todas las `/api/*` van al backend

```javascript
// vite.config.js
export default {
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Múltiples entry points
        main: 'index.html',
        login: 'login.html',
        // ... etc
      }
    }
  }
}
```

---

## 8. Recomendaciones de Reorganización (Futura)

### Estructura Objetivo (NO implementada aún)

```
frontend/
├── shared/
│   ├── components/
│   ├── services/
│   ├── styles/
│   └── utils/
├── manager/
│   ├── taller/
│   │   ├── ordenes.html
│   │   ├── caja.html
│   │   └── ...
│   ├── admin/
│   └── marketing/
├── finsaas/
│   ├── dashboard.html
│   ├── facturas.html
│   └── ...
├── marketplace/
│   ├── busqueda.html
│   └── taller.html
├── cliente/
│   ├── login.html
│   ├── dashboard.html
│   └── ...
└── landing/
    ├── index.html
    └── FinSaaS.html
```

### Riesgos de Reorganización
1. **Romper URLs existentes** → Requiere redirects
2. **Romper imports de JS/CSS** → Actualizar todas las referencias
3. **Build de Vite** → Actualizar `rollupOptions.input`
4. **Backend static serve** → Actualizar rutas en `index.js`

---

## 9. Decisión Actual

**Por ahora, NO se reorganiza físicamente el frontend.**

Razones:
1. Alto riesgo de romper navegación
2. El prefijo `manager-*` ya separa claramente los productos
3. No hay urgencia funcional

**Acción inmediata:** Documentar la estructura y reglas para nuevos archivos.

---

## 10. Reglas para Nuevos Archivos

1. **Manager:** Siempre usar prefijo `manager-taller-*.html` o `manager-admin-*.html`
2. **FinSaaS:** Siempre usar prefijo `finsaas-*.html`
3. **Marketplace:** Usar `marketplace-*.html`
4. **Compartido:** Añadir en `components/` o `services/`
5. **NO mezclar lógica contable en archivos Manager**
