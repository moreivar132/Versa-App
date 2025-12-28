import { getApiBaseUrl } from '/auth.js';
import {
    formatFecha,
    formatHora,
    renderEstadoBadge,
    ESTADOS_CONFIG
} from './components/citas-ui.js';
import { initSucursalSelector } from '/services/sucursal-selector.js';

const API_BASE_URL = getApiBaseUrl();
let currentCitas = [];
let currentWeekStart = new Date();
let globalConfig = { sucursales: [], tecnicos: [] };
const SUCURSAL_STORAGE_KEY = 'versa_selected_sucursal';

// sidebar toggle logic
window.toggleSubmenu = function (id) {
    const submenu = document.getElementById(id);
    const arrow = document.getElementById(id.replace('submenu', 'arrow'));

    if (submenu.classList.contains('hidden')) {
        submenu.classList.remove('hidden');
        submenu.classList.add('flex');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        submenu.classList.add('hidden');
        submenu.classList.remove('flex');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    // Basic sidebar setup
    const toggleBtn = document.getElementById('toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            // ... existing sidebar logic handled by manager.js usually, but let's keep it minimal if needed
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('w-64')) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-20');
                document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('hidden'));
            } else {
                sidebar.classList.add('w-64');
                sidebar.classList.remove('w-20');
                document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
            }
        });
    }

    if (document.getElementById('mobile-menu-btn')) {
        document.getElementById('mobile-menu-btn').addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('-translate-x-full');
            sidebar.classList.toggle('absolute');
            sidebar.classList.toggle('z-50');
            sidebar.classList.toggle('h-full');
        });
    }

    // Init Logic
    if (typeof window.toggleSubmenu === 'function') toggleSubmenu('taller-submenu');

    // Set current week to Monday
    const day = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - day + (day == 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);

    updateWeekLabel();
    loadCitas();
    loadConfig();

    // Listeners
    document.getElementById('cita-fecha')?.addEventListener('change', checkAvailability);
    document.getElementById('cita-sucursal')?.addEventListener('change', checkAvailability);
    document.getElementById('cita-mecanico')?.addEventListener('change', checkAvailability);
    document.getElementById('table-search-input')?.addEventListener('input', applyFilters);
    document.getElementById('status-filter')?.addEventListener('change', applyFilters);

    // Form submit
    document.getElementById('cita-form')?.addEventListener('submit', handleFormSubmit);

    // Init sucursal selector
    initSucursalSelector('sucursal-selector-container', {
        onchange: (sucursalId) => {
            loadCitas();
        }
    });
});

function updateWeekLabel() {
    const weekNum = getWeekNumber(currentWeekStart);
    document.getElementById('current-week-label').textContent = `Semana ${weekNum}`;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

window.changeWeek = function (offset) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    updateWeekLabel();
    loadCitas();
}

