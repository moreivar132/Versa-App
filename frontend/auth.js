// Gestión de autenticación y visibilidad por rol (versión refactorizada para backend)
(async function initAuth(){
  const onLogin = location.pathname.includes('login.html');

  // Inicializa el UserStore. Se encarga de la lógica de sesión (redirige si es necesario).
  try {
    await window.UserStore.init();
  } catch(error) {
    console.error("Error al inicializar UserStore:", error);
    alert("No se pudo inicializar el módulo de seguridad. Recarga la página.");
    return;
  }
  
  // Si estamos en la página de login, configuramos el formulario.
  if (onLogin) {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const errorEl = document.getElementById('loginError');
    function showLoginError(message) {
      if (!errorEl) return;
      errorEl.hidden = !message;
      errorEl.textContent = message || '';
    }

    form.addEventListener('submit', async (event)=>{
      event.preventDefault();
      showLoginError('');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showLoginError('Completa tu email y contraseña.');
        return;
      }

      try {
        // La función authenticate ahora se comunica con el backend.
        await window.UserStore.authenticate(email, password);
        // Si tiene éxito, UserStore guarda los datos y redirigimos.
        location.href = 'index.html';
      } catch (error) {
        // Muestra el error que viene del backend.
        showLoginError(error.message || 'No se pudo iniciar sesión.');
      }
    });
    return; // Fin de la lógica para la página de login.
  }

  // --- Lógica para las páginas protegidas (no-login) ---

  const user = window.UserStore.getUser();
  // Si por alguna razón no hay usuario (sesión expirada, etc.), UserStore.init() ya debería haber redirigido.
  // Esta es una doble verificación.
  if (!user) {
    window.UserStore.logout();
    return;
  }

  // Muestra la información del usuario en la UI
  const displayName = user.nombre || user.email; // Usamos 'nombre' que viene del backend
  const userSummary = `${displayName} · ${user.role}`;
  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.textContent = userSummary;
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  if (mobileUserInfo) mobileUserInfo.textContent = userSummary;

  // Control de acceso por rol
  document.body?.setAttribute('data-user-role', user.role);
  document.querySelectorAll('[data-requires="admin"]').forEach((el)=>{
    el.style.display = (user.role === 'admin') ? '' : 'none';
  });

  // Configuración del botón de logout
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    window.UserStore.logout();
  });

  // --- El resto del código de manejo de la UI (navegación, vistas, etc.) se mantiene igual ---
  const navLinks = Array.from(document.querySelectorAll('.navlink'));
  const VIEW_IDS = ['dashboard', 'facturas', 'admin'];
  const viewSections = new Map(
    VIEW_IDS.map((viewId) => {
      const section = document.querySelector(`[data-view="${viewId}"]`) || document.getElementById(viewId);
      return [viewId, section || null];
    }).filter(([, section]) => Boolean(section))
  );

  function setActiveNav(id){
    navLinks.forEach(link=>{
      const href = (link.getAttribute('href') || '').replace('#','');
      if (!href) return;
      const isActive = href === id;
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
      link.classList.toggle('active', isActive);
    });
  }

  const views = VIEW_IDS.filter((viewId) => viewSections.has(viewId));
  function showView(id){
    const activeId = viewSections.has(id) ? id : views[0];
    viewSections.forEach((section, viewId)=>{
      if (!section) return;
      const isActive = viewId === activeId;
      section.style.display = isActive ? '' : 'none';
      if (isActive) {
        section.removeAttribute('hidden');
      } else {
        section.setAttribute('hidden', '');
      }
    });
    setActiveNav(activeId || id);
    document.body?.setAttribute('data-current-view', activeId || id);
  }

  function resolveTargetView(rawId) {
    if (!views.length) return rawId;
    const defaultAdminView = views.includes('dashboard') ? 'dashboard' : views[0];
    const defaultNonAdminView = views.includes('facturas') ? 'facturas' : views[0];
    const fallback = user.role === 'admin' ? defaultAdminView : defaultNonAdminView;
    const target = rawId || fallback;
    if (!views.includes(target)) return fallback || target;
    if (target !== 'facturas' && user.role !== 'admin' && views.includes('facturas')) return 'facturas';
    if (target !== 'facturas' && user.role !== 'admin') return fallback || target;
    return target;
  }

  window.addEventListener('hashchange', ()=>{
    const id = resolveTargetView(location.hash.replace('#',''));
    showView(id);
  });

  showView(resolveTargetView(location.hash.replace('#','')));
  
})();
