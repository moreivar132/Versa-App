# Integración de Stripe con Suscripciones - VERSA Manager

## 📋 Descripción General

Esta integración permite a VERSA Manager gestionar suscripciones de pago a través de Stripe de forma segura. Los tenants (talleres/empresas) pueden suscribirse a diferentes planes (BASIC, PRO, FLEET) con facturación mensual o anual.

## 🔑 Características Principales

- ✅ **Suscripciones seguras** vía Stripe Checkout
- ✅ **Webhooks** para sincronización automática de estados
- ✅ **Prueba gratuita** de 15 días (configurada en Stripe)
- ✅ **Control de acceso** basado en suscripción activa
- ✅ **Variables de entorno** para todas las claves (sin hardcoding)
- ✅ **Idempotencia** en webhooks (no duplica registros)
- ✅ **Facturación mensual y anual** con descuentos
- ✅ **Páginas de éxito/cancelación** personalizadas

## 📁 Archivos Creados/Modificados

### Backend

#### Nuevos archivos:
- `backend/services/stripeService.js` - Servicio centralizado de Stripe
- `backend/routes/stripe.js` - Ruta para crear checkout sessions
- `backend/routes/stripeWebhook.js` - Ruta para webhooks de Stripe
- `backend/routes/subscriptions.js` - Rutas para consultar suscripciones
- `backend/middleware/subscriptionCheck.js` - Middleware de control de acceso
- `backend/migrations/populate_planes_suscripcion.js` - Script para poblar planes
- `backend/.env.example` - Ejemplo de variables de entorno

#### Archivos modificados:
- `backend/index.js` - Integración de rutas de Stripe
- `backend/package.json` - Dependencia de Stripe añadida

### Frontend

#### Nuevos archivos:
- `frontend/success.html` - Página de éxito después del pago
- `frontend/cancel.html` - Página de cancelación de pago

#### Archivos modificados:
- `frontend/index.html` - JavaScript para manejar clics en botones de suscripción

## 🚀 Configuración Paso a Paso

### 1. Instalar Dependencias

```bash
cd backend
npm install stripe
```

### 2. Configurar Stripe Dashboard

#### 2.1. Crear una cuenta en Stripe
1. Ir a https://stripe.com y crear una cuenta
2. Activar tu cuenta (puede requerir verificación)

#### 2.2. Crear Productos y Precios

1. Ir a **Products** en el dashboard de Stripe
2. Crear 3 productos:

**Producto 1: VERSA Manager - Plan Básico**
- Nombre: `VERSA Manager - Plan Básico`
- Descripción: `Ideal para talleres pequeños y autónomos`
- Crear dos precios:
  - Precio mensual: 30€/mes (configurar trial de 15 días)
  - Precio anual: 300€/año (25€/mes) (configurar trial de 15 días)
- Guardar los `price_id` (empiezan con `price_...`)

**Producto 2: VERSA Manager - Plan Pro**
- Nombre: `VERSA Manager - Plan Pro`
- Descripción: `Perfecto para talleres en crecimiento`
- Crear dos precios:
  - Precio mensual: 59€/mes (configurar trial de 15 días)
  - Precio anual: 588€/año (49€/mes) (configurar trial de 15 días)
- Guardar los `price_id`

**Producto 3: VERSA Manager - Plan Fleet**
- Nombre: `VERSA Manager - Plan Flotas & Renting`
- Descripción: `Gestión de flotas y empresas de renting`
- Crear dos precios:
  - Precio mensual: 99€/mes (configurar trial de 15 días)
  - Precio anual: 996€/año (83€/mes) (configurar trial de 15 días)
- Guardar los `price_id`

#### 2.3. Configurar Webhook

