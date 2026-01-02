/**
 * Caja Module - Frontend Logic
 * Adaptado a la estructura de BD existente
 */
import { requireAuth, clearSession, redirectToLogin } from './auth.js';
import api from './api.js';

const formatCurrency = (val) => `€${parseFloat(val || 0).toFixed(2)}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

let currentTab = 'estado';
let cajaData = null;

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        currentTab = btn.dataset.tab;
        document.getElementById(`view-${currentTab}`).classList.add('active');
        loadTabData(currentTab);
    });
});

async function loadTabData(tab) {
    if (tab === 'estado') await loadEstadoCaja();
    else if (tab === 'cierres') await loadCierres();
    else if (tab === 'movimientos') await loadMovimientos();
    else if (tab === 'cajachica') await loadCajaChica();
}

async function loadEstadoCaja() {
    try {
        const res = await api.get('/api/caja/estado-actual');
        cajaData = res.data;
        const { caja, totales, caja_chica, detalle_metodos_pago } = cajaData;

        document.getElementById('info-usuario').textContent = caja.nombre || 'Caja Principal';
        document.getElementById('info-saldo-apertura').textContent = formatCurrency(caja.saldo_apertura);
        document.getElementById('info-fecha').textContent = formatDate(caja.fecha_apertura);
        document.getElementById('info-id').textContent = `#CJ-${caja.id}`;

        document.getElementById('stat-ingresos').textContent = formatCurrency(totales.ingresos_efectivo);
        document.getElementById('stat-tarjeta').textContent = formatCurrency(totales.tarjeta);
        document.getElementById('stat-total').textContent = formatCurrency(totales.total_periodo);

        document.getElementById('efec-apertura').textContent = formatCurrency(caja.saldo_apertura);
        document.getElementById('efec-ingresos').textContent = `+${formatCurrency(totales.ingresos_efectivo)}`;
        document.getElementById('efec-egresos').textContent = `-${formatCurrency(totales.egresos_efectivo)}`;
        document.getElementById('efec-esperado').textContent = formatCurrency(totales.efectivo_esperado);

        document.getElementById('caja-chica-saldo').textContent = formatCurrency(caja_chica.saldo);

        const tbody = document.getElementById('detalle-metodos-tbody');
        if (!detalle_metodos_pago || detalle_metodos_pago.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center text-[#9da6b9]">Sin movimientos</td></tr>';
        } else {
            tbody.innerHTML = detalle_metodos_pago.map(m => `
        <tr class="hover:bg-[#1a1d24]">
          <td class="px-6 py-4 text-sm text-white">${m.nombre}</td>
          <td class="px-6 py-4 text-sm text-right font-bold text-green-400">${formatCurrency(m.total)}</td>
        </tr>
      `).join('');
        }
    } catch (e) {
        console.error('Error loading estado:', e);
    }
}

