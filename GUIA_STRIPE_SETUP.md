# 🚀 GUÍA RÁPIDA: Configurar Productos en Stripe (10 minutos)

## 📋 **Paso 1: Acceder a Stripe Dashboard**

1. Ve a: https://dashboard.stripe.com/login
2. Inicia sesión con tu cuenta
3. **IMPORTANTE**: Asegúrate de estar en **Modo Test** (arriba a la derecha debería decir "Test mode")

---

## 📦 **Paso 2: Crear Producto 1 - Plan Básico**

### En Stripe Dashboard:

1. Ir a: **Products** (en el menú lateral)
2. Click en **+ Add product** (botón azul arriba a la derecha)

### Llenar el formulario:

**Nombre:**
```
VERSA Manager - Plan Básico
```

**Descripción:**
```
Ideal para talleres pequeños y autónomos. Hasta 2 usuarios, gestión de clientes y vehículos, órdenes de trabajo básicas.
```

**Pricing:**
- Click en **+ Add another price** (para agregar el precio anual)

**Precio 1 (Mensual):**
- Price: `30`
- Currency: `EUR`
- Billing period: `Monthly`
- Free trial: `15 days`

**Precio 2 (Anual):**
- Click en **+ Add another price**
- Price: `300`
- Currency: `EUR`  
- Billing period: `Yearly`
- Free trial: `15 days`

3. Click en **Save product**

### ✅ COPIAR LOS PRICE IDs:

Después de guardar, verás algo como:

```
○ €30.00/month - Free trial: 15 days
  Price ID: price_1Oabcd...
  
○ €300.00/year - Free trial: 15 days
  Price ID: price_1Oefgh...
```

**COPIA ESTOS 2 PRICE IDs** y guárdalos en un bloc de notas temporalmente.

---

## 📦 **Paso 3: Crear Producto 2 - Plan Pro**

Repetir el proceso:

**Nombre:**
```
VERSA Manager - Plan Pro
```

**Descripción:**
```
Perfecto para talleres en crecimiento. Hasta 6 usuarios, hasta 3 sucursales, calendario avanzado multi-mecánico, informes y estadísticas.
```

**Precio 1 (Mensual):**
- Price: `59`
- Currency: `EUR`
- Billing period: `Monthly`
- Free trial: `15 days`

**Precio 2 (Anual):**
- Price: `588`
- Currency: `EUR`
- Billing period: `Yearly`
- Free trial: `15 days`

**COPIAR LOS 2 PRICE IDs**

---

## 📦 **Paso 4: Crear Producto 3 - Plan Fleet**

**Nombre:**
```
VERSA Manager - Plan Flotas & Renting
```

**Descripción:**
```
Gestión de flotas y empresas de renting. Usuarios ilimitados, gestión de flotas completa, contratos de renting, mantenimientos programados.
```

**Precio 1 (Mensual):**
- Price: `99`
- Currency: `EUR`
- Billing period: `Monthly`
- Free trial: `15 days`

**Precio 2 (Anual):**
- Price: `996`
- Currency: `EUR`
- Billing period: `Yearly`
- Free trial: `15 days`

**COPIAR LOS 2 PRICE IDs**

---

## 🔑 **Paso 5: Obtener las API Keys**

1. Ir a: **Developers** > **API keys** (en el menú lateral)
2. Copiar:
   - **Secret key** (empieza con `sk_test_...`)
   - Click en **Reveal test key** si está oculta

---

## 🪝 **Paso 6: Configurar Webhook**

1. Ir a: **Developers** > **Webhooks**
2. Click en **+ Add endpoint**
3. **Endpoint URL**: Por ahora usa:
   ```
   https://versa-app-dev.up.railway.app/api/stripe/webhook
   ```
   
4. **Events to send**: Seleccionar:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`

5. Click en **Add endpoint**
6. **Copiar el Signing secret** (empieza con `whsec_...`)

---

## ✅ **Paso 7: Dame todos los IDs**

Una vez que tengas todo, responde con este formato:

```
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui
STRIPE_WEBHOOK_SECRET=whsec_tu_secret_aqui
STRIPE_PRICE_BASIC_MONTHLY=price_xxxxx
STRIPE_PRICE_BASIC_YEARLY=price_xxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxx
STRIPE_PRICE_FLEET_MONTHLY=price_xxxxx
STRIPE_PRICE_FLEET_YEARLY=price_xxxxx
```

**Yo me encargo de:**
- ✅ Actualizar el archivo `.env`
- ✅ Re-ejecutar la migración
- ✅ Verificar que todo funciona
- ✅ Probar el checkout

---

## 🆘 **¿Problemas?**

Si algo no está claro, mándame un screenshot y te ayudo.

**Tiempo estimado total: 10-15 minutos** ⏱️
