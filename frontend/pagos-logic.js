// --- GESTIÓN DE PAGOS ---
const orderPayments = [];

// Cargar medios de pago (IDs correctos según BD: Efectivo=3, Tarjeta=2, Transferencia=1)
function loadMediosPago() {
    const select = document.getElementById('nuevo-pago-metodo');
    if (!select) return;
    select.innerHTML = `
    <option value="3" data-codigo="CASH">Efectivo</option>
    <option value="2" data-codigo="CARD">Tarjeta</option>
    <option value="1" data-codigo="TRANSFER">Transferencia</option>
  `;
}

function updatePaymentSummary(totalOrden = null) {
    if (totalOrden === null) {
        totalOrden = parseFloat(document.getElementById('summary-total')?.textContent) || 0;
    }
    const totalPagado = orderPayments.reduce((sum, p) => sum + p.importe, 0);
    const saldoPendiente = Math.max(0, totalOrden - totalPagado);

    const totalPagadoEl = document.getElementById('resumen-total-pagado');
    const saldoPendienteEl = document.getElementById('resumen-saldo-pendiente');
    if (totalPagadoEl) totalPagadoEl.textContent = totalPagado.toFixed(2) + '€';
    if (saldoPendienteEl) saldoPendienteEl.textContent = saldoPendiente.toFixed(2) + '€';

    const badge = document.getElementById('pagos-badge');
    if (badge) {
        badge.textContent = orderPayments.length;
        badge.style.display = orderPayments.length > 0 ? 'inline' : 'none';
    }

    const importeInput = document.getElementById('nuevo-pago-importe');
    if (importeInput && (importeInput.value === '' || importeInput.value === '0')) {
        importeInput.value = saldoPendiente.toFixed(2);
    }
}

function renderPayments() {
    const tbody = document.getElementById('pagos-tbody');
    const emptyMsg = document.getElementById('pagos-empty');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (orderPayments.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        orderPayments.forEach((pago, index) => {
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
            const totalPagado = orderPayments.reduce((sum, p) => sum + p.importe, 0);
            const saldoPendiente = totalOrden - totalPagado;

            if (importe > saldoPendiente + 0.01) {
                showToast(`El importe excede el saldo pendiente (${saldoPendiente.toFixed(2)}€)`, true);
                return;
            }

            orderPayments.push({
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
                orderPayments.splice(index, 1);
                renderPayments();
                updatePaymentSummary();
            }
        });
    }
});
