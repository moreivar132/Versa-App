# Vertical: Tasks & Leads 🚀
*Gestión de Leads, Tareas y Proyectos con Integración de WhatsApp (TimelinesAI)*

Esta vertical está diseñada para centralizar la comunicación de WhatsApp y convertirla en oportunidades de negocio (Leads) y seguimiento de tareas.

## 📌 Estado Actual de la Implementación

### 1. Dashboard Principal
- [x] **Métricas en tiempo real:** Resumen de Proyectos Activos, Tareas Pendientes, Tareas Atrasadas y Leads Abiertos.
- [x] **Acciones Rápidas:** Enlaces directos a creación de proyectos, tareas, leads e historial de chats.
- [x] **Visualización de Leads Recientes:** Lista rápida de los últimos contactos registrados.
- [x] **Gráficos de Estado:** Desglose visual de tareas y leads por su situación actual.
- [x] **Layout Fluido:** Corrección de scroll y diseño responsivo (Tailwind CSS).

### 2. Gestión de Leads (CRM)
- [x] **CRUD Completo:** Listado, creación, edición y cierre de leads.
- [x] **Filtros Avanzados:** Filtrado por estado (Nuevo, Abierto, Ganado, Perdido).
- [x] **Visualización Premium:** Tarjetas informativas con estados coloreados y tipografía moderna.

### 3. Integración con TimelinesAI (WhatsApp)
- [x] **Sincronización Inteligente:** Botón para importar chats no leídos desde WhatsApp y convertirlos automáticamente en Leads en VERSA.
- [x] **Detección de Grupos:** Lógica para omitir grupos de WhatsApp y enfocarse en chats individuales.
- [x] **Sección de Chats Pendientes:**
    - Visualización de mensajes sin responder.
    - **Métricas de Urgencia:** Cálculo de tiempo transcurrido desde el último mensaje con códigos de color (Verde/Amarillo/Rojo).
    - **Análisis por Etiquetas:** Cálculo de tiempo promedio de respuesta por cada etiqueta de TimelinesAI.
    - **Filtro por Etiquetas:** Capacidad de ver chats pendientes filtrados por su categoría (ej: "Bicicleta", "CONTRATADO", etc).

### 4. Historial de Chats (Inbox)
- [x] **Vista Completa (Inbox):** Interfaz de dos columnas inspirada en aplicaciones de mensajería.
- [x] **Historial de Mensajes:** Visualización de burbujas de chat (Enviados vs Recibidos).
- [x] **Buscador de Conversaciones:** Filtro por nombre o teléfono en toda la base de datos de TimelinesAI.
- [x] **Robustez de Datos:** Manejo de errores para contactos sin teléfono o datos incompletos.

### 5. Sistema de Notificaciones (UI/UX)
- [x] **Toast Notifications:** Reemplazo de los `alert()` nativos por notificaciones elegantes, animadas y auto-descartables en la esquina de la pantalla.

## 🛠️ Stack Tecnológico
- **Frontend:** Vanilla HTML5, JavaScript (ES6+), Tailwind CSS.
- **Backend:** Node.js, Express.
- **Base de Datos:** PostgreSQL (vía Knex).
- **Integraciones:** TimelinesAI REST API.

---

## 📅 Próximos Pasos (Roadmap)
1. **Webhooks de TimelinesAI:** Implementar recepción de mensajes en tiempo real para eliminar la necesidad de sincronización manual.
2. **Respuesta desde VERSA:** Permitir enviar mensajes de WhatsApp directamente desde la interfaz de chats de VERSA.
3. **Módulo de Tareas:** Finalizar la interfaz de Kanban para la gestión de tareas de los proyectos.
4. **Plantillas de Mensajes:** Añadir botones de respuesta rápida para leads nuevos.