window.loadCitas = async function () {
    const tbody = document.getElementById('citas-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-[#a0a0a0]">Cargando...</td></tr>';

    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startStr = currentWeekStart.toISOString();
    const endStr = endOfWeek.toISOString();

    try {
        const response = await fetch(`${API_BASE_URL}/api/citas?start_date=${startStr}&end_date=${endStr}`);
        const data = await response.json();

        if (data.ok && data.citas) {
            currentCitas = data.citas;

            // Update stats/badges
            const pendingCount = data.citas.filter(c => c.estado === 'pendiente').length;
            const badge = document.getElementById('notification-badge');
            if (pendingCount > 0) {
                badge.classList.remove('hidden');
                badge.title = `${pendingCount} citas pendientes`;
            } else {
                badge.classList.add('hidden');
            }

            if (data.stats) {
                if (document.getElementById('stats-citas-hoy'))
                    document.getElementById('stats-citas-hoy').textContent = data.stats.citas_hoy;
                if (document.getElementById('stats-en-taller'))
                    document.getElementById('stats-en-taller').textContent = data.stats.en_taller;
                if (document.getElementById('stats-facturacion'))
                    document.getElementById('stats-facturacion').textContent = data.stats.facturacion_est + '€';
                if (document.getElementById('stats-solicitudes'))
                    document.getElementById('stats-solicitudes').textContent = data.stats.solicitudes_web;
            }

            applyFilters();
            renderChart(data.citas);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Error al cargar: ${data.error || 'Desconocido'}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Error de conexión: ${error.message}</td></tr>`;
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('table-search-input').value.toLowerCase();
    const statusTerm = document.getElementById('status-filter').value.toLowerCase();

    const filtered = currentCitas.filter(c => {
        const matchesSearch = (c.cliente_nombre || '').toLowerCase().includes(searchTerm) ||
            (c.vehiculo_matricula || '').toLowerCase().includes(searchTerm) ||
            (c.vehiculo_modelo || '').toLowerCase().includes(searchTerm) ||
            (c.vehiculo_marca || '').toLowerCase().includes(searchTerm);
        const matchesStatus = statusTerm === '' || (c.estado || '').toLowerCase() === statusTerm;
        return matchesSearch && matchesStatus;
    });
    renderTable(filtered);
}

// ... (código previo)

function renderTable(citas) {
    const tbody = document.getElementById('citas-tbody');
    tbody.innerHTML = '';

    if (citas.length === 0) {
        // ... (empty state)
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-[#a0a0a0] flex flex-col items-center gap-2"> <!-- colspan 6 ahora -->
                    <span class="material-symbols-outlined text-4xl opacity-20">calendar_today</span>
                    <p>No hay citas para mostrar.</p>
                </td>
            </tr>`;
        return;
    }

    // Actualizar encabezado de tabla si es necesario (agregar columna Pago)
    // Asumimos que el HTML ya tiene 5 y añadimos dinámicamente o ajustamos el HTML principal luego.
    // Para simplificar, insertaremos el estado de pago ANTES de las acciones.

    citas.forEach(cita => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors group';

        const typeStr = ((cita.vehiculo_modelo || '') + ' ' + (cita.vehiculo_marca || '')).toLowerCase();
        let vehiculoIcon = 'directions_car';
        if (typeStr.includes('moto')) vehiculoIcon = 'two_wheeler';
        else if (typeStr.includes('bici')) vehiculoIcon = 'pedal_bike';

        const statusBadge = renderEstadoBadge(cita.estado);
        const formattedDate = formatFecha(cita.fecha_hora);
        const formattedTime = formatHora(cita.fecha_hora);

        // Lógica de Estado de Pago
        let paymentBadge = '';
        if (cita.payment_status === 'PAID') {
            const method = cita.payment_mode === 'CASH' ? 'Efectivo' :
                cita.payment_mode === 'CARD_TERMINAL' ? 'Datáfono' :
                    cita.payment_mode === 'MANUAL' ? 'Manual' : 'Stripe';
            paymentBadge = `<span class="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 border border-green-500/20" title="Pagado con ${method}">
                <span class="material-symbols-outlined text-[10px]">check_circle</span> Pagado
            </span>`;
        } else if (cita.payment_status === 'DEPOSIT') {
            paymentBadge = `<span class="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 border border-blue-500/20">
                <span class="material-symbols-outlined text-[10px]">payments</span> Depósito
            </span>`;
        } else {
            paymentBadge = `<button onclick="window.openPaymentModal('${cita.id}')" class="inline-flex items-center gap-1 rounded bg-[#2a2a2a] px-2 py-1 text-xs font-medium text-[#a0a0a0] border border-[#3a3a3a] hover:bg-[var(--brand-orange)] hover:text-white hover:border-[var(--brand-orange)] transition-all">
                <span class="material-symbols-outlined text-[10px]">add_card</span> Registrar Pago
            </button>`;
        }

        tr.innerHTML = `
            <td class="whitespace-nowrap px-6 py-4">
                <div class="text-sm font-bold text-white">${formattedTime}</div>
                <div class="text-xs text-[#a0a0a0]">${formattedDate}</div>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
                <button onclick="window.openClientModal('${cita.id}')" class="text-left hover:bg-[#2a2a2a] p-1 -m-1 rounded transition-colors w-full">
                    <div class="text-sm font-medium text-white hover:text-[var(--brand-orange)] transition-colors underline decoration-dotted underline-offset-4">${cita.cliente_nombre || 'Cliente Desconocido'}</div>
                    <div class="text-xs text-[#a0a0a0] flex items-center gap-1 mt-1">
                        <span class="material-symbols-outlined text-[14px]">${vehiculoIcon}</span> ${cita.vehiculo_marca || ''} ${cita.vehiculo_modelo || ''}
                    </div>
                </button>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
                <div class="text-sm text-gray-300">${cita.motivo || 'Servicio General'}</div>
                <div class="text-xs text-[var(--brand-orange)]">${cita.sucursal_nombre || 'Sucursal Principal'}</div>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
                <button onclick="window.toggleStatus('${cita.id}', '${cita.estado}')" class="hover:opacity-80 transition-opacity">
                    ${statusBadge}
                </button>
            </td>
            <!-- Nueva Columna: Pago -->
            <td class="whitespace-nowrap px-6 py-4 text-center">
                ${paymentBadge}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-right relative">
                 <div class="flex justify-end gap-2">
                    <button onclick="window.editCita('${cita.id}')" class="text-[#a0a0a0] hover:text-white transition-colors" title="Editar">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="window.deleteCita('${cita.id}')" class="text-[#a0a0a0] hover:text-red-500 transition-colors" title="Eliminar">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ... (renderChart, loadConfig, checkAvailability, updateCitaStatus, showToast)

// =============================================
// LOGICA DE PAGO MANUAL
// =============================================

window.openPaymentModal = function (citaId) {
    document.getElementById('payment-modal').classList.remove('hidden');
    document.getElementById('payment-modal').classList.add('flex');
    document.getElementById('payment-cita-id').value = citaId;
    document.getElementById('payment-amount').value = ''; // Reset
    document.getElementById('payment-note').value = '';

    // Autofocus amount
    setTimeout(() => document.getElementById('payment-amount').focus(), 100);
}

window.closePaymentModal = function () {
    document.getElementById('payment-modal').classList.add('hidden');
    document.getElementById('payment-modal').classList.remove('flex');
}

// Inicializar listener de pago
document.addEventListener('DOMContentLoaded', () => {
    // ... existing init ...
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const citaId = document.getElementById('payment-cita-id').value;
            const amount = document.getElementById('payment-amount').value;
            const method = document.getElementById('payment-method').value;
            const note = document.getElementById('payment-note').value;

            if (!citaId || !amount) {
                showToast('Importe requerido', 'error');
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/citas/${citaId}/pago`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, method, note })
                });
                const data = await res.json();

                if (data.ok) {
                    showToast('Pago registrado correctamente', 'success');
                    window.closePaymentModal();
                    loadCitas(); // Recargar tabla
                } else {
                    showToast(data.error || 'Error al registrar pago', 'error');
                }
            } catch (error) {
                console.error(error);
                showToast('Error de conexión', 'error');
            }
        });
    }
});


