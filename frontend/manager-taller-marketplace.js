/**
 * Manager Taller - Marketplace Configuration
 * Handles all marketplace admin functionality
 */

import { requireAuth, clearSession, redirectToLogin } from '/auth.js';
import * as marketplaceAdmin from '/services/marketplace-admin-service.js';
import api from '/services/api-client.js';

// Global state
let currentSucursalId = null;
let currentListing = null;
let catalogoServicios = [];
let fotosArray = [];

// =============================================
// INITIALIZATION
// =============================================

async function init() {
    try {
        const user = await requireAuth();
        if (!user) {
            hidePageLoader();
            return;
        }

        // Update user info in sidebar
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');
        const userAvatar = document.getElementById('user-avatar');

        if (userName) userName.textContent = user.nombre || 'Usuario';
        if (userRole) userRole.textContent = user.rol || 'admin';
        if (userAvatar && user.nombre) {
            const initials = user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2);
            userAvatar.textContent = initials.toUpperCase();
        }

        // Load sucursales selector
        await loadSucursalSelector();

        // Note: loadCatalogoServicios is called after we know we have a valid sucursal/tenant connection
        // but effectively it's independent, so we can call it here too.
        await loadCatalogoServicios();

        hidePageLoader();
    } catch (error) {
        console.error('Error en init:', error);
        hidePageLoader();
    }
}

function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
}

function showPageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.remove('hidden');
}

// =============================================
// SUCURSAL SELECTOR
// =============================================

async function loadSucursalSelector() {
    const container = document.getElementById('sucursal-container');

    try {
        // Try to use the centralized API client to fetch sucursales
        // This handles the token correctly from versa_session_v1
        const response = await api.get('/api/sucursales');

        // api-client returns the response object, data is in response.data
        const data = response.data;
        const sucursales = data.data || data.sucursales || (Array.isArray(data) ? data : []);

        if (!sucursales || sucursales.length === 0) {
            container.innerHTML = '<span class="text-[#9da6b9]">No hay sucursales disponibles</span>';
            return;
        }

        // Create select
        const select = document.createElement('select');
        select.id = 'sucursal-select';
        select.className = 'bg-[#111318] text-white border-none font-medium text-sm cursor-pointer focus:outline-none';

        sucursales.forEach(suc => {
            const option = document.createElement('option');
            option.value = suc.id || suc.id_sucursal;
            option.textContent = suc.nombre;
            select.appendChild(option);
        });

        container.innerHTML = '';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[var(--brand-orange)]';
        icon.textContent = 'store';
        container.appendChild(icon);
        container.appendChild(select);

        // Set current sucursal
        currentSucursalId = select.value;

        // On change, reload data
        select.addEventListener('change', async (e) => {
            currentSucursalId = e.target.value;
            await loadMarketplaceData();
        });

        // Load initial data
        await loadMarketplaceData();

        // Setup drag & drop for photos
        setupDragAndDrop();

    } catch (error) {
        console.error('Error loading sucursal selector:', error);

        // If unauthorized, api-client might handle it, but just in case:
        if (error.response && error.response.status === 401) {
            redirectToLogin();
            return;
        }

        container.innerHTML = '<span class="text-red-500">Error cargando sucursales</span>';
    }
}

// =============================================
// LOAD MARKETPLACE DATA
// =============================================

async function loadMarketplaceData() {
    if (!currentSucursalId) return;

    try {
        // Get listing data
        const response = await marketplaceAdmin.getListingBySucursal(currentSucursalId);
        currentListing = response?.data || null;

        // Populate Tab 1: Perfil
        populatePerfilTab();

        // Load Tab 2: Servicios
        await loadServiciosSucursal();

        // Load Tab 3: Promociones
        await loadPromociones();

        // Load Tab 5: Reseñas
        await loadResenas();

        // Load Tab 4: Already populated, just need to set values
        populateReglasTab();

    } catch (error) {
        console.error('Error loading marketplace data:', error);
        // If listing doesn't exist, that's OK
        currentListing = null;
        populatePerfilTab();
    }
}

// =============================================
// TAB 1: PERFIL PÚBLICO
// =============================================