1. Ir a **Developers** > **Webhooks**
2. Clic en **Add endpoint**
3. URL del endpoint: `https://tu-dominio.com/api/stripe/webhook`
   - En desarrollo local, usa ngrok: `https://xxx.ngrok.io/api/stripe/webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Guardar el **Signing secret** (empieza con `whsec_...`)

#### 2.4. Obtener Claves API

1. Ir a **Developers** > **API keys**
2. Copiar:
   - **Secret key** (empieza con `sk_test_...` o `sk_live_...`)
   - **Publishable key** (opcional, no se usa en backend)

### 3. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

```bash
cd backend
cp .env.example .env
```

Edita el archivo `.env` y rellena todas las variables:

```env
# --- Stripe ---
STRIPE_SECRET_KEY=sk_test_TU_CLAVE_SECRETA_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET_AQUI

# Price IDs de Stripe
STRIPE_PRICE_BASIC_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_BASIC_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_FLEET_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_FLEET_YEARLY=price_xxxxxxxxxxxxx

# URLs de redirección
STRIPE_SUCCESS_URL=http://localhost:5173/success.html
STRIPE_CANCEL_URL=http://localhost:5173/cancel.html
```

**IMPORTANTE:** En producción, usa las URLs de producción:
```env
STRIPE_SUCCESS_URL=https://tu-dominio.com/success.html
STRIPE_CANCEL_URL=https://tu-dominio.com/cancel.html
```

### 4. Poblar la Base de Datos

Ejecuta el script de migración para crear los planes en la tabla `plan_suscripcion`:

```bash
cd backend
node migrations/populate_planes_suscripcion.js
```

Esto creará los 3 planes (BASIC, PRO, FLEET) en la base de datos con los price_id configurados en el `.env`.

### 5. Verificar la Integración

#### 5.1. Iniciar el servidor backend

```bash
cd backend
npm run dev
```

#### 5.2. Iniciar el servidor frontend

```bash
cd frontend
npm run dev
```

#### 5.3. Probar el flujo de pago

1. Ir a `http://localhost:5173` (o tu puerto del frontend)
2. Scroll hasta la sección de precios
3. Hacer clic en cualquier botón de suscripción
4. Ingresar un email de prueba
5. Deberías ser redirigido a Stripe Checkout

#### 5.4. Tarjetas de prueba

Stripe proporciona tarjetas de prueba para desarrollo:

