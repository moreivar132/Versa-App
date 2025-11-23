// frontend/auth.js - Refactorizado para autenticación segura basada en tokens
(async function initAuth() {
  const API_BASE_URL = 'http://localhost:3000'; // Asegúrate de que coincida con el puerto de tu backend
  const onLoginPage = location.pathname.endsWith('login.html');
  const token = localStorage.getItem('jwt_token');

  // --- Funciones de Ayuda ---
  function showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function forceLogout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    if (!onLoginPage) {
      location.href = 'login.html';
    }
  }

  // --- Lógica para la página de Login ---
  if (onLoginPage) {
    // Si el usuario ya tiene un token, que vaya a la página principal
    if (token) {
      location.href = 'index.html';
      return;
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showLoginError('');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
          showLoginError('Por favor, completa tu email y contraseña.');
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Error en el servidor');
          }

          // Guardar el token y la información del usuario
          localStorage.setItem('jwt_token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));

          // Redirigir a la página principal
          location.href = 'index.html';

        } catch (error) {
          console.error('Error de autenticación:', error);
          showLoginError(error.message || 'No se pudo iniciar sesión. Revisa tus credenciales.');
        }
      });
    }
    return; // Detener la ejecución si estamos en la página de login
  }

  // --- Lógica para páginas protegidas (fuera de login) ---
  if (!token) {
    forceLogout();
    return; // Si no hay token, no continuar
  }

  // Intentar parsear la información del usuario guardada
  let user;
  try {
    user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.role) throw new Error("Datos de usuario inválidos");
  } catch (error) {
    console.error('Error al parsear datos de usuario:', error);
    forceLogout();
    return;
  }
  
  // --- Lógica de UI (común para páginas protegidas) ---

  // Mostrar información del usuario
  const displayName = user.nombre || user.email;
  const userSummary = `${displayName} · ${user.role}`;
  const userInfoEl = document.getElementById('userInfo');
  const mobileUserInfoEl = document.getElementById('mobileUserInfo');
  if (userInfoEl) userInfoEl.textContent = userSummary;
  if (mobileUserInfoEl) mobileUserInfoEl.textContent = userSummary;

  // Control de visibilidad basado en rol
  document.body?.setAttribute('data-user-role', user.role);
  document.querySelectorAll('[data-requires="admin"]').forEach((el) => {
    el.style.display = user.role === 'admin' ? '' : 'none';
  });

  // Botón de Logout
  document.getElementById('btnLogout')?.addEventListener('click', forceLogout);

  // El resto del código original para manejar la navegación y el menú móvil
  // (Este código no necesita cambios ya que depende del rol, que ya hemos establecido)
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
    if (isMobileNavOpen()) closeMobileNav();
  });

  showView(resolveTargetView(location.hash.replace('#','')));

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavOverlay = document.getElementById('mobileNavOverlay');
  const mobileNavPanel = document.getElementById('mobileNavPanel');
  const mobileNavClose = document.getElementById('mobileNavClose');
  const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastFocusedElement = null;

  const isMobileNavOpen = () => mobileNavOverlay?.getAttribute('aria-hidden') === 'false';

  function handleMobileNavKeydown(event){
    if (!isMobileNavOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileNav();
      return;
    }
    if (event.key !== 'Tab') return;
    if (!mobileNavPanel) return;
    const focusables = Array.from(mobileNavPanel.querySelectorAll(focusableSelectors)).filter(el=> !el.hasAttribute('disabled'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openMobileNav(){
    if (!mobileNavOverlay || !mobileNavPanel) return;
    if (isMobileNavOpen()) return;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mobileNavOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-open');
    mobileMenuBtn?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(()=>{
      const firstFocusable = mobileNavPanel.querySelector(focusableSelectors);
      if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus();
      } else {
        mobileNavPanel.focus();
      }
    });
    document.addEventListener('keydown', handleMobileNavKeydown);
  }

  function closeMobileNav(){
    if (!mobileNavOverlay) return;
    if (!isMobileNavOpen()) return;
    mobileNavOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-open');
    mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', handleMobileNavKeydown);
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    } else {
      mobileMenuBtn?.focus();
    }
  }

  mobileMenuBtn?.addEventListener('click', ()=>{
    if (isMobileNavOpen()) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  mobileNavClose?.addEventListener('click', closeMobileNav);
  mobileNavOverlay?.addEventListener('click', (event)=>{
    if (event.target === mobileNavOverlay) {
      closeMobileNav();
    }
  });

  navLinks.forEach(link=>{
    link.addEventListener('click', ()=>{
      if (isMobileNavOpen()) {
        setTimeout(closeMobileNav, 150);
      }
    });
  });
})();
