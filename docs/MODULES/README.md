# Mapa de Módulos de Versa V2

## ¿Qué es un Módulo?
Un módulo es una unidad lógica que agrupa funcionalidades relacionadas con un área de negocio específica. Cada módulo reside en su propio directorio dentro de `backend/modules/` (o estructura similar) y expone una API interna clara.

## Reglas de Oro de los Módulos

### 1. Prohibido el Acceso Directo a Datos
Un módulo **NUNCA** realiza queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) a tablas que no son de su propiedad.
- Si el módulo `Marketplace` necesita información de un `Taller`, debe llamar al `TallerService` o consumir un evento.

### 2. Reglas de Dependencias
- Las dependencias deben ser acíclicas. Si A depende de B, B no puede depender de A.
- Se prefiere la comunicación asíncrona (Eventos/Webhooks) para desacoplar módulos.

### 3. Encapsulamiento
- Cada módulo expone un `index.js` que actúa como fachada (Public API), ocultando los detalles internos de controllers y repositorios.

## Estructura por Módulo
```text
módulo-nombre/
├── controllers/    # Manejo de peticiones HTTP
├── services/       # Lógica de negocio (orquestación)
├── repositories/   # Consultas a DB (SQL)
├── routes.js       # Definición de endpoints
└── index.js        # Exportación de la API pública del módulo
```

## Lista de Módulos Identificados
- [Taller](./taller.md) (Core)
- [Marketplace](./marketplace.md)
- [Contable](./contable.md) (Caja, Facturación, Ventas)
- [Suscripciones] (Billing y Planes)
- [Admin] (Usuarios, Roles y Permisos)
