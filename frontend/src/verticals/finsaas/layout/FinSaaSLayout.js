import { finSaaSNav } from '/src/verticals/finsaas/nav/finsaas.nav.js';
import { logout } from '/auth.js';

export class FinSaaSLayout {
    constructor(containerId = 'app-shell') {
        this.containerId = containerId;
    }

    init() {
        const shell = document.getElementById(this.containerId);
        if (!shell) {
            console.error(`FinSaaSLayout: Container #${this.containerId} not found`);
            return;
        }

        // 1. Wrap existing content in Main + Topbar structure if not already matched
        // Strategy: We will RENDER the Sidebar BEFORE the existing content, 
        // and wrap the existing content in the <main> tag.

        // However, existing HTMLs have full body structure. 
        // We assume the page will clear body or provided container and we render everything.
        // OR, the page provides a clean Slate.

        // Let's assume the page calls init() and we inject the Sidebar and Topbar AROUND the content.
        // But re-parenting DOM nodes can be tricky with event listeners.
        // Better approach: The Page provides <div id="app-shell"></div> and puts its content INSIDE 
        // a specific slot, or we inject the shell structure and move content into it.

        this.renderShell(shell);
        this.highlightActiveRoute();
        this.attachEvents();
        this.initGlobalEmpresaSelector();
    }

