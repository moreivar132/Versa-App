(function () {
    // Evitar bucles en páginas públicas
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('cita-previa.html')) {
        return;
    }

    const SESSION_KEY = 'versa_session_v1';

    function redirectToLogin() {
        console.warn('⛔ Acceso denegado: Redirigiendo a login...');
        window.location.replace('login.html');
    }

    const session = localStorage.getItem(SESSION_KEY);

    if (!session) {
        redirectToLogin();
    } else {
        try {
            const parsed = JSON.parse(session);
            if (!parsed?.token) {
                throw new Error('Token no encontrado');
            }
        } catch (error) {
            console.error('Sesión inválida:', error);
            localStorage.removeItem(SESSION_KEY);
            redirectToLogin();
        }
    }

    // Use event delegation for logout to handle dynamic content (SafeToAutoRun)
    window.addEventListener('click', (event) => {
        const logoutLink = event.target.closest('[data-logout]') ||
            event.target.closest('#logoutBtn') ||
            event.target.closest('#btnLogout');

        if (logoutLink) {
            event.preventDefault();
            localStorage.removeItem(SESSION_KEY);
            window.location.replace('login.html');
        }
    });
})();
