// --- GESTIÓN DE PAGOS ---
// Usar la variable global definida en el HTML principal
// Se inicializa si no existe (por seguridad)
if (typeof window.orderPayments === 'undefined') {
    window.orderPayments = [];
}

// Cargar medios de pago desde la API
async function loadMediosPago() {
    const select = document.getElementById('nuevo-pago-metodo');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Cargando...</option>';

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/medio-pago', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error cargando medios de pago');

        const data = await response.json();
        const mediosPago = data.mediosPago || data || [];

        select.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        mediosPago.forEach(mp => {
            const option = document.createElement('option');
            option.value = mp.id;
            option.dataset.codigo = mp.codigo;
            option.textContent = mp.nombre;
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Error cargando medios de pago:', e);
        // Fallback a valores por defecto
        select.innerHTML = `
            <option value="" disabled selected>Seleccionar...</option>
            <option value="3" data-codigo="CASH">Efectivo</option>
            <option value="2" data-codigo="CARD">Tarjeta</option>
            <option value="6" data-codigo="TRANSFERENCIA">Transferencia</option>
            <option value="7" data-codigo="CUENTA_CORRIENTE">Cuenta Corriente</option>
        `;
    }
}
window.loadMediosPago = loadMediosPago;

function updatePaymentSummary(totalOrden = null) {
    if (totalOrden === null) {
        totalOrden = parseFloat(document.getElementById('summary-total')?.textContent) || 0;
    }
    const totalPagado = window.orderPayments.reduce((sum, p) => sum + p.importe, 0);
    const saldoPendiente = Math.max(0, totalOrden - totalPagado);

    const totalPagadoEl = document.getElementById('resumen-total-pagado');
    const saldoPendienteEl = document.getElementById('resumen-saldo-pendiente');
    if (totalPagadoEl) totalPagadoEl.textContent = totalPagado.toFixed(2) + '€';
    if (saldoPendienteEl) saldoPendienteEl.textContent = saldoPendiente.toFixed(2) + '€';

    const badge = document.getElementById('pagos-badge');
    if (badge) {
        badge.textContent = window.orderPayments.length;
        badge.style.display = window.orderPayments.length > 0 ? 'inline' : 'none';
    }

    const importeInput = document.getElementById('nuevo-pago-importe');
    if (importeInput && (importeInput.value === '' || importeInput.value === '0')) {
        importeInput.value = saldoPendiente.toFixed(2);
    }
}
window.updatePaymentSummary = updatePaymentSummary;

function renderPayments() {
    const tbody = document.getElementById('pagos-tbody');
    const emptyMsg = document.getElementById('pagos-empty');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (window.orderPayments.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        window.orderPayments.forEach((pago, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td style="color: var(--text-secondary);">${pago.metodoNombre}</td>
        <td style="text-align: right; font-weight: 600;">${pago.importe.toFixed(2)}€</td>
        <td style="text-align: right;">
          <button type="button" class="remove-pago-btn" data-index="${index}" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #ef4444;">&times;</button>
        </td>
      `;
            tbody.appendChild(tr);
        });
    }
}
window.renderPayments = renderPayments;

// Inicializar eventos de pagos
document.addEventListener('DOMContentLoaded', () => {
    loadMediosPago();

    const btnAgregarPago = document.getElementById('btn-agregar-pago');
    if (btnAgregarPago) {
        btnAgregarPago.addEventListener('click', () => {
            const metodoSelect = document.getElementById('nuevo-pago-metodo');
            const importeInput = document.getElementById('nuevo-pago-importe');
            const referenciaInput = document.getElementById('nuevo-pago-referencia');

            const importe = parseFloat(importeInput?.value) || 0;
            const metodoId = metodoSelect?.value;
            const metodoNombre = metodoSelect?.options[metodoSelect.selectedIndex]?.text || '';
            const metodoCodigo = metodoSelect?.options[metodoSelect.selectedIndex]?.dataset.codigo || '';
            const referencia = referenciaInput?.value || '';

            if (importe <= 0) {
                showToast('Ingresa un importe válido', true);
                return;
            }
            if (!metodoId) {
                showToast('Selecciona un método de pago', true);
                return;
            }

            const totalOrden = parseFloat(document.getElementById('summary-total')?.textContent) || 0;
            const totalPagado = window.orderPayments.reduce((sum, p) => sum + p.importe, 0);
            const saldoPendiente = totalOrden - totalPagado;

            if (importe > saldoPendiente + 0.01) {
                showToast(`El importe excede el saldo pendiente (${saldoPendiente.toFixed(2)}€)`, true);
                return;
            }

            window.orderPayments.push({
                idMedioPago: parseInt(metodoId),
                codigoMedioPago: metodoCodigo,
                metodoNombre,
                importe,
                referencia: referencia || null,
                idCaja: 1
            });

            if (importeInput) importeInput.value = '';
            if (referenciaInput) referenciaInput.value = '';

            renderPayments();
            updatePaymentSummary();
            showToast(`Pago de ${importe.toFixed(2)}€ agregado`);
        });
    }

    // Eliminar pago
    const pagosTbody = document.getElementById('pagos-tbody');
    if (pagosTbody) {
        pagosTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-pago-btn')) {
                const index = parseInt(e.target.dataset.index);
                window.orderPayments.splice(index, 1);
                renderPayments();
                updatePaymentSummary();
            }
        });
    }
});
