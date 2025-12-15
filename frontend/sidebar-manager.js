/**
 * sidebar-manager.js - Sidebar Unificado para Manager Goversa
 * 
 * Este script genera dinámicamente el sidebar para todas las páginas del manager,
 * asegurando consistencia visual y de navegación en toda la aplicación.
 * 
 * USO: Incluir este script al final del body de cada página manager-*
 * <script src="sidebar-manager.js"></script>
 */

(function () {
    // Detectar página actual
    const currentPage = window.location.pathname.split('/').pop() || 'manager-taller-inicio.html';

    // Estructura de navegación
    const navItems = [
        {
            type: 'link',
            id: 'inicio',
            label: 'Inicio',
            icon: 'fa-home',
            href: 'manager-taller-inicio.html'
        },
        {
            type: 'dropdown',
            id: 'taller',
            label: 'Taller',
            icon: 'fa-wrench',
            items: [
                { label: 'Citas', href: 'manager-taller-citas.html' },
                { label: 'Órdenes', href: 'manager-taller-ordenes-lista.html' },
                { label: 'Vehículos', href: 'manager-taller-vehiculos.html' },
                { label: 'Chat Clientes', href: 'manager-taller-chat.html' },
                { label: 'Config. Órdenes', href: 'manager-taller-config-ordenes.html' }
            ]
        },
        {
            type: 'dropdown',
            id: 'tienda',
            label: 'Tienda',
            icon: 'fa-shopping-cart',
            items: [
                { label: 'Nueva Venta', href: 'manager-taller-ventas.html' },
                { label: 'Historial Ventas', href: 'manager-taller-ventas-historial.html' },
                { label: 'Nueva Compra', href: 'manager-taller-compras.html' },
                { label: 'Historial Compras', href: 'manager-taller-compras-historial.html' }
            ]
        },
        {
            type: 'link',
            id: 'caja',
            label: 'Caja',
            icon: 'fa-cash-register',
            href: 'manager-taller-caja.html'
        },
        {
            type: 'dropdown',
            id: 'cuentas',
            label: 'Cuentas',
            icon: 'fa-file-invoice-dollar',
            items: [
                { label: 'Facturas', href: 'manager-taller-facturas.html' },
                { label: 'Pendientes Facturar', href: 'manager-taller-facturas-pendientes.html' },
                { label: 'Cuentas Corrientes', href: 'manager-taller-cuentas-corrientes.html' },
                { label: 'Configuración', href: 'manager-taller-config-facturas.html' }
            ]
        },
        {
            type: 'link',
            id: 'inventario',
            label: 'Inventario',
            icon: 'fa-boxes',
            href: 'manager-taller-inventario.html'
        },
        {
            type: 'link',
            id: 'trabajadores',
            label: 'Trabajadores',
            icon: 'fa-users-cog',
            href: 'manager-taller-trabajadores.html'
        },
        {
            type: 'dropdown',
            id: 'contactos',
            label: 'Contactos',
            icon: 'fa-address-book',
            items: [
                { label: 'Clientes', href: 'manager-taller-clientes.html' },
                { label: 'Proveedores', href: 'manager-taller-proveedores.html' }
            ]
        }
    ];

    // Verificar si la página actual está en un dropdown
    function isActiveDropdown(dropdown) {
        return dropdown.items && dropdown.items.some(item => item.href === currentPage);
    }

    // Verificar si un item está activo
    function isActiveItem(href) {
        return href === currentPage;
    }

    // Generar HTML del sidebar
    function generateSidebar() {
        const sidebarEl = document.getElementById('sidebar');
        if (!sidebarEl) return;

        // Obtener info del usuario desde localStorage o usar valores por defecto
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userName = userInfo.nombre || 'Usuario';
        const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const userRole = userInfo.tipo || 'admin';

        let navHTML = '';

        navItems.forEach(item => {
            if (item.type === 'link') {
                const isActive = isActiveItem(item.href);
                const activeClass = isActive
                    ? 'bg-[var(--brand-orange)] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#282e39]';

                navHTML += `
                    <a class="flex items-center gap-3 px-3 py-2 ${activeClass} rounded-lg transition-colors"
                        href="${item.href}">
                        <span class="icon-container"><i class="fas ${item.icon}"></i></span>
                        <p class="text-sm font-medium leading-normal sidebar-text">${item.label}</p>
                    </a>
                `;
            } else if (item.type === 'dropdown') {
                const isActive = isActiveDropdown(item);
                const parentActiveClass = isActive
                    ? 'bg-[var(--brand-orange)] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#282e39]';
                const arrowIcon = isActive ? 'fa-chevron-up' : 'fa-chevron-down';
                const submenuClass = isActive ? 'flex' : 'hidden';

                let submenuHTML = '';
                item.items.forEach(subItem => {
                    const isSubActive = isActiveItem(subItem.href);
                    const subActiveClass = isSubActive
                        ? 'text-white font-semibold'
                        : 'text-gray-400 hover:text-white';

                    submenuHTML += `
                        <a href="${subItem.href}" class="${subActiveClass} text-sm py-1 block">${subItem.label}</a>
                    `;
                });

                navHTML += `
                    <div class="nav-group">
                        <a class="flex items-center gap-3 px-3 py-2 ${parentActiveClass} rounded-lg transition-colors cursor-pointer"
                            onclick="toggleSubmenu('${item.id}-submenu')">
                            <span class="icon-container"><i class="fas ${item.icon}"></i></span>
                            <p class="text-sm font-medium leading-normal sidebar-text flex-1">${item.label}</p>
                            <i class="fas ${arrowIcon} text-xs sidebar-text transition-transform" id="${item.id}-arrow"></i>
                        </a>
                        <div id="${item.id}-submenu" class="${submenuClass} flex-col pl-9 gap-1 mt-1">
                            ${submenuHTML}
                        </div>
                    </div>
                `;
            }
        });

        sidebarEl.innerHTML = `
            <div class="flex h-full flex-col justify-between">
                <div class="flex flex-col gap-4">
                    <!-- Logo Area -->
                    <div class="flex items-center gap-3 p-2 mb-4">
                        <div class="logo-badge"
                            style="padding: 8px; border-radius: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                            <img src="https://i.imgur.com/Mjw4or5.png" alt="Logo" class="logo-img"
                                style="height: 24px; width: auto;">
                        </div>
                        <div class="flex flex-col sidebar-text">
                            <h1 class="text-white text-base font-medium leading-normal" style="font-size: 15px;">Goversa</h1>
                            <p class="text-[#9da6b9] text-sm font-normal leading-normal" style="font-size: 12px;">Gestión</p>
                        </div>
                        <button id="toggle-sidebar" class="ml-auto text-gray-400 hover:text-white">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                    </div>

                    <!-- Navigation Links -->
                    <nav class="flex flex-col gap-2">
                        ${navHTML}
                    </nav>
                </div>

                <!-- Bottom User Section -->
                <div class="flex flex-col gap-1 border-t border-[var(--surface-border)] pt-4">
                    <div class="flex items-center gap-3 px-3 py-2 mb-2">
                        <div class="w-8 h-8 rounded-full bg-[var(--brand-orange)] flex items-center justify-center text-white font-bold text-xs" id="user-avatar">
                            ${userInitials}
                        </div>
                        <div class="flex flex-col sidebar-text overflow-hidden">
                            <span class="text-white text-sm font-medium truncate" id="user-name">${userName}</span>
                            <span class="text-gray-500 text-xs truncate" id="user-role">${userRole}</span>
                        </div>
                    </div>
                    <a class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-[#282e39] rounded-lg transition-colors"
                        href="#" data-logout>
                        <span class="icon-container"><i class="fas fa-sign-out-alt"></i></span>
                        <p class="text-sm font-medium leading-normal sidebar-text">Salir</p>
                    </a>
                </div>
            </div>
        `;

        // Configurar toggle del sidebar
        setupSidebarToggle();
    }

    // Función global para toggle de submenús
    window.toggleSubmenu = function (id) {
        const submenu = document.getElementById(id);
        const arrowId = id.replace('-submenu', '-arrow');
        const arrow = document.getElementById(arrowId);

        if (submenu.classList.contains('hidden')) {
            submenu.classList.remove('hidden');
            submenu.classList.add('flex');
            if (arrow) {
                arrow.classList.remove('fa-chevron-down');
                arrow.classList.add('fa-chevron-up');
            }
        } else {
            submenu.classList.add('hidden');
            submenu.classList.remove('flex');
            if (arrow) {
                arrow.classList.remove('fa-chevron-up');
                arrow.classList.add('fa-chevron-down');
            }
        }
    };

    // Configurar toggle del sidebar (versión colapsada)
    function setupSidebarToggle() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggle-sidebar');
        const sidebarTexts = sidebar.querySelectorAll('.sidebar-text');
        let isCollapsed = false;

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                isCollapsed = !isCollapsed;
                if (isCollapsed) {
                    sidebar.classList.remove('w-64');
                    sidebar.classList.add('w-20');
                    sidebarTexts.forEach(el => el.classList.add('hidden'));
                    toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                    // Cerrar todos los submenús
                    document.querySelectorAll('[id$="-submenu"]').forEach(el => {
                        el.classList.add('hidden');
                        el.classList.remove('flex');
                    });
                } else {
                    sidebar.classList.add('w-64');
                    sidebar.classList.remove('w-20');
                    sidebarTexts.forEach(el => el.classList.remove('hidden'));
                    toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                }
            });
        }

        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                sidebar.classList.toggle('absolute');
                sidebar.classList.toggle('z-50');
                sidebar.classList.toggle('h-full');
            });
        }
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', generateSidebar);
    } else {
        generateSidebar();
    }
})();
