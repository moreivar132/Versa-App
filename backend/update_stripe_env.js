#!/usr/bin/env node
/**
 * Script para actualizar el archivo .env con las claves de Stripe
 * Uso: node update_stripe_env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const envPath = path.join(__dirname, '.env');

// Crear interfaz para leer input del usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔧 Configurador de Stripe para VERSA Manager\n');
console.log('Por favor, proporciona los siguientes valores de tu cuenta de Stripe:\n');

const questions = [
    { key: 'STRIPE_SECRET_KEY', prompt: 'Secret Key (sk_test_...): ' },
    { key: 'STRIPE_WEBHOOK_SECRET', prompt: 'Webhook Secret (whsec_...): ' },
    { key: 'STRIPE_PRICE_BASIC_MONTHLY', prompt: 'Price ID - BASIC Mensual (price_...): ' },
    { key: 'STRIPE_PRICE_BASIC_YEARLY', prompt: 'Price ID - BASIC Anual (price_...): ' },
    { key: 'STRIPE_PRICE_PRO_MONTHLY', prompt: 'Price ID - PRO Mensual (price_...): ' },
    { key: 'STRIPE_PRICE_PRO_YEARLY', prompt: 'Price ID - PRO Anual (price_...): ' },
    { key: 'STRIPE_PRICE_FLEET_MONTHLY', prompt: 'Price ID - FLEET Mensual (price_...): ' },
    { key: 'STRIPE_PRICE_FLEET_YEARLY', prompt: 'Price ID - FLEET Anual (price_...): ' },
];

const answers = {};
let currentQuestion = 0;

function askQuestion() {
    if (currentQuestion < questions.length) {
        const q = questions[currentQuestion];
        rl.question(q.prompt, (answer) => {
            answers[q.key] = answer.trim();
            currentQuestion++;
            askQuestion();
        });
    } else {
        rl.close();
        updateEnvFile();
    }
}

function updateEnvFile() {
    console.log('\n📝 Actualizando archivo .env...');

    let envContent = '';

    // Leer .env existente si existe
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Actualizar o agregar cada variable
    for (const [key, value] of Object.entries(answers)) {
        const regex = new RegExp(`^${key}=.*$`, 'gm');
        const newLine = `${key}=${value}`;

        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, newLine);
        } else {
            envContent += `\n${newLine}`;
        }
    }

    // Agregar URLs si no existen
    if (!envContent.includes('STRIPE_SUCCESS_URL')) {
        envContent += '\nSTRIPE_SUCCESS_URL=http://localhost:5173/success.html';
    }
    if (!envContent.includes('STRIPE_CANCEL_URL')) {
        envContent += '\nSTRIPE_CANCEL_URL=http://localhost:5173/cancel.html';
    }

    // Guardar archivo
    fs.writeFileSync(envPath, envContent.trim() + '\n');

    console.log('✅ Archivo .env actualizado correctamente!\n');
    console.log('🚀 Siguiente paso: ejecuta este comando para actualizar la base de datos:');
    console.log('   node migrations/populate_planes_suscripcion.js\n');
}

// Iniciar el cuestionario
askQuestion();