function populatePerfilTab() {
    // Set initial values
    document.getElementById('marketplace-activo').checked = currentListing?.activo || false;
    document.getElementById('titulo-publico').value = currentListing?.titulo_publico || '';
    document.getElementById('descripcion-publica').value = currentListing?.descripcion_publica || '';
    document.getElementById('telefono-publico').value = currentListing?.telefono_publico || '';
    document.getElementById('whatsapp-publico').value = currentListing?.whatsapp_publico || '';
    document.getElementById('email-publico').value = currentListing?.email_publico || '';
    document.getElementById('lat').value = currentListing?.lat || '';
    document.getElementById('lng').value = currentListing?.lng || '';
    document.getElementById('politica-cancelacion').value = currentListing?.politica_cancelacion || '';

    // Load photos
    fotosArray = [];
    try {
        if (currentListing?.fotos_json) {
            if (typeof currentListing.fotos_json === 'string') {
                fotosArray = JSON.parse(currentListing.fotos_json);
            } else if (Array.isArray(currentListing.fotos_json)) {
                fotosArray = currentListing.fotos_json;
            }
        }
    } catch (e) {
        console.error('Error parsing fotos_json:', e);
        fotosArray = [];
    }

    renderFotos();
}

function renderFotos() {
    const container = document.getElementById('fotos-container');

    if (fotosArray.length === 0) {
        container.innerHTML = '<p class="text-[#9da6b9] text-sm italic">No hay fotos agregadas todavía</p>';
        return;
    }

    // Guardar fotos en window para acceso desde onclick
    window._fotosArray = fotosArray;

    container.innerHTML = fotosArray.map((url, index) => `
    <div class="photo-preview" onclick="window.ampliarFoto(${index})" title="Clic para ampliar">
      <img src="${url}" alt="Foto ${index + 1}" onerror="this.src='https://via.placeholder.com/100?text=Error'">
      <button class="photo-preview-remove" onclick="event.stopPropagation(); eliminarFoto(${index})" title="Eliminar foto">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

// Ampliar foto en modal lightbox
window.ampliarFoto = function (index) {
    const url = window._fotosArray[index];
    if (!url) return;

    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay animate-fade-in';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <img src="${url}" alt="Foto ampliada">
        <button class="absolute top-4 right-4 text-white hover:text-[var(--brand-orange)] transition-colors p-2 bg-black/50 rounded-full" onclick="this.parentElement.remove(); event.stopPropagation();">
            <span class="material-symbols-outlined" style="font-size: 32px;">close</span>
        </button>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            ${window._fotosArray.map((_, i) => `
                <button class="w-2 h-2 rounded-full ${i === index ? 'bg-[var(--brand-orange)]' : 'bg-white/50'} transition-colors"
                        onclick="event.stopPropagation(); this.closest('.photo-modal-overlay').remove(); window.ampliarFoto(${i});"></button>
            `).join('')}
        </div>
    `;
    document.body.appendChild(modal);
};

// Manejar subida de archivos desde ordenador
window.handleFileUpload = async function (event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    const MAX_FOTOS = 6;

    if (fotosArray.length + files.length > MAX_FOTOS) {
        showToast(`Máximo ${MAX_FOTOS} fotos permitidas`, 'error');
        return;
    }

    for (const file of files) {
        // Validar tipo
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showToast(`${file.name}: Formato no soportado`, 'error');
            continue;
        }

        // Validar tamaño
        if (file.size > MAX_SIZE) {
            showToast(`${file.name}: Excede 2 MB`, 'error');
            continue;
        }

        // Convertir a base64
        try {
            const base64 = await fileToBase64(file);
            fotosArray.push(base64);
            showToast(`${file.name} agregada`, 'success');
        } catch (err) {
            console.error('Error converting file:', err);
            showToast(`Error procesando ${file.name}`, 'error');
        }
    }

    renderFotos();
    event.target.value = ''; // Reset input
};

// Convertir archivo a base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Drag & drop handlers
function setupDragAndDrop() {
    const zone = document.getElementById('foto-upload-zone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');

        const input = document.getElementById('foto-file-input');
        if (input && e.dataTransfer.files.length > 0) {
            input.files = e.dataTransfer.files;
            handleFileUpload({ target: input });
        }
    });
}

window.agregarFoto = function () {
    const input = document.getElementById('nueva-foto-url');
    const url = input.value.trim();

    if (!url) {
        showToast('Por favor ingresa una URL', 'error');
        return;
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        showToast('URL inválida', 'error');
        return;
    }

    // Check max fotos
    if (fotosArray.length >= 6) {
        showToast('Máximo 6 fotos permitidas', 'error');
        return;
    }

    fotosArray.push(url);
    input.value = '';
    renderFotos();
    showToast('Foto agregada', 'success');
}

