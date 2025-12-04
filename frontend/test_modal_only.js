// test_modal_only.html - Prueba SOLO el modal sin Stripe
// Copia este contenido en frontend/index.html temporalmente para probar solo el modal

// REEMPLAZA la función processSubscription() con esta versión de prueba:

async function processSubscription() {
    const emailInput = document.getElementById('email-input');
    const email = emailInput.value.trim();
    const errorMsg = document.getElementById('email-error');
    const submitBtn = document.getElementById('submit-email-btn');

    // Validar email
    if (!email) {
        errorMsg.textContent = 'Por favor, ingresa tu email';
        errorMsg.classList.remove('hidden');
        emailInput.classList.add('border-red-500');
        return;
    }

    if (!isValidEmail(email)) {
        errorMsg.textContent = 'Por favor, ingresa un email válido';
        errorMsg.classList.remove('hidden');
        emailInput.classList.add('border-red-500');
        return;
    }

    // Ocultar error
    errorMsg.classList.add('hidden');
    emailInput.classList.remove('border-red-500');

    // Mostrar loading
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span class="ml-2">Procesando...</span>
  `;

    // SIMULACIÓN - Esperar 2 segundos
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mostrar resultado
    console.log('✅ Modal Test Exitoso!');
    console.log('Email:', email);
    console.log('Plan:', selectedPlan);
    console.log('Billing:', selectedBillingInterval);

    // Cerrar modal y mostrar alert de éxito
    closeEmailModal();

    // Alert bonito con información
    alert(`¡Modal funcionando perfectamente! 🎉

Email: ${email}
Plan: ${selectedPlan.toUpperCase()}
Billing: ${selectedBillingInterval === 'monthly' ? 'Mensual' : 'Anual'}

(Stripe no configurado aún - esto es solo una prueba del modal)`);

    // Restaurar botón
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
}

/*
 * INSTRUCCIONES:
 * 
 * 1. Abre frontend/index.html
 * 2. Busca la función processSubscription() (línea ~875)
 * 3. Reemplázala con la versión de arriba
 * 4. Guarda y recarga la página
 * 5. Haz clic en cualquier botón de suscripción
 * 6. ¡Ahora verás el modal funcionando sin necesidad de Stripe!
 * 
 * Esto te permite probar:
 * - El diseño del modal
 * - La validación de email
 * - El loading spinner
 * - Los mensajes de error
 * 
 * Una vez que estés satisfecho con el modal, puedes volver a poner
 * la función original que sí llama a Stripe.
 */
