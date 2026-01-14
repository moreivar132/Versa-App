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

        // Inject Nav Items
        const navList = container.querySelector('#finsaas-nav-list');
        navList.innerHTML = finSaaSNav.map(item => {
            if (item.type === 'section') {
                return `<p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">${item.label}</p>`;
            }
            return `
                <a href="${item.route}" 
                   class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-light hover:text-slate-900 dark:hover:text-white transition-all group"
                   data-route="${item.route}">
                    <span class="material-symbols-outlined group-hover:scale-110 transition-transform">${item.icon}</span>
                    <span class="text-sm font-medium">${item.label}</span>
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
                container.querySelector('#user-role').textContent = session.user.rol || 'Usuario';
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
