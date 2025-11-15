// Gestión de autenticación y visibilidad por rol.
(async function initAuth(){
  const onLogin =
    location.pathname.endsWith('login.html') || location.href.endsWith('login.html');

  function showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  try {
    await window.UserStore.init();
  } catch (error) {
    console.error('No se pudo inicializar el almacén de usuarios.', error);
    if (onLogin) {
      showLoginError('Este navegador no soporta el módulo de seguridad necesario.');
    } else {
      alert('No se pudo validar tu sesión de forma segura. Vuelve a iniciar sesión.');
      location.href = 'login.html';
    }
    return;
  }

  if (onLogin) {
    const form = document.getElementById('loginForm');
    if (!form) return;
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
        const user = await window.UserStore.authenticate(email, password);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userName', user.name || '');
        location.href = 'index.html';
      } catch (error) {
        showLoginError(error.message || 'No se pudo iniciar sesión.');
      }
    });
    return;
  }

  function forceLogout() {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    location.href = 'login.html';
  }

  const email = localStorage.getItem('userEmail') || '';
  if (!email) { forceLogout(); return; }
  const user = window.UserStore.getUser(email);
  if (!user) { forceLogout(); return; }

  localStorage.setItem('userRole', user.role);
  localStorage.setItem('userName', user.name || '');

  const displayName = user.name || user.email;
  const userSummary = `${displayName} · ${user.role}`;
  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.textContent = userSummary;
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  if (mobileUserInfo) mobileUserInfo.textContent = userSummary;

  document.body?.setAttribute('data-user-role', user.role);

  document.querySelectorAll('[data-requires="admin"]').forEach((el)=>{
    el.style.display = (user.role === 'admin') ? '' : 'none';
  });

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

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', forceLogout);
})();