window.eliminarFoto = function (index) {
    fotosArray.splice(index, 1);
    renderFotos();
    showToast('Foto eliminada', 'info');
}

window.guardarPerfil = async function () {
    if (!currentSucursalId) {
        showToast('Selecciona una sucursal', 'error');
        return;
    }

    const button = event.target;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border mr-2"></span>Guardando...';

    try {
        const listingData = {
            id_sucursal: parseInt(currentSucursalId),
            activo: document.getElementById('marketplace-activo').checked,
            titulo_publico: document.getElementById('titulo-publico').value.trim() || null,
            descripcion_publica: document.getElementById('descripcion-publica').value.trim() || null,
            telefono_publico: document.getElementById('telefono-publico').value.trim() || null,
            whatsapp_publico: document.getElementById('whatsapp-publico').value.trim() || null,
            email_publico: document.getElementById('email-publico').value.trim() || null,
            lat: parseFloat(document.getElementById('lat').value) || null,
            lng: parseFloat(document.getElementById('lng').value) || null,
            fotos_json: JSON.stringify(fotosArray),
            politica_cancelacion: document.getElementById('politica-cancelacion').value.trim() || null,
            reserva_online_activa: document.getElementById('reserva-online-activa')?.checked !== false,
            min_horas_anticipacion: parseInt(document.getElementById('min-horas-anticipacion')?.value) || 2,
            cancelacion_horas_limite: parseInt(document.getElementById('cancelacion-horas-limite')?.value) || 24,
            deposito_activo: false,
            deposito_tipo: null,
            deposito_valor: null,
            horario_json: JSON.stringify({
                lunes: {
                    activo: document.getElementById('horario-lunes-activo')?.checked ?? true,
                    inicio: document.getElementById('horario-lunes-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-lunes-fin')?.value || '19:00'
                },
                martes: {
                    activo: document.getElementById('horario-martes-activo')?.checked ?? true,
                    inicio: document.getElementById('horario-martes-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-martes-fin')?.value || '19:00'
                },
                miercoles: {
                    activo: document.getElementById('horario-miercoles-activo')?.checked ?? true,
                    inicio: document.getElementById('horario-miercoles-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-miercoles-fin')?.value || '19:00'
                },
                jueves: {
                    activo: document.getElementById('horario-jueves-activo')?.checked ?? true,
                    inicio: document.getElementById('horario-jueves-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-jueves-fin')?.value || '19:00'
                },
                viernes: {
                    activo: document.getElementById('horario-viernes-activo')?.checked ?? true,
                    inicio: document.getElementById('horario-viernes-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-viernes-fin')?.value || '19:00'
                },
                sabado: {
                    activo: document.getElementById('horario-sabado-activo')?.checked ?? false,
                    inicio: document.getElementById('horario-sabado-inicio')?.value || '09:00',
                    fin: document.getElementById('horario-sabado-fin')?.value || '14:00'
                },
                domingo: {
                    activo: document.getElementById('horario-domingo-activo')?.checked ?? false,
                    inicio: document.getElementById('horario-domingo-inicio')?.value || '10:00',
                    fin: document.getElementById('horario-domingo-fin')?.value || '14:00'
                }
            }),
            horario_texto: document.getElementById('horario-texto-publico')?.value?.trim() || null
        };

        const response = await marketplaceAdmin.updateListing(listingData);

        if (response.ok) {
            currentListing = response.data;
            showToast('✓ Perfil guardado exitosamente', 'success');
        } else {
            throw new Error(response.error || 'Error al guardar');
        }

    } catch (error) {
        console.error('Error guardando perfil:', error);
        showToast('Error al guardar perfil: ' + (error.message || 'Error desconocido'), 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

window.verComoCliente = function () {
    if (!currentSucursalId) {
        showToast('Selecciona una sucursal', 'error');
        return;
    }

    const url = `/marketplace-taller.html?id_sucursal=${currentSucursalId}&preview=1`;
    window.open(url, '_blank');
}

// =============================================
// TAB 2: SERVICIOS
// =============================================

async function loadCatalogoServicios() {
    try {
        const response = await marketplaceAdmin.getServiciosCatalogo();
        const catalogo = response.data || {};

        // Flatten catalogo to array for easier use
        catalogoServicios = [];
        for (const [categoria, servicios] of Object.entries(catalogo)) {
            servicios.forEach(servicio => {
                catalogoServicios.push({
                    ...servicio,
                    categoria
                });
            });
        }

        // Populate select in modal
        const select = document.getElementById('servicio-catalogo-select');
        if (select && catalogoServicios.length > 0) {
            select.innerHTML = '<option value="">Selecciona un servicio...</option>';

            // Group by category
            const categorias = [...new Set(catalogoServicios.map(s => s.categoria))];
            categorias.forEach(cat => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = cat;

                catalogoServicios.filter(s => s.categoria === cat).forEach(servicio => {
                    const option = document.createElement('option');
                    option.value = servicio.id;
                    option.textContent = servicio.nombre;
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            });
        }

    } catch (error) {
        console.error('Error loading catalogo servicios:', error);
    }
}

async function loadServiciosSucursal() {
    const container = document.getElementById('servicios-lista');

    try {
        // Use admin endpoint to get servicios
        const response = await marketplaceAdmin.getServiciosBySucursal(currentSucursalId);
        const servicios = response.data || [];

        if (servicios.length === 0) {
            container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-[#9da6b9]">
          <i class="fas fa-wrench text-4xl mb-3 opacity-50"></i>
          <p>No hay servicios configurados</p>
          <p class="text-sm mt-1">Agrega servicios para que aparezcan en el marketplace</p>
        </div>
      `;
            return;
        }

        container.innerHTML = servicios.map(servicio => `
      <div class="flex items-center justify-between p-4 bg-[#1a1d24] rounded-lg border border-[#282e39] hover:border-[var(--brand-orange)] transition-colors">
        <div class="flex-1">
          <h4 class="text-white font-medium">${servicio.nombre}</h4>
          <p class="text-sm text-[#9da6b9]">${servicio.categoria || 'General'}</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-white font-bold">${servicio.precio_desde ? 'Desde ' : ''}€${parseFloat(servicio.precio).toFixed(2)}</p>
            <p class="text-sm text-[#9da6b9]">${servicio.duracion_min} min</p>
          </div>
          <button class="text-red-500 hover:text-red-400 transition-colors p-2" 
                  onclick="eliminarServicio(${servicio.id})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    } catch (error) {
        console.error('Error loading servicios:', error);
        container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-[#9da6b9]">
        <i class="fas fa-wrench text-4xl mb-3 opacity-50"></i>
        <p>No hay servicios configurados</p>
      </div>
    `;
    }
}

window.abrirModalNuevoServicio = function () {
    document.getElementById('modal-nuevo-servicio').classList.remove('hidden');
    document.getElementById('modal-nuevo-servicio').classList.add('flex');
}

window.cerrarModalServicio = function () {
    document.getElementById('modal-nuevo-servicio').classList.add('hidden');
    document.getElementById('modal-nuevo-servicio').classList.remove('flex');

    // Reset form
    document.getElementById('servicio-catalogo-select').value = '';
    document.getElementById('servicio-precio').value = '';
    document.getElementById('servicio-duracion').value = '';
    document.getElementById('servicio-precio-desde').checked = false;
}

window.guardarNuevoServicio = async function () {
    const idServicio = document.getElementById('servicio-catalogo-select').value;
    const precio = document.getElementById('servicio-precio').value;
    const duracion = document.getElementById('servicio-duracion').value;
    const precioDesde = document.getElementById('servicio-precio-desde').checked;

    if (!idServicio || !precio || !duracion) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    if (parseFloat(precio) < 0 || parseInt(duracion) <= 0) {
        showToast('Precio y duración deben ser valores válidos', 'error');
        return;
    }

    try {
        const servicioData = {
            id_sucursal: parseInt(currentSucursalId),
            id_servicio: parseInt(idServicio),
            precio: parseFloat(precio),
            duracion_min: parseInt(duracion),
            precio_desde: precioDesde,
            activo: true,
            rank_destacado: 100,
            permite_reserva_online: true
        };

        const response = await marketplaceAdmin.updateServicioSucursal(servicioData);

        if (response.ok) {
            showToast('✓ Servicio agregado', 'success');
            cerrarModalServicio();
            await loadServiciosSucursal();
        } else {
            throw new Error(response.error || 'Error al guardar');
        }

    } catch (error) {
        console.error('Error guardando servicio:', error);
        showToast('Error: ' + (error.message || 'Error desconocido'), 'error');
    }
}

window.eliminarServicio = async function (idServicio) {
    if (!confirm('¿Eliminar este servicio del marketplace?')) return;

    showToast('Función en desarrollo', 'info');
    // TODO: Implement delete endpoint
}

// =============================================
// TAB 3: OFERTAS
// =============================================

async function loadPromociones() {
    const container = document.getElementById('promociones-lista');

    try {
        // Use admin endpoint to get promociones
        const response = await marketplaceAdmin.getPromocionesBySucursal(currentSucursalId);
        const promociones = response.data || [];

        if (promociones.length === 0) {
            container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-12 text-[#9da6b9]">
          <i class="fas fa-tags text-4xl mb-3 opacity-50"></i>
          <p>No hay promociones</p>
          <p class="text-sm mt-1">Crea promociones para atraer más clientes</p>
        </div>
      `;
            return;
        }

        container.innerHTML = promociones.map(promo => `
      <div class="p-4 bg-[#1a1d24] rounded-lg border border-[#282e39] hover:border-green-500 transition-colors">
        <div class="flex items-start justify-between mb-2">
          <h4 class="text-white font-medium">${promo.titulo}</h4>
          <span class="px-2 py-1 ${promo.activo ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'} text-xs rounded-full font-medium">
            ${promo.tipo_descuento === 'PORCENTAJE' ? promo.valor_descuento + '%' : '€' + promo.valor_descuento}
          </span>
        </div>
        <p class="text-sm text-[#9da6b9] mb-2">${promo.descripcion || ''}</p>
        <p class="text-xs text-[#9da6b9]">
          <i class="fas fa-calendar mr-1"></i>
          ${new Date(promo.fecha_inicio).toLocaleDateString()} - ${new Date(promo.fecha_fin).toLocaleDateString()}
          ${!promo.activo ? '<span class="ml-2 text-gray-500">(Inactiva)</span>' : ''}
        </p>
      </div>
    `).join('');

    } catch (error) {
        console.error('Error loading promociones:', error);
        container.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-12 text-[#9da6b9]">
        <i class="fas fa-tags text-4xl mb-3 opacity-50"></i>
        <p>No hay promociones</p>
      </div>
    `;
    }
}

window.abrirModalNuevoPromo = function () {
    document.getElementById('modal-nueva-promo').classList.remove('hidden');
    document.getElementById('modal-nueva-promo').classList.add('flex');

    // Set default dates (today and +30 days)
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const future = futureDate.toISOString().split('T')[0];

    document.getElementById('promo-inicio').value = today;
    document.getElementById('promo-fin').value = future;
}

window.cerrarModalPromo = function () {
    document.getElementById('modal-nueva-promo').classList.add('hidden');
    document.getElementById('modal-nueva-promo').classList.remove('flex');

    // Reset form
    document.getElementById('promo-titulo').value = '';
    document.getElementById('promo-descripcion').value = '';
    document.getElementById('promo-tipo').value = 'PORCENTAJE';
    document.getElementById('promo-valor').value = '';
    document.getElementById('promo-inicio').value = '';
    document.getElementById('promo-fin').value = '';
}

window.guardarNuevaPromo = async function () {
    const titulo = document.getElementById('promo-titulo').value.trim();
    const descripcion = document.getElementById('promo-descripcion').value.trim();
    const tipo = document.getElementById('promo-tipo').value;
    const valor = document.getElementById('promo-valor').value;
    const inicio = document.getElementById('promo-inicio').value;
    const fin = document.getElementById('promo-fin').value;

    if (!titulo || !valor || !inicio || !fin) {
        showToast('Completa todos los campos obligatorios', 'error');
        return;
    }

    if (parseFloat(valor) <= 0) {
        showToast('El valor debe ser mayor a 0', 'error');
        return;
    }

    try {
        const promoData = {
            id_sucursal: parseInt(currentSucursalId),
            id_servicio: null, // General promo
            titulo,
            descripcion,
            tipo_descuento: tipo,
            valor_descuento: parseFloat(valor),
            fecha_inicio: inicio,
            fecha_fin: fin,
            dias_semana_json: null,
            horas_json: null,
            cupo_total: null,
            activo: true
        };

        const response = await marketplaceAdmin.createPromocion(promoData);

        if (response.ok) {
            showToast('✓ Promoción creada', 'success');
            cerrarModalPromo();
            await loadPromociones();
        } else {
            throw new Error(response.error || 'Error al crear promoción');
        }

    } catch (error) {
        console.error('Error creando promoción:', error);
        showToast('Error: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// =============================================
// TAB 4: REGLAS
// =============================================

function populateReglasTab() {
    document.getElementById('reserva-online-activa').checked = currentListing?.reserva_online_activa !== false;
    document.getElementById('min-horas-anticipacion').value = currentListing?.min_horas_anticipacion || 2;
    document.getElementById('cancelacion-horas-limite').value = currentListing?.cancelacion_horas_limite || 24;

    // Load schedule data
    let horario = {};
    try {
        if (currentListing?.horario_json) {
            if (typeof currentListing.horario_json === 'string') {
                horario = JSON.parse(currentListing.horario_json);
            } else {
                horario = currentListing.horario_json;
            }
        }
    } catch (e) {
        console.error('Error parsing horario_json:', e);
    }

    // Populate schedule inputs
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    dias.forEach(dia => {
        const diaData = horario[dia] || { activo: dia !== 'sabado' && dia !== 'domingo', inicio: '09:00', fin: '19:00' };
        const activoEl = document.getElementById(`horario-${dia}-activo`);
        const inicioEl = document.getElementById(`horario-${dia}-inicio`);
        const finEl = document.getElementById(`horario-${dia}-fin`);

        if (activoEl) activoEl.checked = diaData.activo;
        if (inicioEl) inicioEl.value = diaData.inicio || '09:00';
        if (finEl) finEl.value = diaData.fin || '19:00';
    });

    // Load horario text
    const horarioTextoEl = document.getElementById('horario-texto-publico');
    if (horarioTextoEl) {
        horarioTextoEl.value = currentListing?.horario_texto || '';
    }
}

window.guardarReglas = async function () {
    // This will be saved together with perfil
    await guardarPerfil();
}

// =============================================
// TAB 5: RESEÑAS
// =============================================

async function loadResenas() {
    const container = document.getElementById('resenas-container');

    try {
        const response = await marketplaceAdmin.getResenasBySucursal(currentSucursalId);
        const resenas = response.data || [];

        // Inicializar array global para fotos
        window.resenasPhotos = [];

        if (resenas.length === 0) {
            container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-[#9da6b9]">
          <i class="fas fa-star text-4xl mb-3 opacity-50"></i>
          <p>No hay reseñas aún</p>
        </div>
      `;
            return;
        }

        container.innerHTML = resenas.map((resena, idx) => {
            // Procesar fotos
            let fotos = resena.fotos || resena.fotos_json || [];
            if (typeof fotos === 'string') {
                try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; }
            }

            // Guardar en global para acceso seguro
            window.resenasPhotos[idx] = fotos;

            return `
            <div class="bg-[#1a1d24] border border-[#282e39] rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="text-white font-bold text-sm">${resena.cliente_nombre || 'Cliente'}</h4>
                        <p class="text-xs text-[#9da6b9]">${new Date(resena.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div class="flex text-yellow-500">
                        ${Array(5).fill(0).map((_, i) => `
                            <span class="material-symbols-outlined" style="font-size: 18px; font-variation-settings: 'FILL' ${i < resena.rating ? 1 : 0};">star</span>
                        `).join('')}
                    </div>
                </div>
                
                <p class="text-gray-300 text-sm mb-3">${resena.comentario || ''}</p>
                
                ${fotos.length > 0 ? `
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${fotos.map((_, fotoIdx) => `
                            <img src="${window.resenasPhotos[idx][fotoIdx]}" 
                                 alt="Foto reseña" 
                                 class="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-[#282e39]"
                                 onclick="window.showFotoModal(window.resenasPhotos[${idx}][${fotoIdx}])">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando reseñas:', error);
        container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-[#9da6b9]">
            <i class="fas fa-exclamation-triangle text-4xl mb-3 opacity-50"></i>
            <p>Error al cargar las reseñas</p>
        </div>
        `;
    }
}

// Modal helper para fotos
window.showFotoModal = function (fotoUrl) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 animate-fade-in';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <img src="${fotoUrl}" alt="Foto" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl">
        <button class="absolute top-4 right-4 text-white hover:text-[var(--brand-orange)] transition-colors p-2 bg-black/50 rounded-full" onclick="this.parentElement.remove(); event.stopPropagation();">
            <span class="material-symbols-outlined" style="font-size: 32px;">close</span>
        </button>
    `;
    document.body.appendChild(modal);
};

// =============================================
// UTILITIES
// =============================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
// START
// =============================================

document.addEventListener('DOMContentLoaded', init);