async function loadCierres() {
    try {
        const res = await api.get('/api/caja/cierres');
        const tbody = document.getElementById('cierres-tbody');
        if (!res.data.cierres?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-[#9da6b9]">Sin cierres registrados</td></tr>';
            return;
        }
        tbody.innerHTML = res.data.cierres.map(c => {
            const resultado = parseFloat(c.saldo_real) - parseFloat(c.saldo_inicial);
            return `
        <tr class="hover:bg-[#1a1d24] cursor-pointer" data-cierre-id="${c.id}">
          <td class="px-6 py-4 text-sm text-white">${formatDate(c.fecha_cierre)}</td>
          <td class="px-6 py-4 text-sm text-[#9da6b9]">${c.usuario_cierre || '-'}</td>
          <td class="px-6 py-4 text-sm font-medium text-white">${formatCurrency(c.saldo_real)}</td>
          <td class="px-6 py-4 text-sm font-bold ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}">${resultado >= 0 ? '+' : ''}${formatCurrency(resultado)}</td>
          <td class="px-6 py-4"><span class="material-symbols-outlined text-gray-600">chevron_right</span></td>
        </tr>
      `;
        }).join('');
        tbody.querySelectorAll('tr[data-cierre-id]').forEach(tr => tr.addEventListener('click', () => loadCierreDetail(tr.dataset.cierreId)));
    } catch (e) { console.error('Error loading cierres:', e); }
}

async function loadCierreDetail(id) {
    try {
        const res = await api.get(`/api/caja/cierres/${id}`);
        const c = res.data.cierre;
        const resultado = parseFloat(c.saldo_real) - parseFloat(c.saldo_inicial);
        document.getElementById('cierre-detail').innerHTML = `
      <h2 class="text-xl font-bold text-white mb-4">Cierre del ${formatDate(c.fecha)}</h2>
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-[#1a1d24] p-4 rounded-xl">
          <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Saldo Inicial</span>
          <p class="text-xl font-bold text-white">${formatCurrency(c.saldo_inicial)}</p>
        </div>
        <div class="bg-[#1a1d24] p-4 rounded-xl">
          <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Saldo Teórico</span>
          <p class="text-xl font-bold text-blue-400">${formatCurrency(c.saldo_teorico)}</p>
        </div>
        <div class="bg-[#1a1d24] p-4 rounded-xl">
          <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Saldo Real</span>
          <p class="text-xl font-bold text-white">${formatCurrency(c.saldo_real)}</p>
        </div>
        <div class="bg-[#1a1d24] p-4 rounded-xl">
          <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Diferencia</span>
          <p class="text-xl font-bold ${parseFloat(c.diferencia) === 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(c.diferencia)}</p>
        </div>
      </div>
      <div class="border-t border-[#282e39] pt-4">
        <p class="text-xs text-[#9da6b9]">Cerró: <span class="text-white">${c.usuario_cierre || '-'}</span></p>
      </div>
    `;
    } catch (e) { console.error('Error loading cierre detail:', e); }
}

async function loadMovimientos(page = 1) {
    try {
        const tipo = document.getElementById('mov-filter-tipo').value;
        const res = await api.get('/api/caja/movimientos', { params: { page, limit: 20, tipo: tipo || undefined } });
        const tbody = document.getElementById('movimientos-tbody');
        if (!res.data.movimientos?.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-[#9da6b9]">Sin movimientos</td></tr>';
            return;
        }
        tbody.innerHTML = res.data.movimientos.map(m => {
            const tipoClass = m.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-500' : m.tipo === 'EGRESO' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-400';
            const montoClass = m.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400';
            return `
        <tr class="hover:bg-[#1a1d24]">
          <td class="px-6 py-4 text-xs font-mono text-[#9da6b9]">${m.id}</td>
          <td class="px-6 py-4"><span class="px-2 py-0.5 rounded text-xs font-medium ${tipoClass}">${m.tipo}</span></td>
          <td class="px-6 py-4 text-sm text-gray-300">Efectivo</td>
          <td class="px-6 py-4 text-sm text-gray-300 max-w-[200px] truncate">${m.origen_tipo || '-'}</td>
          <td class="px-6 py-4 text-sm text-[#9da6b9]">${m.usuario}</td>
          <td class="px-6 py-4 text-sm text-[#9da6b9]">${formatDate(m.fecha)}</td>
          <td class="px-6 py-4 text-sm font-bold text-right ${montoClass}">${formatCurrency(m.monto)}</td>
        </tr>
      `;
        }).join('');
    } catch (e) { console.error('Error loading movimientos:', e); }
}

async function loadCajaChica() {
    try {
        const [estadoRes, movRes] = await Promise.all([
            api.get('/api/caja/chica/estado'),
            api.get('/api/caja/chica/movimientos')
        ]);
        document.getElementById('cc-saldo').textContent = formatCurrency(estadoRes.data.caja_chica.saldo_actual);
        const tbody = document.getElementById('cc-movimientos-tbody');
        if (!movRes.data.movimientos?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-[#9da6b9]">Sin movimientos</td></tr>';
            return;
        }
        tbody.innerHTML = movRes.data.movimientos.map(m => {
            const tipoClass = m.tipo === 'INGRESO' || m.tipo === 'INTERNO' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500';
            const montoClass = m.tipo === 'INGRESO' || m.tipo === 'INTERNO' ? 'text-green-400' : 'text-red-400';
            const sign = m.tipo === 'EGRESO' ? '-' : '+';
            return `
        <tr class="hover:bg-[#1a1d24]">
          <td class="px-6 py-4 text-sm text-white">${formatDate(m.fecha)}</td>
          <td class="px-6 py-4 text-sm text-gray-300">${m.descripcion || m.origen_tipo || '-'}</td>
          <td class="px-6 py-4"><span class="px-2.5 py-0.5 rounded text-xs font-medium ${tipoClass}">${m.tipo}</span></td>
          <td class="px-6 py-4 text-sm font-bold text-right ${montoClass}">${sign}${formatCurrency(m.monto)}</td>
          <td class="px-6 py-4 text-sm text-[#9da6b9]">${m.usuario}</td>
        </tr>
      `;
        }).join('');
    } catch (e) { console.error('Error loading caja chica:', e); }
}

// Modal helpers
function showModal(title, content, onConfirm, confirmText = 'Confirmar', confirmClass = 'bg-[var(--brand-orange)]') {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="w-full max-w-lg rounded-2xl bg-[#111318] border border-[#282e39] shadow-2xl overflow-hidden">
        <div class="bg-[#1a1d24] p-6 border-b border-[#282e39] flex justify-between items-center">
          <h3 class="text-lg font-bold text-white">${title}</h3>
          <button class="modal-close text-gray-500 hover:text-white"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="p-6">${content}</div>
        <div class="bg-[#1a1d24] p-5 border-t border-[#282e39] flex justify-end gap-3">
          <button class="modal-close rounded-xl px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-white">Cancelar</button>
          <button class="modal-confirm rounded-xl px-6 py-2.5 text-sm font-bold text-white ${confirmClass} hover:opacity-90">${confirmText}</button>
        </div>
      </div>
    </div>`;
    container.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => container.innerHTML = ''));
    container.querySelector('.modal-confirm').addEventListener('click', async () => { await onConfirm(); container.innerHTML = ''; });
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-medium z-[200] ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Modal: Cerrar Caja
document.getElementById('btn-cerrar-caja')?.addEventListener('click', () => {
    const esperado = cajaData?.totales?.efectivo_esperado || '0';
    showModal('Cerrar Caja', `
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-[#1a1d24] p-3 rounded-xl">
        <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Saldo Apertura</span>
        <p class="text-white font-bold">${formatCurrency(cajaData?.caja?.saldo_apertura)}</p>
      </div>
      <div class="bg-[var(--brand-orange)]/10 p-3 rounded-xl">
        <span class="text-[10px] text-[var(--brand-orange)] uppercase font-bold">Efectivo Esperado</span>
        <p class="text-white font-bold">${formatCurrency(esperado)}</p>
      </div>
    </div>
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Efectivo Contado (Real) *</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da6b9]">€</span>
          <input type="number" id="modal-saldo-real" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 pl-8 text-white" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Enviar a Caja Chica (opcional)</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da6b9]">€</span>
          <input type="number" id="modal-acajachica" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 pl-8 text-white" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Descripción</label>
        <input type="text" id="modal-descripcion" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 text-white" placeholder="Ej: Cierre normal">
      </div>
    </div>
  `, async () => {
        const saldoReal = document.getElementById('modal-saldo-real').value;
        const aCajaChica = document.getElementById('modal-acajachica').value;
        const descripcion = document.getElementById('modal-descripcion').value;
        if (!saldoReal) { showToast('El efectivo contado es requerido', 'error'); return; }
        try {
            await api.post('/api/caja/cerrar', { saldo_real: saldoReal, a_caja_chica: aCajaChica || 0, descripcion });
            showToast('Caja cerrada correctamente');
            loadEstadoCaja();
        } catch (e) { showToast(e.response?.data?.error || 'Error al cerrar caja', 'error'); }
    }, 'Confirmar Cierre');
});

// Modal: Enviar a Caja Chica
document.getElementById('btn-enviar-caja-chica')?.addEventListener('click', () => {
    showModal('Enviar a Caja Chica', `
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-[#1a1d24] p-3 rounded-xl text-center">
        <span class="text-[10px] text-[#9da6b9] uppercase font-bold">Efectivo Disponible</span>
        <p class="text-lg text-white font-bold">${formatCurrency(cajaData?.totales?.efectivo_esperado)}</p>
      </div>
      <div class="bg-indigo-500/10 p-3 rounded-xl text-center">
        <span class="text-[10px] text-indigo-400 uppercase font-bold">Caja Chica Actual</span>
        <p class="text-lg text-indigo-300 font-bold">${formatCurrency(cajaData?.caja_chica?.saldo)}</p>
      </div>
    </div>
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Monto *</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da6b9]">€</span>
          <input type="number" id="modal-monto" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 pl-8 text-white" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Descripción</label>
        <textarea id="modal-desc" rows="2" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 text-white resize-none" placeholder="Motivo del envío..."></textarea>
      </div>
    </div>
  `, async () => {
        const monto = document.getElementById('modal-monto').value;
        const descripcion = document.getElementById('modal-desc').value;
        if (!monto) { showToast('El monto es requerido', 'error'); return; }
        try {
            await api.post('/api/caja/enviar-caja-chica', { monto, descripcion });
            showToast('Transferencia realizada');
            loadEstadoCaja();
        } catch (e) { showToast(e.response?.data?.error || 'Error', 'error'); }
    }, 'Transferir');
});

// Modal: Movimiento Caja Chica
function openCajaChicaModal(tipo) {
    const isEgreso = tipo === 'EGRESO';
    showModal(isEgreso ? 'Registrar Egreso' : 'Registrar Ingreso', `
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Monto *</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da6b9]">€</span>
          <input type="number" id="modal-monto" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 pl-8 text-white" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-300 mb-2 block">Descripción ${isEgreso ? '*' : ''}</label>
        <textarea id="modal-desc" rows="2" class="w-full rounded-xl bg-[#1a1d24] border border-[#282e39] px-4 py-3 text-white resize-none" placeholder="${isEgreso ? 'Ej: Compra de material' : 'Ej: Aporte extra'}"></textarea>
      </div>
    </div>
  `, async () => {
        const monto = document.getElementById('modal-monto').value;
        const descripcion = document.getElementById('modal-desc').value;
        if (!monto) { showToast('El monto es requerido', 'error'); return; }
        if (isEgreso && !descripcion) { showToast('La descripción es obligatoria para egresos', 'error'); return; }
        try {
            await api.post('/api/caja/chica/movimientos', { tipo, monto, descripcion });
            showToast('Movimiento registrado');
            loadCajaChica();
        } catch (e) { showToast(e.response?.data?.error || 'Error', 'error'); }
    }, 'Guardar', isEgreso ? 'bg-red-500' : 'bg-green-500');
}

document.getElementById('btn-cc-egreso')?.addEventListener('click', () => openCajaChicaModal('EGRESO'));
document.getElementById('btn-cc-ingreso')?.addEventListener('click', () => openCajaChicaModal('INGRESO'));

// Filtros
document.getElementById('mov-filter-tipo')?.addEventListener('change', () => loadMovimientos());

// Logout
document.querySelector('[data-logout]')?.addEventListener('click', (e) => { e.preventDefault(); clearSession(); redirectToLogin(); });

// Init
(async () => {
    const user = await requireAuth();
    if (!user) return;
    document.getElementById('user-name').textContent = user.nombre || 'Usuario';
    document.getElementById('user-role').textContent = user.rol?.nombre || '-';
    document.getElementById('user-avatar').textContent = (user.nombre || 'U').substring(0, 2).toUpperCase();
    loadEstadoCaja();
})();
