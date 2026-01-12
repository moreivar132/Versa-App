// test_stripe_checkout.js
/**
 * Script de prueba para verificar la creación de checkout sessions
 * Ejecutar con: node test_stripe_checkout.js
 */

require('dotenv').config();

async function testCheckoutSession() {
    console.log('🧪 Probando creación de Checkout Session...\n');

    const API_URL = 'http://localhost:3000/api/stripe/create-checkout-session';

    const testData = {
        tenantId: 1,
        plan: 'pro',
        billingInterval: 'monthly',
        email: 'test@example.com',
    };

    console.log('📤 Enviando request a:', API_URL);
    console.log('📋 Datos:', JSON.stringify(testData, null, 2));
    console.log('');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            console.log('✅ Checkout Session creada correctamente!\n');
            console.log('🔗 URL de Stripe Checkout:');
            console.log(data.url);
            console.log('\n💡 Puedes abrir esta URL en tu navegador para probar el checkout.');
        } else {
            console.log('❌ Error al crear Checkout Session:\n');
            console.log('Status:', response.status);
            console.log('Error:', data.error);
            console.log('Detalles:', data.details || 'N/A');
        }

    } catch (error) {
        console.error('❌ Error de red:', error.message);
        console.log('\n💡 Asegúrate de que:');
        console.log('1. El servidor backend está corriendo (npm run dev)');
        console.log('2. Las variables de entorno están configuradas (.env)');
        console.log('3. Los price_id de Stripe son correctos');
    }
}

// Ejecutar el test
testCheckoutSession();
