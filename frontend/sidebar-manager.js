/**
 * sidebar-manager.js - Sidebar Unificado para Manager Goversa
 * 
 * FILTRADO DE MENÚ POR ROL:
 * - Define permisos localmente por cada rol conocido
 * - Oculta secciones que el usuario no puede ver
 * - Muestra el rol real del usuario (no "admin")
 */

(function () {
    const currentPage = window.location.pathname.split('/').pop() || 'manager-taller-inicio.html';

    // =======================================================================
    // DEFINICIÓN DE PERMISOS POR ROL (MAPEO LOCAL)
    // =======================================================================
    const ROLE_PERMISSIONS = {
        // Super Admin - todo
        'SUPER_ADMIN': ['*'],

        // Tenant Admin - todo en el tenant
        'TENANT_ADMIN': [
            'workorders', 'appointments', 'vehicles', 'customers', 'inventory',
            'purchases', 'sales', 'cashregister', 'invoices', 'workers',
            'suppliers', 'fidelization', 'marketplace', 'marketing', 'config', 'access'
        ],
        'ADMIN': [
            'workorders', 'appointments', 'vehicles', 'customers', 'inventory',
            'purchases', 'sales', 'cashregister', 'invoices', 'workers',
            'suppliers', 'fidelization', 'marketplace', 'marketing', 'config', 'access'
        ],
        'ADMINISTRADOR': [
            'workorders', 'appointments', 'vehicles', 'customers', 'inventory',
            'purchases', 'sales', 'cashregister', 'invoices', 'workers',
            'suppliers', 'fidelization', 'marketplace', 'marketing', 'config', 'access'
        ],

        // Gerente - casi todo, sin config
        'GERENTE': [
            'workorders', 'appointments', 'vehicles', 'customers', 'inventory',
            'purchases', 'sales', 'cashregister', 'invoices', 'workers', 'suppliers'
        ],
        'OPERATIONS_MANAGER': [
            'workorders', 'appointments', 'vehicles', 'customers', 'inventory'
        ],

        // Recepcionista - citas, ordenes, clientes, vehículos
        'RECEPCIONISTA': [
            'workorders', 'appointments', 'vehicles', 'customers'
        ],

        // MECÁNICO - SOLO órdenes de trabajo, ver citas, ver inventario
        'MECANICO': [
            'workorders', 'appointments_view', 'inventory_view'
        ],
        'MECHANIC': [
            'workorders', 'appointments_view', 'inventory_view'
        ],

        // Contabilidad
        'ACCOUNTING': [
            'cashregister', 'invoices', 'purchases', 'customers_view'
        ],
        'CONTABILIDAD': [
            'cashregister', 'invoices', 'purchases', 'customers_view'
        ],

        // Inventario
        'INVENTORY_MANAGER': [
            'inventory', 'purchases', 'suppliers', 'workorders_view'
        ],

        // Solo lectura
        'VIEWER': [
            'workorders_view', 'appointments_view', 'customers_view',
            'vehicles_view', 'inventory_view'
        ]
    };

    // Nombres legibles de roles
    const ROLE_DISPLAY_NAMES = {
        'SUPER_ADMIN': 'Super Admin',
        'TENANT_ADMIN': 'Administrador',
        'ADMIN': 'Administrador',
        'ADMINISTRADOR': 'Administrador',
        'GERENTE': 'Gerente',
        'OPERATIONS_MANAGER': 'Jefe de Operaciones',
        'RECEPCIONISTA': 'Recepcionista',
        'MECANICO': 'Mecánico',
        'MECHANIC': 'Mecánico',
        'ACCOUNTING': 'Contabilidad',
        'CONTABILIDAD': 'Contabilidad',
        'INVENTORY_MANAGER': 'Jefe de Almacén',
        'VIEWER': 'Solo Lectura'
    };

    // =======================================================================
    // ESTRUCTURA DEL MENÚ CON PERMISOS REQUERIDOS
    // =======================================================================
    const navItems = [
        {
            type: 'link',
            id: 'inicio',
            label: 'Inicio',
            icon: 'fa-home',
            href: 'manager-taller-inicio.html',
            requiredModule: null  // Visible para todos
        },
        {
            type: 'dropdown',
            id: 'taller',
            label: 'Taller',
            icon: 'fa-wrench',
            requiredModule: 'workorders',  // Necesita acceso a workorders
            items: [
                { label: 'Citas', href: 'manager-taller-citas.html', requiredModule: 'appointments' },
                { label: 'Órdenes', href: 'manager-taller-ordenes-lista.html', requiredModule: 'workorders' },
                { label: 'Historial Unificado', href: 'manager-taller-historial-unificado.html', requiredModule: 'workorders' },
                { label: 'Vehículos', href: 'manager-taller-vehiculos.html', requiredModule: 'vehicles' },
                { label: 'Chat Clientes', href: 'manager-taller-chat.html', requiredModule: 'customers' },
                { label: 'Config. Órdenes', href: 'manager-taller-config-ordenes.html', requiredModule: 'config' }
            ]
        },
        {
            type: 'dropdown',
            id: 'tienda',
            label: 'Tienda',
            icon: 'fa-shopping-cart',
            requiredModule: 'sales',
            items: [
                { label: 'Nueva Venta', href: 'manager-taller-ventas.html', requiredModule: 'sales' },
                { label: 'Historial Ventas', href: 'manager-taller-ventas-historial.html', requiredModule: 'sales' },
                { label: 'Nueva Compra', href: 'manager-taller-compras.html', requiredModule: 'purchases' },
                { label: 'Historial Compras', href: 'manager-taller-compras-historial.html', requiredModule: 'purchases' }
            ]
        },
        {
            type: 'link',
            id: 'caja',
            label: 'Caja',
            icon: 'fa-cash-register',
            href: 'manager-taller-caja.html',
            requiredModule: 'cashregister'
        },
        {
            type: 'dropdown',
            id: 'cuentas',
            label: 'Cuentas',
            icon: 'fa-file-invoice-dollar',
            requiredModule: 'invoices',
            items: [
                { label: 'Facturas', href: 'manager-taller-facturas.html', requiredModule: 'invoices' },
                { label: 'Pendientes Facturar', href: 'manager-taller-facturas-pendientes.html', requiredModule: 'invoices' },
                { label: 'Cuentas Corrientes', href: 'manager-taller-cuentas-corrientes.html', requiredModule: 'invoices' },
                { label: 'Configuración', href: 'manager-taller-config-facturas.html', requiredModule: 'config' }
            ]
        },
        {
            type: 'link',
            id: 'inventario',
            label: 'Inventario',
            icon: 'fa-boxes',
            href: 'manager-taller-inventario.html',
            requiredModule: 'inventory'
        },
        {
            type: 'link',
            id: 'trabajadores',
            label: 'Trabajadores',
            icon: 'fa-users-cog',
            href: 'manager-taller-trabajadores.html',
            requiredModule: 'workers'
        },
        {
            type: 'dropdown',
            id: 'contactos',
            label: 'Contactos',
            icon: 'fa-address-book',
            requiredModule: 'customers',
            items: [
                { label: 'Clientes', href: 'manager-taller-clientes.html', requiredModule: 'customers' },
                { label: 'Proveedores', href: 'manager-taller-proveedores.html', requiredModule: 'suppliers' }
            ]
        },
        {
            type: 'link',
            id: 'fidelizacion',
            label: 'Fidelización',
            icon: 'fa-gift',
            href: 'manager-taller-fidelizacion.html',
            requiredModule: 'fidelization'
        },
        {
            type: 'link',
            id: 'marketplace',
            label: 'Marketplace',
            icon: 'fa-store',
            href: 'manager-taller-marketplace.html',
            requiredModule: 'marketplace'
        },
        {
            type: 'dropdown',
            id: 'marketing',
            label: 'Marketing',
            icon: 'fa-bullhorn',
            requiredModule: 'marketing',
            items: [
                { label: 'Email Automations', href: 'manager-marketing-email.html', requiredModule: 'marketing' }
            ]
        },
        {
            type: 'dropdown',
            id: 'configuracion',
            label: 'Configuración',
            icon: 'fa-cog',
            requiredModule: 'config',
            items: [
                { label: 'General', href: 'manager-taller-configuracion.html', requiredModule: 'config' },
                { label: 'Accesos', href: 'manager-admin-accesos.html', requiredModule: 'access' },
                { label: 'Sucursales', href: 'manager-taller-sucursales.html', requiredModule: 'config' },
                { label: 'Suscripción', href: 'manager-taller-billing.html', requiredModule: 'config' }
            ]
        }
    ];

    // =======================================================================
    // OBTENER INFO DE USUARIO Y ROLES
    // =======================================================================
    function getUserInfo() {
        let userInfo = {};
        let userRoles = [];

        try {
            const session = JSON.parse(localStorage.getItem('versa_session_v1') || 'null');
            if (session && session.user) {
                userInfo = session.user;

                // El rol puede venir de varias fuentes:
                // 1. session.user.roles (array de objetos con nombre/display_name)
                // 2. session.user.role (string)
                // 3. session.user.tipo (string legacy)

                if (session.user.roles && Array.isArray(session.user.roles)) {
                    userRoles = session.user.roles.map(r => {
                        // Puede ser string o objeto
                        if (typeof r === 'string') return r.toUpperCase();
                        return (r.nombre || r.name || '').toUpperCase();
                    }).filter(r => r);
                } else if (session.user.role) {
                    userRoles = [session.user.role.toUpperCase()];
                } else if (session.user.tipo) {
                    // Mapear 'admin' a 'TENANT_ADMIN' para compatibilidad
                    const tipo = session.user.tipo.toUpperCase();
                    if (tipo === 'ADMIN') {
                        userRoles = ['TENANT_ADMIN'];
                    } else {
                        userRoles = [tipo];
                    }
                }
            } else {
                userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                if (userInfo.tipo) {
                    const tipo = userInfo.tipo.toUpperCase();
                    userRoles = tipo === 'ADMIN' ? ['TENANT_ADMIN'] : [tipo];
                }
            }
        } catch (e) {
            console.error('[Sidebar] Error parsing user info:', e);
        }

        // Si es super admin, asignar ese rol
        if (userInfo.is_super_admin === true) {
            userRoles = ['SUPER_ADMIN'];
        }

        console.log('[Sidebar] User:', userInfo.nombre, '| Roles:', userRoles);
        return { userInfo, userRoles };
    }

    // =======================================================================
    // CALCULAR PERMISOS DEL USUARIO
    // =======================================================================
    function getUserPermissions(roles) {
        const permissions = new Set();

        for (const role of roles) {
            const rolePerms = ROLE_PERMISSIONS[role];
            if (rolePerms) {
                if (rolePerms.includes('*')) {
                    return ['*'];  // Acceso total
                }
                rolePerms.forEach(p => permissions.add(p));
            }
        }

        // Si no encontramos roles válidos, dar permisos mínimos solo si hay sesión
        if (permissions.size === 0) {
            console.warn('[Sidebar] No valid roles found, applying minimal permissions');
            // NO dar permisos por defecto - mostrar solo inicio
        }

        return Array.from(permissions);
    }

    // =======================================================================
    // VERIFICAR SI TIENE ACCESO A UN MÓDULO
    // =======================================================================
    function hasModuleAccess(userPermissions, requiredModule) {
        if (!requiredModule) return true;  // Sin requisito
        if (userPermissions.includes('*')) return true;  // Super admin

        // Verificar acceso completo
        if (userPermissions.includes(requiredModule)) return true;

        // Verificar acceso de solo lectura
        if (userPermissions.includes(requiredModule + '_view')) return true;

        return false;
    }

    // =======================================================================
    // OBTENER NOMBRE DE ROL PARA MOSTRAR
    // =======================================================================
    function getRoleDisplayName(roles) {
        if (!roles || roles.length === 0) return 'Usuario';

        // Buscar el primer rol con nombre conocido
        for (const role of roles) {
            const displayName = ROLE_DISPLAY_NAMES[role];
            if (displayName) return displayName;
        }

        // Si no encontramos, mostrar el primer rol formateado
        return roles[0].charAt(0) + roles[0].slice(1).toLowerCase();
    }

    // =======================================================================
    // HELPERS
    // =======================================================================
    function isActiveDropdown(dropdown) {
        return dropdown.items && dropdown.items.some(item => item.href === currentPage);
    }

    function isActiveItem(href) {
        return href === currentPage;
    }

    // =======================================================================
    // GENERAR SIDEBAR CON FILTRADO
    // =======================================================================
    function generateSidebar() {
        const sidebarEl = document.getElementById('sidebar');
        if (!sidebarEl) return;

        // Obtener info del usuario y roles
        const { userInfo, userRoles } = getUserInfo();
        const userPermissions = getUserPermissions(userRoles);

        console.log('[Sidebar] User permissions:', userPermissions);

        const userName = userInfo.nombre || 'Usuario';
        const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const userRoleDisplay = getRoleDisplayName(userRoles);  // Mostrar rol REAL

        let navHTML = '';
        let visibleItemsCount = 0;

        navItems.forEach(item => {
            // Verificar si tiene acceso al módulo principal
            if (!hasModuleAccess(userPermissions, item.requiredModule)) {
                return;  // No mostrar
            }

            if (item.type === 'link') {
                visibleItemsCount++;
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
                // Filtrar subitems que tiene acceso
                const visibleSubitems = item.items.filter(subItem =>
                    hasModuleAccess(userPermissions, subItem.requiredModule)
                );

                // Si no hay subitems visibles, no mostrar el dropdown
                if (visibleSubitems.length === 0) {
                    return;
                }

                visibleItemsCount++;
                const isActive = isActiveDropdown(item);
                const parentActiveClass = isActive
                    ? 'bg-[var(--brand-orange)] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#282e39]';
                const arrowIcon = isActive ? 'fa-chevron-up' : 'fa-chevron-down';
                const submenuClass = isActive ? 'flex' : 'hidden';

                let submenuHTML = '';
                visibleSubitems.forEach(subItem => {
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

        console.log('[Sidebar] Visible items:', visibleItemsCount);

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
                            <span class="text-gray-500 text-xs truncate" id="user-role">${userRoleDisplay}</span>
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

        setupSidebarToggle();
        setupLogout();
    }

    // Toggle submenus
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

    function setupLogout() {
        const logoutBtn = document.querySelector('[data-logout]');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('versa_session_v1');
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                window.location.href = 'login.html';
            });
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', generateSidebar);
    } else {
        generateSidebar();
    }
})();