function renderChart(citas) {
    const chartContainer = document.getElementById('occupancy-chart');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const counts = Array(7).fill(0).map(() => ({ total: 0, types: { coche: 0, moto: 0, bici: 0 } }));

    if (citas && citas.length > 0) {
        citas.forEach(cita => {
            const date = new Date(cita.fecha_hora);
            let dayIndex = date.getDay() - 1;
            if (dayIndex === -1) dayIndex = 6;
            if (dayIndex >= 0 && dayIndex < 7) {
                counts[dayIndex].total++;
                const typeStr = ((cita.vehiculo_modelo || '') + ' ' + (cita.vehiculo_marca || '')).toLowerCase();
                if (typeStr.includes('moto')) counts[dayIndex].types.moto++;
                else if (typeStr.includes('bici')) counts[dayIndex].types.bici++;
                else counts[dayIndex].types.coche++;
            }
        });
    }

    // Render logic remains similar but compacted
    const maxCount = Math.max(...counts.map(c => c.total), 5);

    days.forEach((dayLabel, index) => {
        const count = counts[index];
        const totalPercent = (count.total / maxCount) * 100;
        const pCoche = count.total > 0 ? (count.types.coche / count.total) * 100 : 0;
        const pMoto = count.total > 0 ? (count.types.moto / count.total) * 100 : 0;
        const pBici = count.total > 0 ? (count.types.bici / count.total) * 100 : 0;

        const barHtml = `
            <div class="flex w-full h-full flex-col justify-end items-center gap-2 group cursor-pointer relative" title="${count.total} Citas">
                <div class="w-full max-w-[20px] relative" style="height: ${Math.max(totalPercent, 1)}%;">
                     ${count.total > 0 ? `<span class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">${count.total}</span>` : ''}
                     <div class="w-full h-full flex flex-col-reverse rounded-t overflow-hidden bg-[#2a2a2a]">
                         ${pCoche > 0 ? `<div style="height: ${pCoche}%;" class="w-full bg-blue-500"></div>` : ''}
                         ${pMoto > 0 ? `<div style="height: ${pMoto}%;" class="w-full bg-[var(--brand-orange)]"></div>` : ''}
                         ${pBici > 0 ? `<div style="height: ${pBici}%;" class="w-full bg-green-500"></div>` : ''}
                     </div>
                </div>
                <span class="text-[10px] text-[#a0a0a0]">${dayLabel}</span>
            </div>
        `;
        chartContainer.insertAdjacentHTML('beforeend', barHtml);
    });
}

// Config Load
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/citas/config`);
        const data = await res.json();
        if (data.ok) {
            globalConfig = data;
            const sucursalSelect = document.getElementById('cita-sucursal');
            const mecanicoSelect = document.getElementById('cita-mecanico');

            const savedSucursal = localStorage.getItem(SUCURSAL_STORAGE_KEY);
            if (sucursalSelect) {
                sucursalSelect.innerHTML = data.sucursales.map(s => {
                    const selected = savedSucursal && s.id == savedSucursal ? ' selected' : '';
                    return `<option value="${s.id}"${selected}>${s.nombre}</option>`;
                }).join('');
            }
            if (mecanicoSelect) {
                mecanicoSelect.innerHTML = '<option value="">Cualquiera</option>' + data.tecnicos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
            }
        }
    } catch (e) { console.error(e); }
}

