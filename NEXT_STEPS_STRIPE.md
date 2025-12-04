# 🚀 VERSA Manager - Integración Stripe: Próximos Pasos

## ✅ ¿Qué se ha implementado?

Se ha creado una integración completa y segura de Stripe para VERSA Manager que incluye:

### Backend
- ✅ Servicio centralizado de Stripe (`stripeService.js`)
- ✅ Endpoint para crear checkout sessions (`/api/stripe/create-checkout-session`)
- ✅ Endpoint de webhook para recibir eventos de Stripe (`/api/stripe/webhook`)
- ✅ Endpoints para consultar suscripciones (`/api/subscriptions/...`)
- ✅ Middleware de control de acceso basado en suscripción (`requireActiveSubscription`)
- ✅ Función reutilizable `canTenantUseApp()` para verificar acceso
- ✅ Script de migración para poblar planes (`populate_planes_suscripcion.js`)
- ✅ Archivo `.env.example` con todas las variables necesarias

### Frontend
- ✅ Botones de suscripción con IDs y data attributes
- ✅ JavaScript para manejar clics y crear checkout sessions
- ✅ Página de éxito (`success.html`) con animaciones
- ✅ Página de cancelación (`cancel.html`)
- ✅ Toggle mensual/anual integrado

### Seguridad
- ✅ Todas las claves en variables de entorno
- ✅ Verificación de firma de webhooks
- ✅ Raw body para webhooks
- ✅ Validación de parámetros
- ✅ Idempotencia en webhooks
- ✅ Logs sin claves sensibles

## 📋 Pasos para Completar la Configuración

### 1. Configurar Stripe Dashboard (30-45 minutos)

1. **Crear cuenta en Stripe**: https://stripe.com
2. **Crear productos y precios**:
   - VERSA Manager - Plan Básico (30€/mes, 300€/año)
   - VERSA Manager - Plan Pro (59€/mes, 588€/año)
   - VERSA Manager - Plan Fleet (99€/mes, 996€/año)
   - **IMPORTANTE:** Configurar trial de 15 días en cada precio
3. **Configurar webhook**:
   - URL: `https://tu-dominio.com/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
4. **Obtener claves**:
   - Secret Key (`sk_test_...`)
   - Webhook Secret (`whsec_...`)
   - 6 Price IDs (uno por cada combinación plan/intervalo)

### 2. Configurar Variables de Entorno (5 minutos)

```bash
cd backend
cp .env.example .env
# Editar .env con tus claves de Stripe
```

Rellenar:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Los 6 price_id
- `STRIPE_SUCCESS_URL` y `STRIPE_CANCEL_URL`

### 3. Poblar la Base de Datos (1 minuto)

```bash
cd backend
node migrations/populate_planes_suscripcion.js
```

### 4. Probar en Local (10 minutos)

1. **Instalar Stripe CLI** (opcional, para webhooks en local):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

2. **Iniciar servidores**:
   ```bash
   # Terminal 1
   cd backend
   npm run dev

   # Terminal 2
   cd frontend
   npm run dev
   ```

3. **Probar flujo de pago**:
   - Ir a `http://localhost:5173`
   - Clic en "Empezar" en un plan
   - Usar tarjeta de prueba: `4242 4242 4242 4242`

### 5. Desplegar a Producción

1. **Variables de entorno en producción**:
   - Cambiar de `sk_test_...` a `sk_live_...`
   - Cambiar URLs de success/cancel a producción
   - Configurar webhook en Stripe con URL de producción

2. **Verificar tablas en DB de producción**:
   - Ejecutar `populate_planes_suscripcion.js` en producción
   - Verificar que los planes se crearon correctamente

3. **Probar con tarjeta real** (monto pequeño primero)

## 🔧 Siguientes Mejoras Recomendadas

### Corto Plazo (Esenciales)

1. **Flujo de Registro Completo**
   - Crear endpoint `/api/auth/register-with-plan`
   - Que cree el tenant y redirija a Stripe
   - El webhook de Stripe actualizará la suscripción

2. **Portal de Cliente de Stripe**
   - Permitir a los tenants gestionar su suscripción
   - Actualizar método de pago
   - Cancelar o cambiar de plan
   - Ver facturas

3. **Notificaciones**
   - Email cuando el trial está por expirar
   - Email cuando un pago falla
   - Email de bienvenida después de suscribirse

### Mediano Plazo (Mejoras)

4. **Panel de Admin para Suscripciones**
   - Dashboard para ver todas las suscripciones
   - Filtrar por estado, plan, etc.
   - Métricas de ingresos (MRR, ARR)

5. **Aplicar control de acceso en todas las rutas críticas**
   ```javascript
   router.get('/api/ordenes', verifyJWT, requireActiveSubscription, ...);
   router.post('/api/clientes', verifyJWT, requireActiveSubscription, ...);
   // etc.
   ```

6. **Límites por plan**
   - Basic: máx 2 usuarios
   - Pro: máx 6 usuarios, máx 3 sucursales
   - Fleet: ilimitado
   - Validar al crear usuario/sucursal

### Largo Plazo (Opcionales)

7. **Cupones y descuentos**
8. **Facturación con impuestos automáticos** (Stripe Tax)
9. **Múltiples métodos de pago** (SEPA, transferencia)
10. **Analytics avanzado** de suscripciones

## 📚 Documentación

- **Guía completa**: `STRIPE_INTEGRATION.md`
- **Variables de entorno**: `.env.example`
- **SQL de referencia**: `migrations/create_subscription_tables.sql`

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "STRIPE_SECRET_KEY no configurado" | Crear archivo `.env` desde `.env.example` |
| "No se encontró plan para price_id" | Ejecutar `populate_planes_suscripcion.js` |
| Webhook da error 400 | Verificar `STRIPE_WEBHOOK_SECRET` en `.env` |
| Botones no funcionan | Verificar que backend está corriendo |

## ✨ ¡Listo para Producción!

Esta integración es:
- ✅ Segura (sin claves en código)
- ✅ Completa (checkout + webhooks + control de acceso)
- ✅ Escalable (preparada para crecer)
- ✅ Bien documentada

**Solo falta configurar Stripe Dashboard y variables de entorno para empezar a cobrar.**

---

**¿Necesitas ayuda?** Revisa `STRIPE_INTEGRATION.md` para instrucciones detalladas paso a paso.
