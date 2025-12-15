/**
 * Head Manager - Inyección dinámica de elementos comunes del <head>
 * 
 * Este script se encarga de inyectar de forma consistente todos los recursos
 * comunes necesarios para las páginas del panel de gestión (manager-taller-*).
 * 
 * USO:
 * En cada archivo HTML, incluir al inicio del <head>:
 * <script src="/head-manager.js" data-page-title="Mi Página - Goversa"></script>
 * 
 * ATRIBUTOS:
 * - data-page-title: Título de la página (requerido)
 * - data-no-guard: Si está presente, no incluye guard.js (para páginas públicas)
 * - data-no-sucursal: Si está presente, no incluye sucursal-selector.css
 * - data-tailwind-config: Si está presente, indica que la página tiene config custom
 */

(function () {
    'use strict';

    // Obtener el script actual y sus atributos
    const currentScript = document.currentScript;
    const pageTitle = currentScript?.getAttribute('data-page-title') || 'Goversa Manager';
    const noGuard = currentScript?.hasAttribute('data-no-guard') || false;
    const noSucursal = currentScript?.hasAttribute('data-no-sucursal') || false;

    // Función para añadir un elemento al head
    function addToHead(element) {
        document.head.appendChild(element);
    }

    // Función para crear link element
    function createLink(rel, href, options = {}) {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        if (options.crossorigin) link.crossOrigin = options.crossorigin;
        if (options.type) link.type = options.type;
        return link;
    }

    // Función para crear script element
    function createScript(src, options = {}) {
        const script = document.createElement('script');
        script.src = src;
        if (options.type) script.type = options.type;
        if (options.async) script.async = options.async;
        return script;
    }

    // Función para crear meta element
    function createMeta(name, content, isCharset = false) {
        const meta = document.createElement('meta');
        if (isCharset) {
            meta.setAttribute('charset', content);
        } else {
            meta.name = name;
            meta.content = content;
        }
        return meta;
    }

    // =============================================
    // INYECCIÓN DE ELEMENTOS COMUNES
    // =============================================

    // 1. Meta tags básicos
    addToHead(createMeta('', 'UTF-8', true));
    addToHead(createMeta('viewport', 'width=device-width, initial-scale=1.0'));

    // 2. Título de la página
    const title = document.createElement('title');
    title.textContent = pageTitle;
    addToHead(title);

    // 3. Favicon
    addToHead(createLink('icon', 'assets/favicon.png', { type: 'image/png' }));

    // 4. Google Fonts - Preconnect
    addToHead(createLink('preconnect', 'https://fonts.googleapis.com'));
    const preconnectGstatic = createLink('preconnect', 'https://fonts.gstatic.com');
    preconnectGstatic.crossOrigin = '';
    addToHead(preconnectGstatic);

    // 5. Google Fonts - Montserrat
    addToHead(createLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap'));

    // 6. Google Fonts - Material Symbols
    addToHead(createLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'));

    // 7. Font Awesome (CDN)
    addToHead(createLink('stylesheet', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'));

    // 8. Tailwind CSS (CDN)
    addToHead(createScript('https://cdn.tailwindcss.com'));

    // 9. Guard.js (autenticación) - opcional
    if (!noGuard) {
        addToHead(createScript('/guard.js'));
    }

    // 10. Manager CSS (estilos globales del panel)
    addToHead(createLink('stylesheet', 'manager.css'));

    // 11. Sucursal Selector CSS - opcional
    if (!noSucursal) {
        addToHead(createLink('stylesheet', 'styles/sucursal-selector.css'));
    }

    // Log para debugging (eliminar en producción)
    console.log(`[Head Manager] Recursos comunes inyectados para: ${pageTitle}`);

})();