// Check Availability
async function checkAvailability() {
    const date = document.getElementById('cita-fecha').value;
    const sucursal = document.getElementById('cita-sucursal').value;
    const mecanico = document.getElementById('cita-mecanico').value;
    const container = document.getElementById('availability-container');
    const slotsContainer = document.getElementById('availability-slots');

    if (!date) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    slotsContainer.innerHTML = '<span class="text-[#a0a0a0]">Cargando...</span>';

    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    try {
        const res = await fetch(`${API_BASE_URL}/api/citas?start_date=${start.toISOString()}&end_date=${end.toISOString()}`);
        const data = await res.json();

        if (data.ok && data.citas) {
            const citasDia = data.citas.filter(c => {
                if (sucursal && c.id_sucursal != sucursal) return false;
                if (mecanico && c.id_mecanico && c.id_mecanico != mecanico) return false;
                return true;
            });

            if (citasDia.length === 0) {
                slotsContainer.innerHTML = '<span class="text-green-500">Todo el día libre</span>';
            } else {
                slotsContainer.innerHTML = citasDia.map(c => {
                    const time = formatHora(c.fecha_hora);
                    return `<span class="bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">${time}</span>`;
                }).join('');
            }
        }
    } catch (e) {
        slotsContainer.innerHTML = '<span class="text-red-500">Error al cargar disponibilidad</span>';
    }
}