| Tarjeta | Resultado |
|---------|-----------|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 9995` | Pago rechazado (fondos insuficientes) |
| `4000 0027 6000 3184` | Requiere autenticación 3D Secure |

- Fecha de expiración: Cualquier fecha futura
- CVC: Cualquier 3 dígitos
- ZIP: Cualquier 5 dígitos

## 🔧 Uso de los Endpoints

### POST /api/stripe/create-checkout-session

Crea una sesión de checkout de Stripe.

**Request Body:**
```json
{
  "tenantId": 1,
  "plan": "basic",
  "billingInterval": "monthly",
  "email": "cliente@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

### POST /api/stripe/webhook

Endpoint para recibir webhooks de Stripe. **No llamar manualmente**.

### GET /api/subscriptions/status

Obtiene el estado de suscripción del tenant autenticado.

**Requiere:** Token JWT en header `Authorization: Bearer TOKEN`

**Response:**
```json
{
  "ok": true,
  "hasAccess": true,
  "reason": "subscription_active",
  "subscription": {
    "id": 1,
    "tenant_id": 1,
    "plan_id": 2,
    "status": "active",
    "trial_end_at": null,
    "current_period_end": "2025-01-04T22:00:00.000Z",
    ...
  }
}
```

### GET /api/subscriptions/plans

Obtiene los planes disponibles.

**Response:**
```json
{
  "ok": true,
  "plans": [
    {
      "id": 1,
      "nombre": "BASIC",
      "descripcion": "Ideal para talleres pequeños...",
      "trial_dias_default": 15,
      "activo": true
    },
    ...
  ]
}
```

### GET /api/subscriptions/my-subscription

Obtiene la suscripción actual del tenant.

**Requiere:** Token JWT

**Response:**
```json
{
  "ok": true,
  "subscription": {
    "id": 1,
    "tenant_id": 1,
    "plan_nombre": "PRO",
    "plan_descripcion": "Perfecto para talleres...",
    "status": "active",
    ...
  }
}
```

## 🛡️ Middleware de Control de Acceso

### Uso en rutas protegidas

Para proteger rutas que solo deben ser accesibles con suscripción activa:

```javascript
const { requireActiveSubscription } = require('./middleware/subscriptionCheck');

router.get('/api/protected-route', verifyJWT, requireActiveSubscription, async (req, res) => {
  // Esta ruta solo es accesible si el tenant tiene suscripción activa
  res.json({ message: 'Acceso concedido' });
});
```

### Función reutilizable

También puedes usar la función `canTenantUseApp()` en cualquier parte del código:

```javascript
const { canTenantUseApp } = require('./middleware/subscriptionCheck');

const accessCheck = await canTenantUseApp(tenantId);

if (!accessCheck.hasAccess) {
  return res.status(402).json({
    error: accessCheck.reason
  });
}
```

## 📊 Estados de Suscripción

| Estado | Descripción | Tiene Acceso |
|--------|-------------|--------------|
| `trialing` | En período de prueba | ✅ Sí (si no ha expirado) |
| `active` | Suscripción activa y pagada | ✅ Sí |
| `past_due` | Pago fallido, en período de gracia | ❌ No |
| `canceled` | Suscripción cancelada | ❌ No |
| `incomplete` | Pago inicial no completado | ❌ No |
| `incomplete_expired` | Pago inicial expiró | ❌ No |
| `unpaid` | Facturas sin pagar | ❌ No |

## 🔒 Seguridad

### ✅ Buenas prácticas implementadas:

1. **Variables de entorno:** Todas las claves están en `.env`, nunca en el código
2. **Verificación de webhooks:** Los webhooks verifican la firma de Stripe
3. **Raw body para webhooks:** El endpoint del webhook usa `express.raw()` para verificar la firma
4. **Logs sin claves:** Los logs nunca muestran claves completas
5. **Validación de parámetros:** Todos los endpoints validan input
6. **Idempotencia:** Los webhooks no duplican registros (`ON CONFLICT`)

### ⚠️ IMPORTANTE:

- **NUNCA** commitear el archivo `.env` a GitHub
- El archivo `.env` debe estar en `.gitignore`
- Usar claves de test (`sk_test_...`) en desarrollo
- Usar claves de producción (`sk_live_...`) solo en producción
- Rotar las claves periódicamente

## 🧪 Testing

### Probar webhooks en local con Stripe CLI

1. Instalar Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login:
```bash
stripe login
```

3. Reenviar webhooks a tu local:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. En otra terminal, crear un evento de prueba:
```bash
stripe trigger checkout.session.completed
```

## 🐛 Troubleshooting

### Error: "STRIPE_SECRET_KEY no está configurado"

**Solución:** Asegúrate de que el archivo `.env` existe y contiene `STRIPE_SECRET_KEY=sk_test_...`

### Error: "No se encontró plan para price_id"

**Solución:**
1. Verificar que los price_id en `.env` son correctos
2. Ejecutar de nuevo: `node migrations/populate_planes_suscripcion.js`
3. Verificar en la base de datos que los planes tienen los price_id correctos

### Error 400 en webhook

**Solución:**
1. Verificar que `STRIPE_WEBHOOK_SECRET` está configurado correctamente
2. En desarrollo local, usar Stripe CLI para reenviar webhooks
3. Verificar que el endpoint del webhook está ANTES de `express.json()` en `index.js`

### Los botones de suscripción no hacen nada

**Solución:**
1. Abrir la consola del navegador para ver errores
2. Verificar que el backend está corriendo
3. Verificar que `API_BASE_URL` en `index.html` apunta al backend correcto

## 📞 Soporte

Para problemas o preguntas sobre la integración:
- Documentación de Stripe: https://stripe.com/docs
- Webhooks: https://stripe.com/docs/webhooks
- Subscriptions API: https://stripe.com/docs/billing/subscriptions/overview

## 📝 Notas Finales

- Esta integración está lista para producción
- Recuerda cambiar a claves de producción cuando despliegues
- Configura el webhook en producción con la URL correcta
- Los trials de 15 días se configuran en los precios de Stripe
- La tabla `tenant_suscripcion` se sincroniza automáticamente con Stripe vía webhooks
