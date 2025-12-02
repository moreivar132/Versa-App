(function () {
    // Evitar bucle infinito si ya estamos en login
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('cita-previa.html')) {
        return;
    }

    const session = localStorage.getItem('versa_session_v1');

    function redirect() {
        console.warn('⛔ Acceso denegado: Redirigiendo a login...');
        // Usar ruta relativa para mayor compatibilidad
        window.location.replace('login.html');
    }

    if (!session) {
        redirect();
    } else {
        try {
            const parsed = JSON.parse(session);
            if (!parsed || !parsed.token) {
                throw new Error('Token no encontrado');
            }
        } catch (e) {
            console.error('Sesión inválida:', e);
            localStorage.removeItem('versa_session_v1');
            redirect();
        }
    }
})();