// Modal Logic
window.openModal = function (cita = null) {
    const modal = document.getElementById('cita-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (cita) {
        document.getElementById('modal-title').textContent = 'Editar Cita';
        document.getElementById('cita-id').value = cita.id;
        document.getElementById('cita-cliente').value = cita.cliente_nombre || '';
        document.getElementById('cita-email').value = cita.cliente_email || '';

        if (cita.id_sucursal) document.getElementById('cita-sucursal').value = cita.id_sucursal;
        if (cita.id_mecanico) document.getElementById('cita-mecanico').value = cita.id_mecanico;

        const date = new Date(cita.fecha_hora);
        document.getElementById('cita-fecha').value = date.toISOString().split('T')[0];
        document.getElementById('cita-hora').value = date.toTimeString().slice(0, 5);
        document.getElementById('cita-motivo').value = cita.motivo || '';

        const model = (cita.vehiculo_modelo || '').toLowerCase();
        if (model.includes('moto')) document.getElementById('cita-vehiculo-tipo').value = 'moto';
        else if (model.includes('bici')) document.getElementById('cita-vehiculo-tipo').value = 'bicicleta';
        else document.getElementById('cita-vehiculo-tipo').value = 'coche';

        checkAvailability();
    } else {
        document.getElementById('modal-title').textContent = 'Nueva Cita';
        document.getElementById('cita-form').reset();
        document.getElementById('cita-id').value = '';
        document.getElementById('cita-fecha').value = new Date().toISOString().split('T')[0];

        const savedSucursal = localStorage.getItem(SUCURSAL_STORAGE_KEY);
        if (savedSucursal && globalConfig.sucursales.some(s => s.id == savedSucursal)) {
            document.getElementById('cita-sucursal').value = savedSucursal;
        } else if (globalConfig.sucursales.length > 0) {
            document.getElementById('cita-sucursal').value = globalConfig.sucursales[0].id;
        }
        checkAvailability();
    }
}

