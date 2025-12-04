// test_whatsapp_endpoint.js
// Script de prueba para verificar que el endpoint de WhatsApp funciona

const http = require('http');

const testData = {
    nombre: 'Usuario de Prueba',
    telefono_cliente: '+34600111222',
    mensaje_cliente: 'Hola, esto es una prueba del sistema de WhatsApp'
};

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/whatsapp/contact',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

console.log('🧪 Probando endpoint /api/whatsapp/contact...\n');
console.log('📤 Datos de prueba:', JSON.stringify(testData, null, 2));
console.log('\n⏳ Enviando solicitud...\n');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📥 Respuesta recibida:');
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        console.log('\n📄 Body:', data);

        try {
            const jsonData = JSON.parse(data);
            console.log('\n✅ JSON Parseado:', JSON.stringify(jsonData, null, 2));

            if (jsonData.ok) {
                console.log('\n✅ ¡PRUEBA EXITOSA! El endpoint funciona correctamente.');
            } else {
                console.log('\n⚠️ El endpoint respondió pero con un error:', jsonData.error);
            }
        } catch (e) {
            console.log('\n❌ Error parseando JSON:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.error('\n❌ Error en la solicitud:', e.message);
    console.log('\n💡 Asegúrate de que el backend esté corriendo en el puerto 3000');
    console.log('   Ejecuta: npm run dev');
});

req.write(JSON.stringify(testData));
req.end();