    async initGlobalEmpresaSelector() {
        const container = document.getElementById('global-empresa-container');
        if (!container) return;

        try {
            const SESSION_KEY = 'versa_session_v1';
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
            const token = session.token;

            if (!token) return;

            const response = await fetch('/api/contabilidad/empresas', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();

            if (res.data && res.data.items) {
                this.empresas = res.data.items.map(emp => ({
                    id: emp.id,
                    nombre: this.cleanName(emp.nombre_comercial || emp.nombre_legal),
                    legal: emp.nombre_legal,
                    nif: emp.nif_cif
                }));

                const stored = localStorage.getItem('finsaas_current_empresa') || localStorage.getItem('filsaas_current_empresa');
                let current = this.empresas.find(e => e.id == stored) || this.empresas[0];

                if (current) {
                    localStorage.setItem('finsaas_current_empresa', current.id);
                    localStorage.setItem('filsaas_current_empresa', current.id);
                }

                this.renderSearchableSelector(container, current);
            }
        } catch (e) {
            console.error('[FinSaaSLayout] Error loading empresas:', e);
        }
    }

    renderSearchableSelector(container, current) {
        // Replace the native select with our custom searchable UI
        container.innerHTML = `
            <div class="relative w-full" id="empresa-search-wrapper">
                <button type="button" id="empresa-dropdown-btn" class="flex items-center gap-3 w-full text-left">
                    <span class="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors text-[20px]">business</span>
                    <div class="flex flex-col min-w-[140px] max-w-[200px]">
                        <span id="selected-empresa-name" class="text-sm font-bold text-slate-700 dark:text-white truncate">${current?.nombre || 'Seleccionar...'}</span>
                        <span class="text-[10px] text-gray-400 truncate">${current?.nif || ''}</span>
                    </div>
                    <span class="material-symbols-outlined text-gray-400 text-[18px] ml-auto">expand_more</span>
                </button>
                
                <div id="empresa-dropdown-panel" class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-[#25381e] rounded-xl shadow-2xl z-[100] hidden overflow-hidden min-w-[250px]">
                    <div class="p-3 border-b border-gray-200 dark:border-[#25381e]">
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                            <input type="text" id="empresa-search-input" placeholder="Buscar empresa..." class="w-full bg-gray-50 dark:bg-surface-dark-light border border-gray-200 dark:border-transparent rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none">
                        </div>
                    </div>
                    <div id="empresa-list" class="max-h-[300px] overflow-y-auto">
                        <!-- Items injected by JS -->
                    </div>
                </div>
            </div>
        `;

        const btn = document.getElementById('empresa-dropdown-btn');
        const panel = document.getElementById('empresa-dropdown-panel');
        const input = document.getElementById('empresa-search-input');
        const list = document.getElementById('empresa-list');

        const updateList = (filter = '') => {
            const filtered = this.empresas.filter(e =>
                e.nombre.toLowerCase().includes(filter.toLowerCase()) ||
                (e.legal && e.legal.toLowerCase().includes(filter.toLowerCase())) ||
                (e.nif && e.nif.toLowerCase().includes(filter.toLowerCase()))
            );

            list.innerHTML = filtered.map(e => `
                <div class="empresa-item px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-light cursor-pointer transition-colors flex flex-col gap-0.5" data-id="${e.id}">
                    <span class="text-sm font-bold text-slate-700 dark:text-white">${e.nombre}</span>
                    <span class="text-[10px] text-gray-500">${e.nif || ''} ${e.legal ? '• ' + e.legal : ''}</span>
                </div>
            `).join('');

            // In case of no results
            if (filtered.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">No se encontraron empresas</div>`;
            }

            // Click events for items
            list.querySelectorAll('.empresa-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    localStorage.setItem('finsaas_current_empresa', id);
                    localStorage.setItem('filsaas_current_empresa', id);
                    window.location.reload();
                });
            });
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                input.focus();
                updateList();
            }
        });

        input.addEventListener('input', (e) => {
            updateList(e.target.value);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !btn.contains(e.target)) {
                panel.classList.add('hidden');
            }
        });
    }

    /**
     * Helper to clean names and fix common typos (like the one in the screenshot)
     */
    cleanName(name) {
        if (!name) return 'Sin nombre';
        // Fix "Enrirque" typo specifically if it appears
        return name.replace(/Enrirque/g, 'Enrique');
    }

    /**
     * Get user permissions from session
     * @returns {Array<string>} List of permission strings
     */
    getUserPermissions() {
        const SESSION_KEY = 'versa_session_v1';
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
            // Permissions can come from session.user.permissions or be empty
            return session.user?.permissions || [];
        } catch (e) {
            console.warn('[FinSaaSLayout] Error reading permissions:', e);
            return [];
        }
    }

    /**
     * Check if user has a specific permission
     * @param {string|undefined} requiredPermission - Permission to check (undefined = no restriction)
     * @param {Array<string>} userPermissions - User's permissions list
     * @returns {boolean}
     */
    hasPermission(requiredPermission, userPermissions) {
        // No restriction = everyone can see
        if (!requiredPermission) return true;

        // Super admin bypass (has '*' permission)
        if (userPermissions.includes('*')) return true;

        // Check specific permission
        return userPermissions.includes(requiredPermission);
    }

    renderShell(container) {
        // Move existing children to a temporary fragment to re-insert them into the content area
        const contentFragment = document.createDocumentFragment();
        while (container.firstChild) {
            contentFragment.appendChild(container.firstChild);
        }

        container.className = "flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased";
        container.innerHTML = `
            <!-- Sidebar -->
            <aside id="finsaas-sidebar" class="hidden lg:flex flex-col w-72 h-full border-r border-gray-200 dark:border-[#25381e] bg-white dark:bg-background-dark z-20 transition-transform">
                <div class="p-6 flex items-center gap-3 mb-2">
                    <div class="bg-center bg-no-repeat bg-cover rounded-lg size-10 shadow-lg shadow-primary/20"
                        style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDtnaABJsECy9evgMO32S4kjZA_0JVSde5zRo-B8YFIvDHlFzALe044u5-2qrj9SNOJbm_K_x2r72nrr6xjDu7i7xdH8CgEDSBnURfIzUVH1j3VU0BPKIGWQjbns9o1kCYh9pKSSec3TdhrsVj9E_XJKswtEu-qRidaDIwLxigl159QsM8g7EqQ0aF9vcyKT2fpsW1EjecqU_Bx9nJCHG3vBX_qFzBU3C298h4vDTSM9z_be2tcQSpGziTyssx2jn39mA5g7J04LKc");'>
                    </div>
                    <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">FinSaaS</h1>
                </div>

                <nav class="flex-1 px-4 space-y-2 overflow-y-auto" id="finsaas-nav-list">
                    <!-- Nav Items Injected Here -->
                </nav>

                <div class="p-4 border-t border-gray-200 dark:border-[#25381e]">
                     <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-transparent">
                        <div id="user-avatar" class="size-10 rounded-full bg-primary flex items-center justify-center text-background-dark font-bold">--</div>
                        <div class="flex flex-col overflow-hidden">
                            <p id="user-name" class="text-sm font-bold text-slate-900 dark:text-white truncate">Usuario</p>
                            <p id="user-role" class="text-xs text-gray-500 dark:text-gray-400 truncate">Admin</p>
                        </div>
                    </div>
                     <button id="btn-logout" class="w-full mt-2 flex items-center justify-center gap-2 p-2 text-xs text-gray-500 hover:text-red-500 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">logout</span> Salir
                    </button>
                </div>
            </aside>

            <!-- Main Content -->
            <main class="flex-1 flex flex-col h-full overflow-hidden relative">
                <!-- Topbar -->
                <header class="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-[#25381e] bg-white dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-10">
                    <div class="flex items-center flex-1 gap-4">
                        <button id="btn-mobile-menu" class="lg:hidden p-2 text-gray-500 hover:text-slate-900 dark:hover:text-white">
                            <span class="material-symbols-outlined">menu</span>
                        </button>
                        <!-- Breadcrumb or Title placeholder -->
                        <h2 id="page-title" class="text-lg font-bold hidden md:block text-slate-900 dark:text-white"></h2>
                    </div>
                    <div class="flex items-center gap-4">
                        <!-- Global Empresa Selector Container -->
                        <div id="global-empresa-container" class="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-[#25381e] rounded-xl px-4 py-2 hover:border-primary/50 transition-all group focus-within:ring-2 focus-within:ring-primary/20 cursor-pointer">
                            <!-- Injected by initGlobalEmpresaSelector -->
                            <div class="flex items-center gap-3 animate-pulse">
                                <div class="w-8 h-8 bg-gray-200 dark:bg-surface-dark-light rounded-lg"></div>
                                <div class="w-24 h-4 bg-gray-200 dark:bg-surface-dark-light rounded"></div>
                            </div>
                        </div>

                        <button class="relative p-2 text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark">
                            <span class="material-symbols-outlined">notifications</span>
                            <span class="absolute top-2 right-2 size-2 bg-primary rounded-full border-2 border-white dark:border-background-dark"></span>
                        </button>
                    </div>
                </header>

                <!-- Page Content Outlet -->
                <div id="finsaas-content" class="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
                    <!-- Original Content Injected Here -->
                </div>
            </main>

            <!-- Mobile Overlay -->
            <div id="mobile-overlay" class="fixed inset-0 bg-black/50 z-10 hidden lg:hidden glass-effect"></div>
        `;

        // Inject Nav Items - filtered by user permissions
        const navList = container.querySelector('#finsaas-nav-list');
        const userPermissions = this.getUserPermissions();

        // Filter nav items based on permissions
        const filteredNav = finSaaSNav.filter(item => this.hasPermission(item.requiredPermission, userPermissions));

        navList.innerHTML = filteredNav.map(item => {
            if (item.type === 'section') {
                return `<p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">${item.label}</p>`;
            }
            return `
                <a href="${item.route}" 
                   class="nav-link flex items-center justify-between px-4 py-3 rounded-lg text-slate-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-light hover:text-slate-900 dark:hover:text-white transition-all group"
                   data-route="${item.route}">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined group-hover:scale-110 transition-transform">${item.icon}</span>
                        <span class="text-sm font-medium">${item.label}</span>
                    </div>
                    ${item.badge ? `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-primary text-background-dark rounded-md">${item.badge}</span>` : ''}
                </a>
            `;
        }).join('');

        // Re-inject content
        container.querySelector('#finsaas-content').appendChild(contentFragment);

        // Update User Info (Mock or from LocalStorage)
        this.updateUserInfo(container);
    }

    updateUserInfo(container) {
        const SESSION_KEY = 'versa_session_v1';
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
            if (session.user && session.user.nombre) {
                container.querySelector('#user-name').textContent = session.user.nombre;

                // Determine best role label
                let roleLabel = 'Usuario';
                if (session.user.roles && session.user.roles.length > 0) {
                    roleLabel = session.user.roles[0].display_name || session.user.roles[0].nombre;
                } else if (session.user.rol) {
                    roleLabel = session.user.rol;
                }

                container.querySelector('#user-role').textContent = roleLabel;

                // Initials
                const initials = session.user.nombre.substring(0, 2).toUpperCase();
                container.querySelector('#user-avatar').textContent = initials;
            }
        } catch (e) { /* ignore */ }
    }

    highlightActiveRoute() {
        const currentPath = window.location.pathname;
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            const route = link.getAttribute('data-route');
            // Check if current path ends with the route (handling loose matches)
            if (currentPath.endsWith(route) || (route !== '/' && currentPath.includes(route))) {
                link.classList.remove('text-slate-600', 'dark:text-gray-400');
                link.classList.add('bg-primary/10', 'text-primary');
            } else {
                link.classList.remove('bg-primary/10', 'text-primary');
                link.classList.add('text-slate-600', 'dark:text-gray-400');
            }
        });
    }

    attachEvents() {
        const sidebar = document.getElementById('finsaas-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        const btnMenu = document.getElementById('btn-mobile-menu');

        btnMenu?.addEventListener('click', () => {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('absolute', 'inset-y-0', 'left-0', 'shadow-xl');
            overlay.classList.remove('hidden');
        });

        overlay?.addEventListener('click', () => {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('absolute', 'inset-y-0', 'left-0', 'shadow-xl');
            overlay.classList.add('hidden');
        });

        document.getElementById('btn-logout')?.addEventListener('click', () => {
            logout();
        });
    }
}