window.closeModal = function () {
    const modal = document.getElementById('cita-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cita-id').value;
    const fecha = document.getElementById('cita-fecha').value;
    const hora = document.getElementById('cita-hora').value;
    const fecha_hora = `${fecha}T${hora}:00`;

    const data = {
        fecha_hora,
        motivo: document.getElementById('cita-motivo').value,
        cliente: {
            nombre: document.getElementById('cita-cliente').value,
            email: document.getElementById('cita-email').value,
            telefono: '000000000'
        },
        vehiculo_categoria: document.getElementById('cita-vehiculo-tipo').value,
        sucursal_ref: document.getElementById('cita-sucursal').value,
        id_mecanico: document.getElementById('cita-mecanico').value || null,
        duracion_min: 60,
        notas: ''
    };

    try {
        let url = `${API_BASE_URL}/api/citas/crear`;
        let method = 'POST';
        if (id) {
            url = `${API_BASE_URL}/api/citas/${id}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.ok) {
            window.closeModal();
            loadCitas();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error al guardar');
    }
}

window.deleteCita = async function (id) {
    if (!confirm('¿Estás seguro de eliminar esta cita?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/citas/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) loadCitas();
        else alert('Error al eliminar');
    } catch (err) { alert('Error de conexión'); }
}

window.toggleStatus = async function (id, currentStatus) {
    // Crear menú desplegable de estados
    const allStates = [
        { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-500' },
        { value: 'confirmada', label: 'Confirmada', color: 'bg-blue-500' },
        { value: 'en_progreso', label: 'En Progreso', color: 'bg-purple-500' },
        { value: 'completada', label: 'Completada', color: 'bg-green-500' },
        { value: 'cancelada', label: 'Cancelada', color: 'bg-red-500' },
        { value: 'no_asistio', label: 'No Asistió', color: 'bg-gray-500' }
    ];

    // Normalizar estado actual (convertir espacios a guiones bajos)
    const normalizedCurrent = (currentStatus || 'pendiente').replace(/ /g, '_');

    // Crear el overlay y menú
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 bg-black/50';
    overlay.onclick = () => overlay.remove();

    const menu = document.createElement('div');
    menu.className = 'fixed z-50 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl p-2 min-w-[180px]';
    menu.style.cssText = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';

    menu.innerHTML = `
        <div class="text-xs font-bold text-[#a0a0a0] uppercase px-3 py-2 border-b border-[#2a2a2a] mb-1">Cambiar Estado</div>
        ${allStates.map(state => `
            <button onclick="window.updateCitaStatus('${id}', '${state.value}')" 
                    class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
                           ${normalizedCurrent === state.value ? 'bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]' : 'text-white hover:bg-[#2a2a2a]'}">
                <span class="w-2 h-2 rounded-full ${state.color}"></span>
                ${state.label}
                ${normalizedCurrent === state.value ? '<span class="material-symbols-outlined ml-auto text-sm">check</span>' : ''}
            </button>
        `).join('')}
    `;

    overlay.appendChild(menu);
    document.body.appendChild(overlay);
}

window.updateCitaStatus = async function (id, newStatus) {
    // Cerrar el menú
    document.querySelector('.fixed.inset-0.z-50.bg-black\\/50')?.remove();

    try {
        const res = await fetch(`${API_BASE_URL}/api/citas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: newStatus })
        });
        const data = await res.json();

        if (data.ok) {
            // Mostrar notificación de éxito
            showToast(`Estado actualizado a "${newStatus.replace('_', ' ')}"`, 'success');
            loadCitas();
        } else {
            showToast('Error al actualizar estado', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

// Función para mostrar notificaciones toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in flex items-center gap-2`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-sm">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
        ${message}
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.editCita = function (id) {
    const cita = currentCitas.find(c => c.id == id);
    if (cita) window.openModal(cita);
}

// Client Modal
window.openClientModal = function (citaId) {
    const cita = currentCitas.find(c => c.id == citaId);
    if (!cita) return;
    const clientModal = document.getElementById('client-modal');
    const content = document.getElementById('client-details-content');

    content.innerHTML = `
        <div class="flex items-center gap-4 mb-4 pb-4 border-b border-[#2a2a2a]">
            <div class="w-12 h-12 rounded-full bg-[var(--brand-orange)] flex items-center justify-center text-white font-bold text-xl">
                ${(cita.cliente_nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
                <h4 class="text-lg font-bold text-white">${cita.cliente_nombre || 'Desconocido'}</h4>
                <p class="text-sm text-[#a0a0a0]">Cliente Registrado</p>
            </div>
        </div>
        
        <div class="grid gap-3">
            <div class="bg-[#111318] p-3 rounded-lg border border-[#2a2a2a]">
                <label class="block text-xs text-[#a0a0a0] mb-1">Contacto</label>
                <div class="flex items-center gap-2 text-sm text-white mb-1">
                    <span class="material-symbols-outlined text-xs">phone</span>
                    ${cita.cliente_telefono || 'No disponible'}
                </div>
                <div class="flex items-center gap-2 text-sm text-white">
                    <span class="material-symbols-outlined text-xs">mail</span>
                    ${cita.cliente_email || 'No disponible'}
                </div>
            </div>

            <div class="bg-[#111318] p-3 rounded-lg border border-[#2a2a2a]">
                <label class="block text-xs text-[#a0a0a0] mb-1">Vehículo Actual</label>
                <div class="text-sm text-white font-medium">${cita.vehiculo_marca || ''} ${cita.vehiculo_modelo || ''}</div>
                <div class="text-xs text-[#a0a0a0] font-mono mt-1">${cita.vehiculo_matricula || 'Sin matrícula'}</div>
            </div>
        </div>

        <div class="flex justify-end mt-4">
            <button onclick="window.location.href='manager-taller-clientes.html?id=${cita.id_cliente}'" class="text-sm text-[var(--brand-orange)] hover:underline">
                Ver ficha completa de cliente
            </button>
        </div>
    `;

    clientModal.classList.remove('hidden');
    clientModal.classList.add('flex');
}

window.closeClientModal = function () {
    const clientModal = document.getElementById('client-modal');
    clientModal.classList.add('hidden');
    clientModal.classList.remove('flex');
}
