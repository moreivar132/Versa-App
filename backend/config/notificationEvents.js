/**
 * VERSA - Notification Events Registry
 * 
 * Single source of truth for all notification event types.
 * Used by:
 * - unifiedNotificationService (backend)
 * - manager-marketing-email.html (frontend, via API)
 * 
 * To add a new notification type:
 * 1. Add an entry here
 * 2. The system will auto-create templates and automations on first use
 */

const NOTIFICATION_EVENTS = {
    // ==================== CLIENT AUTH ====================
    CLIENT_REGISTERED: {
        name: 'Bienvenida',
        description: 'Se envía cuando un cliente se registra en el portal',
        icon: 'fa-user-plus',
        dashboardIcon: 'person_add',
        subject: '¡Bienvenido a VERSA, {{nombre}}!',
        variables: ['nombre', 'portal_url', 'soporte_email', 'whatsapp'],
        channels: ['email'],
        category: 'auth'
    },
    PASSWORD_RESET_REQUESTED: {
        name: 'Reset de Contraseña',
        description: 'Se envía cuando un cliente solicita recuperar su contraseña',
        icon: 'fa-key',
        dashboardIcon: 'lock_reset',
        subject: 'Recupera tu contraseña, {{nombre}}',
        variables: ['nombre', 'reset_url', 'exp_minutes'],
        channels: ['email'],
        category: 'auth'
    },

    // ==================== CITAS ====================
    CITA_CONFIRMADA: {
        name: 'Cita Confirmada',
        description: 'Se envía cuando el taller confirma una cita',
        icon: 'fa-calendar-check',
        dashboardIcon: 'check_circle',
        subject: '✅ Tu cita ha sido confirmada',
        variables: ['nombre', 'fecha', 'hora', 'sucursal', 'direccion'],
        channels: ['email', 'dashboard'],
        category: 'citas'
    },
    CITA_EN_PROGRESO: {
        name: 'Cita en Progreso',
        description: 'Se envía cuando comienza el trabajo en el vehículo',
        icon: 'fa-wrench',
        dashboardIcon: 'build',
        subject: '🔧 Tu vehículo está en el taller',
        variables: ['nombre', 'fecha', 'sucursal'],
        channels: ['dashboard'],
        category: 'citas'
    },
    CITA_COMPLETADA: {
        name: 'Cita Completada',
        description: 'Se envía cuando se completa el servicio',
        icon: 'fa-check-circle',
        dashboardIcon: 'task_alt',
        subject: '✅ Servicio completado',
        variables: ['nombre', 'fecha', 'sucursal'],
        channels: ['email', 'dashboard'],
        category: 'citas'
    },
    CITA_CANCELADA: {
        name: 'Cita Cancelada',
        description: 'Se envía cuando se cancela una cita',
        icon: 'fa-times-circle',
        dashboardIcon: 'cancel',
        subject: '❌ Cita cancelada',
        variables: ['nombre', 'fecha', 'sucursal', 'motivo'],
        channels: ['email', 'dashboard'],
        category: 'citas'
    },

    // ==================== FIDELIZACIÓN ====================
    LOYALTY_POINTS_EARNED: {
        name: 'Puntos de Fidelización',
        description: 'Se envía cuando un cliente gana puntos',
        icon: 'fa-star',
        dashboardIcon: 'stars',
        subject: '¡Has ganado {{puntos_ganados}} puntos!',
        variables: ['nombre', 'puntos_ganados', 'balance_total', 'motivo', 'portal_url'],
        channels: ['email', 'dashboard'],
        category: 'fidelizacion',
        htmlTemplate: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111318; color: white; padding: 20px; border-radius: 16px;">
                <h2 style="color: #ff5f00;">¡Felicidades, {{nombre}}!</h2>
                <p>Acabas de sumar puntos en tu tarjeta de fidelización.</p>
                <div style="background-color: #1a1d24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #282e39; text-align: center;">
                    <p style="font-size: 32px; font-weight: bold; margin: 0; color: #ff5f00;">+{{puntos_ganados}} Puntos</p>
                    <p style="color: #9da6b9; margin: 5px 0 0 0;">Motivo: {{motivo}}</p>
                </div>
                <p>Tu saldo actual es de: <strong>{{balance_total}} puntos</strong></p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="{{portal_url}}" style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver mi Tarjeta</a>
                </div>
            </div>`
    },
    LOYALTY_PROMO_CREATED: {
        name: 'Nueva Promoción',
        description: 'Se envía a todos los miembros cuando se publica una promoción',
        icon: 'fa-gift',
        dashboardIcon: 'redeem',
        subject: '🎁 Nueva Promoción: {{promo_titulo}}',
        variables: ['nombre', 'promo_titulo', 'promo_descripcion', 'portal_url'],
        channels: ['email', 'dashboard'],
        category: 'fidelizacion',
        htmlTemplate: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111318; color: white; padding: 20px; border-radius: 16px;">
                <h2 style="color: #ff5f00;">¡Hola {{nombre}}! 🎁</h2>
                <p>Tenemos una nueva promoción especial para ti.</p>
                <div style="background-color: #1a1d24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #282e39;">
                    <h3 style="margin: 0; color: #ff5f00;">{{promo_titulo}}</h3>
                    <p style="color: #9da6b9; margin: 10px 0 0 0;">{{promo_descripcion}}</p>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="{{portal_url}}" style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver Promoción</a>
                </div>
            </div>`
    },

    // ==================== PAGOS ====================
    PAYMENT_RECEIVED: {
        name: 'Pago Recibido',
        description: 'Se envía cuando se confirma un pago',
        icon: 'fa-credit-card',
        dashboardIcon: 'payments',
        subject: '💳 Pago recibido correctamente',
        variables: ['nombre', 'monto', 'concepto', 'fecha'],
        channels: ['email', 'dashboard'],
        category: 'pagos'
    },
    PAYMENT_PENDING: {
        name: 'Pago Pendiente',
        description: 'Recordatorio de pago pendiente',
        icon: 'fa-clock',
        dashboardIcon: 'schedule',
        subject: '⏳ Tienes un pago pendiente',
        variables: ['nombre', 'monto', 'concepto', 'link_pago'],
        channels: ['email', 'dashboard'],
        category: 'pagos'
    }
};

/**
 * Get all events for frontend display
 */
function getAllEvents() {
    return Object.entries(NOTIFICATION_EVENTS).map(([code, config]) => ({
        code,
        ...config
    }));
}

/**
 * Get event by code
 */
function getEvent(code) {
    return NOTIFICATION_EVENTS[code] || null;
}

/**
 * Get events by category
 */
function getEventsByCategory(category) {
    return Object.entries(NOTIFICATION_EVENTS)
        .filter(([, config]) => config.category === category)
        .map(([code, config]) => ({ code, ...config }));
}

module.exports = {
    NOTIFICATION_EVENTS,
    getAllEvents,
    getEvent,
    getEventsByCategory
};
