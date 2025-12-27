/**
 * VERSA - PASO 5: Portal Cliente
 * Componente UI compartido para visualización de citas
 * Usado tanto en Manager como en Portal Cliente
 */

/**
 * Configuración del componente
 */
const ESTADOS_CONFIG = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: 'schedule' },
    confirmada: { label: 'Confirmada', color: 'bg-blue-500', icon: 'check_circle' },
    en_progreso: { label: 'En Progreso', color: 'bg-purple-500', icon: 'autorenew' },
    completada: { label: 'Completada', color: 'bg-green-500', icon: 'task_alt' },
    cancelada: { label: 'Cancelada', color: 'bg-red-500', icon: 'cancel' },
    no_asistio: { label: 'No asistió', color: 'bg-gray-500', icon: 'person_off' }
};

/**
 * Formatear fecha para display
 */
export function formatFecha(fechaStr) {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Formatear hora para display
 */
export function formatHora(fechaStr) {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatear fecha corta
 */
export function formatFechaCorta(fechaStr) {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Determinar si una cita es próxima o pasada
 */
export function esCitaProxima(fechaHora) {
    return new Date(fechaHora) > new Date();
}

/**
 * Obtener configuración de estado
 */
export function getEstadoConfig(estado) {
    return ESTADOS_CONFIG[estado] || ESTADOS_CONFIG.pendiente;
}

/**
 * Renderizar badge de estado
 */
export function renderEstadoBadge(estado) {
    const config = getEstadoConfig(estado);
    const accentColor = config.color.replace('bg-', 'text-');
    return `
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-sm">
            <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 ${config.color}"></span>
            </span>
            <span class="${accentColor} text-[10px] font-extrabold uppercase tracking-widest leading-none">${config.label}</span>
        </div>
    `;
}

/**
 * Renderizar tarjeta de cita
 * @param {Object} cita - Datos de la cita
 * @param {string} mode - 'staff' o 'cliente'
 * @param {Function} onAction - Callback para acciones
 */
export function renderCitaCard(cita, mode = 'cliente', onAction = null) {
    const esProxima = esCitaProxima(cita.fecha_hora);
    const esCompletada = ['completada', 'completado'].includes(cita.estado);
    const esCancelada = ['cancelada', 'no_asistio'].includes(cita.estado);
    const d = new Date(cita.fecha_hora);
    const dia = d.getDate();
    const mesCorto = d.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();

    // Textos seguros (sin undefined)
    const tallerNombre = cita.sucursal?.nombre || 'Taller Versa';
    const tallerDireccion = cita.sucursal?.direccion || 'Ubicación central';
    const servicioNombre = cita.servicio?.nombre || 'Servicio General';
    const vehiculoInfo = cita.vehiculo ? `${cita.vehiculo.matricula} ${cita.vehiculo.marca ? `- ${cita.vehiculo.marca}` : ''}` : 'Vehículo no especificado';
    const precio = cita.servicio?.precio ? `${parseFloat(cita.servicio.precio).toFixed(2)}€` : null;

    // Determinar acciones disponibles según modo
    let accionesHtml = '';

    if (mode === 'cliente') {
        if (esCompletada) {
            accionesHtml = `
                <button onclick="window.citasUI.handleAction('resena', ${cita.id})" 
                        class="w-full mt-4 py-3.5 bg-gradient-to-r from-[#f56300] to-[#ff8c42] text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 group">
                    <span class="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform text-white">star</span>
                    <span class="text-white">${cita.tiene_resena ? 'Ver tu Reseña' : 'Dejar Reseña'}</span>
                </button>
            `;
        } else if (esProxima && cita.puede_cancelar && !esCancelada) {
            accionesHtml = `
                <div class="grid grid-cols-2 gap-3 mt-4">
                    <button onclick="window.citasUI.handleAction('reprogramar', ${cita.id})" 
                            class="px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl font-semibold hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">edit_calendar</span>
                        Reprogramar
                    </button>
                    <button onclick="window.citasUI.handleAction('cancelar', ${cita.id})"
                            class="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">cancel</span>
                        Cancelar
                    </button>
                </div>
            `;
        }
    } else if (mode === 'staff') {
        accionesHtml = `
            <button onclick="window.citasUI.handleAction('ver', ${cita.id})" 
                    class="w-full mt-4 py-3 bg-[#282e39] text-white rounded-xl font-medium hover:bg-[#3a4150] transition-colors border border-white/5">
                Ver detalles completos
            </button>
        `;
    }

    return `
        <div class="group relative bg-gradient-to-br from-[#1e222b] to-[#14171d] border border-white/5 rounded-2xl p-5 hover:border-[#f56300]/30 transition-all duration-300 shadow-xl ${!esProxima ? 'opacity-80 grayscale-[0.3] hover:grayscale-0' : ''}">
            <!-- Header: Fecha y Estado -->
            <div class="flex items-start justify-between mb-5">
                <div class="flex items-center gap-4">
                    <!-- Date Badge -->
                    <div class="flex flex-col items-center justify-center w-14 h-14 bg-[#f56300]/10 border border-[#f56300]/20 rounded-2xl group-hover:scale-105 transition-transform duration-300">
                        <span class="text-[10px] font-bold text-[#f56300] uppercase tracking-wider">${mesCorto}</span>
                        <span class="text-xl font-black text-white leading-none mt-0.5">${dia}</span>
                    </div>
                    <div>
                        <h3 class="text-white font-bold text-lg leading-tight mb-1">${tallerNombre}</h3>
                        <div class="flex items-center gap-1.5 text-gray-200 font-bold bg-white/5 w-fit px-2 py-0.5 rounded-lg border border-white/5">
                            <span class="material-symbols-outlined text-[#f56300] text-[18px]">schedule</span>
                            ${formatHora(cita.fecha_hora)}
                        </div>
                    </div>
                </div>
                ${renderEstadoBadge(cita.estado)}
            </div>
            
            <!-- Cuerpo Info -->
            <div class="space-y-3 mb-2 bg-black/20 rounded-xl p-4 border border-white/5">
                <!-- Servicio -->
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2 text-gray-300">
                        <span class="material-symbols-outlined text-[#f56300]" style="font-size: 18px;">build_circle</span>
                        <span class="font-medium text-sm">${servicioNombre}</span>
                    </div>
                    ${precio ? `<span class="text-white font-bold bg-white/10 px-2 py-0.5 rounded text-xs">${precio}</span>` : ''}
                </div>
                
                <!-- Vehículo -->
                ${cita.vehiculo ? `
                    <div class="flex items-center gap-2 text-gray-400">
                        <span class="material-symbols-outlined text-green-500" style="font-size: 18px;">directions_car</span>
                        <span class="text-sm">${vehiculoInfo}</span>
                    </div>
                ` : ''}

                <!-- Ubicación -->
                <div class="flex items-center gap-2 text-gray-500" title="${tallerDireccion}">
                    <span class="material-symbols-outlined text-blue-500" style="font-size: 18px;">location_on</span>
                    <span class="text-xs truncate max-w-[200px]">${tallerDireccion}</span>
                </div>
                
                <!-- Duración -->
                ${cita.duracion_estimada ? `
                    <div class="flex items-center gap-2 text-gray-500 pt-2 border-t border-white/5 mt-2">
                        <span class="material-symbols-outlined" style="font-size: 16px;">timer</span>
                        <span class="text-xs">Duración estimada: ${cita.duracion_estimada} min</span>
                    </div>
                ` : ''}
            </div>
            
            <!-- Acciones -->
            ${accionesHtml}
        </div>
    `;
}

/**
 * Renderizar lista de citas
 */
export function renderCitasList(citas, mode = 'cliente', containerId = 'citasContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!citas || citas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <span class="material-symbols-outlined text-gray-600" style="font-size: 64px;">event_busy</span>
                <p class="text-gray-400 mt-4">No tienes citas</p>
                ${mode === 'cliente' ? `
                    <a href="/marketplace-busqueda.html" class="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#e05300] transition-colors">
                        Reservar cita
                    </a>
                ` : ''}
            </div>
        `;
        return;
    }

    // Separar próximas y pasadas
    const proximas = citas.filter(c => esCitaProxima(c.fecha_hora));
    const pasadas = citas.filter(c => !esCitaProxima(c.fecha_hora));

    let html = '';

    if (proximas.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">upcoming</span>
                    Próximas citas (${proximas.length})
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${proximas.map(c => renderCitaCard(c, mode)).join('')}
                </div>
            </div>
        `;
    }

    if (pasadas.length > 0) {
        html += `
            <div>
                <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-500">history</span>
                    Citas anteriores (${pasadas.length})
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${pasadas.slice(0, 6).map(c => renderCitaCard(c, mode)).join('')}
                </div>
                ${pasadas.length > 6 ? `
                    <button onclick="window.citasUI.showAllPast()" class="mt-4 text-primary hover:underline text-sm">
                        Ver todas (${pasadas.length})
                    </button>
                ` : ''}
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Renderizar modal de cancelación
 */
export function renderCancelModal(cita) {
    return `
        <div id="cancelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div class="bg-[#111318] border border-[#282e39] rounded-2xl p-6 w-full max-w-md">
                <div class="text-center mb-6">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-4">
                        <span class="material-symbols-outlined text-red-500" style="font-size: 32px;">warning</span>
                    </div>
                    <h2 class="text-xl font-bold text-white">¿Cancelar cita?</h2>
                    <p class="text-gray-400 mt-2">Esta acción no se puede deshacer</p>
                </div>
                
                <div class="bg-[#1a1d24] rounded-lg p-4 mb-6">
                    <p class="text-white font-semibold">${formatFecha(cita.fecha_hora)}</p>
                    <p class="text-primary">${formatHora(cita.fecha_hora)}</p>
                    ${cita.sucursal ? `<p class="text-gray-400 text-sm mt-1">${cita.sucursal.nombre}</p>` : ''}
                </div>
                
                <div class="flex gap-3">
                    <button onclick="window.citasUI.confirmCancel(${cita.id})" 
                            class="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors">
                        Sí, cancelar
                    </button>
                    <button onclick="window.citasUI.closeModal()"
                            class="flex-1 px-4 py-3 bg-[#282e39] text-white rounded-lg hover:bg-[#3a4150] transition-colors">
                        No, volver
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderizar modal de reprogramación
 */
export function renderReprogramModal(cita, slots = []) {
    const today = new Date().toISOString().split('T')[0];

    return `
        <div id="reprogramModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div class="bg-[#111318] border border-[#282e39] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-white">Reprogramar cita</h2>
                    <button onclick="window.citasUI.closeModal()" class="text-gray-400 hover:text-white">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div class="bg-[#1a1d24] rounded-lg p-4 mb-6">
                    <p class="text-gray-400 text-sm">Cita actual</p>
                    <p class="text-white font-semibold">${formatFecha(cita.fecha_hora)} - ${formatHora(cita.fecha_hora)}</p>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-white mb-2">Nueva fecha</label>
                        <input type="date" id="reprogramFecha" min="${today}" 
                               class="w-full px-4 py-3 bg-[#1a1d24] border border-[#282e39] rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary"
                               onchange="window.citasUI.loadSlotsForReprogram(${cita.id}, this.value)">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-white mb-2">Nueva hora</label>
                        <div id="reprogramSlotsContainer" class="grid grid-cols-4 gap-2">
                            <p class="col-span-4 text-gray-500 text-sm text-center py-4">Selecciona una fecha primero</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <button id="confirmReprogramBtn" onclick="window.citasUI.confirmReprogram(${cita.id})" disabled
                            class="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-[#e05300] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Confirmar
                    </button>
                    <button onclick="window.citasUI.closeModal()"
                            class="flex-1 px-4 py-3 bg-[#282e39] text-white rounded-lg hover:bg-[#3a4150] transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderizar slots para reprogramación
 */
export function renderReprogramSlots(slots) {
    const container = document.getElementById('reprogramSlotsContainer');
    if (!container) return;

    if (!slots || slots.length === 0) {
        container.innerHTML = '<p class="col-span-4 text-gray-500 text-sm text-center py-4">No hay horarios disponibles</p>';
        return;
    }

    const availableSlots = slots.filter(s => s.disponible);

    if (availableSlots.length === 0) {
        container.innerHTML = '<p class="col-span-4 text-gray-500 text-sm text-center py-4">No hay horarios disponibles para esta fecha</p>';
        return;
    }

    container.innerHTML = availableSlots.map(slot => `
        <button type="button" onclick="window.citasUI.selectReprogramSlot('${slot.hora}')"
                class="reprogram-slot px-3 py-2 bg-[#1a1d24] border border-[#282e39] rounded-lg text-white text-sm hover:border-primary hover:bg-primary/10 transition-colors"
                data-hora="${slot.hora}">
            ${slot.hora}
        </button>
    `).join('');
}

/**
 * Renderizar modal de reseña (crear o editar)
 * @param {Object} cita - Datos de la cita
 * @param {Object} resenaExistente - Reseña existente si es edición (opcional)
 */
export function renderReviewModal(cita, resenaExistente = null) {
    const esEdicion = !!resenaExistente;
    const ratingActual = resenaExistente?.rating || 0;
    const comentarioActual = resenaExistente?.comentario || '';
    const fotosActuales = resenaExistente?.fotos || [];

    return `
        <div id="reviewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in overflow-y-auto backdrop-blur-sm">
            <div class="bg-[#111318] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl transform transition-all scale-100 my-8">
                 <div class="flex items-center justify-between mb-8">
                    <h2 class="text-2xl font-black text-white tracking-tight">${esEdicion ? 'Editar tu Reseña' : '¿Qué tal tu experiencia?'}</h2>
                    <button onclick="window.citasUI.closeModal()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-2xl p-4 mb-6 border border-white/5 shadow-inner">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-[#f56300]/10 rounded-xl flex items-center justify-center border border-[#f56300]/20">
                            <span class="material-symbols-outlined text-[#f56300]">task_alt</span>
                        </div>
                        <div>
                            <p class="text-white font-bold text-lg leading-tight">${cita.servicio?.nombre || 'Servicio Realizado'}</p>
                            <p class="text-gray-400 text-sm mt-0.5">${cita.sucursal?.nombre || 'Taller Versa'} • ${formatFecha(cita.fecha_hora)}</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-8">
                    <!-- Estrellas -->
                    <div class="flex flex-col items-center gap-3">
                        <p class="text-gray-400 font-medium">Toca las estrellas para calificar</p>
                        <div class="flex justify-center gap-3 p-2" id="starRating">
                            ${[1, 2, 3, 4, 5].map(i => `
                                <button type="button" onclick="window.citasUI.setRating(${i})" 
                                        class="review-star ${i <= ratingActual ? 'text-yellow-400 scale-110' : 'text-gray-700'} hover:text-yellow-400 hover:scale-125 transition-all duration-300 p-1" 
                                        data-rating="${i}">
                                    <span class="material-symbols-outlined text-[42px]" style="font-variation-settings: 'FILL' 1, 'wght' 400;">star</span>
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="ratingValue" value="${ratingActual}">
                        <div class="h-6">
                            <p id="ratingLabel" class="text-yellow-500 font-bold text-lg animate-fade-in">${ratingActual > 0 ? ['Muy malo 😠', 'Malo ☹️', 'Regular 😐', 'Bueno 🙂', '¡Excelente! 🤩'][ratingActual - 1] : ''}</p>
                        </div>
                    </div>

                    <!-- Comentario -->
                    <div>
                        <label class="block text-gray-400 text-sm mb-2 font-medium">Cuéntanos más (Opcional)</label>
                        <textarea id="reviewComment" rows="3" 
                            class="w-full bg-[#1a1d24] border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 focus:border-[#f56300] focus:ring-1 focus:ring-[#f56300] focus:outline-none transition-all resize-none shadow-inner"
                            placeholder="¿Qué fue lo que más te gustó?">${comentarioActual}</textarea>
                    </div>

                    <!-- Fotos -->
                    <div>
                        <label class="block text-gray-400 text-sm mb-3 font-medium">Añadir fotos del resultado</label>
                        <div class="flex flex-wrap gap-3 mb-3" id="photosPreview">
                            ${fotosActuales.map((url, i) => `
                                <div class="relative w-24 h-24 rounded-xl overflow-hidden group border border-white/10 shadow-lg">
                                    <img src="${url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onclick="event.preventDefault();" style="pointer-events: none;">
                                    <button onclick="window.citasUI.removePhoto(${i})" 
                                            class="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-lg cursor-pointer">
                                        <span class="material-symbols-outlined text-white" style="font-size: 14px;">close</span>
                                    </button>
                                </div>
                            `).join('')}
                            
                            <button onclick="document.getElementById('photoInput').click()" 
                                    class="w-24 h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-white hover:border-[#f56300] hover:bg-[#f56300]/5 transition-all group">
                                <span class="material-symbols-outlined group-hover:scale-110 transition-transform">add_photo_alternate</span>
                                <span class="text-[10px] font-bold uppercase tracking-wide">Subir</span>
                            </button>
                        </div>
                        <input type="file" id="photoInput" accept="image/*" multiple class="hidden" onchange="window.citasUI.handlePhotoUpload(event)">
                        <input type="hidden" id="reviewPhotos" value='${JSON.stringify(fotosActuales)}'>
                    </div>

                    <!-- Botones de acción -->
                    <div class="flex gap-4 pt-4 border-t border-white/5">
                        ${esEdicion ? `
                            <button onclick="window.citasUI.deleteReview(${cita.id})" 
                                    class="px-5 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        ` : ''}
                        <button id="submitReviewBtn" onclick="window.citasUI.submitReview(${cita.id}, ${esEdicion})" ${ratingActual === 0 ? 'disabled' : ''}
                                class="flex-1 py-4 bg-gradient-to-r from-[#f56300] to-[#ff8c42] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none tracking-wide text-lg shadow-md">
                            ${esEdicion ? 'Actualizar Reseña' : 'Publicar Reseña'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Exportar configuración de estados
export { ESTADOS_CONFIG };
