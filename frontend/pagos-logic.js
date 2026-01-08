// --- GESTIÓN DE PAGOS ---
// Usar la variable global definida en el HTML principal
// Se inicializa si no existe (por seguridad)
if (typeof window.orderPayments === 'undefined') {
    window.orderPayments = [];
}

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
window.loadMediosPago = loadMediosPago;

// Función auxiliar para parsear el total de la orden correctamente
function parseTotalOrden() {
    let totalText = document.getElementById('summary-total')?.textContent || '0';
    // Limpiar formato: quitar €, espacios, y convertir coma a punto
    totalText = totalText.replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
    return parseFloat(totalText) || 0;
}

function updatePaymentSummary(totalOrden = null) {
    if (totalOrden === null) {
        totalOrden = parseTotalOrden();
    }

    const totalPagado = window.orderPayments.reduce((sum, p) => sum + (parseFloat(p.importe) || 0), 0);
    const saldoPendiente = Math.max(0, totalOrden - totalPagado);

    console.log('[Pagos] Total Orden:', totalOrden, 'Total Pagado:', totalPagado, 'Saldo Pendiente:', saldoPendiente);

    const totalPagadoEl = document.getElementById('resumen-total-pagado');
    const saldoPendienteEl = document.getElementById('resumen-saldo-pendiente');
    if (totalPagadoEl) totalPagadoEl.textContent = totalPagado.toFixed(2) + '€';
    if (saldoPendienteEl) saldoPendienteEl.textContent = saldoPendiente.toFixed(2) + '€';

    const badge = document.getElementById('pagos-badge');
    if (badge) {
        badge.textContent = window.orderPayments.length;
        badge.style.display = window.orderPayments.length > 0 ? 'inline' : 'none';
    }

    // Siempre actualizar el importe sugerido al saldo pendiente
    const importeInput = document.getElementById('nuevo-pago-importe');
    if (importeInput) {
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

        // Mapeo de códigos a nombres en español
        const codigoANombre = {
            'CASH': 'Efectivo',
            'CARD': 'Tarjeta',
            'TRANSFER': 'Transferencia'
        };

        window.orderPayments.forEach((pago, index) => {
            // Asegurar que metodoNombre tenga un valor en español
            let nombreMetodo = pago.metodoNombre || pago.nombreMedioPago;
            if (!nombreMetodo || nombreMetodo === 'Pago') {
                nombreMetodo = codigoANombre[pago.codigoMedioPago] || pago.codigoMedioPago || 'Pago';
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td style="color: var(--text-secondary);">${nombreMetodo}</td>
        <td style="text-align: right; font-weight: 600;">${parseFloat(pago.importe).toFixed(2)}€</td>
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

            // Parsear importe correctamente (manejar comas)
            let importeStr = importeInput?.value || '0';
            importeStr = importeStr.replace(',', '.');
            const importe = parseFloat(importeStr) || 0;

            const metodoId = metodoSelect?.value;

            // Obtener nombre del método de forma segura
            let metodoNombre = 'Pago';
            let metodoCodigo = '';
            if (metodoSelect && metodoSelect.selectedIndex >= 0 && metodoSelect.options[metodoSelect.selectedIndex]) {
                metodoNombre = metodoSelect.options[metodoSelect.selectedIndex].text || 'Pago';
                metodoCodigo = metodoSelect.options[metodoSelect.selectedIndex].dataset?.codigo || '';
            }

            const referencia = referenciaInput?.value || '';

            console.log('[Pagos] Agregando pago:', { metodoId, metodoNombre, importe });

            if (importe <= 0) {
                showToast('Ingresa un importe válido', true);
                return;
            }
            if (!metodoId) {
                showToast('Selecciona un método de pago', true);
                return;
            }

            const totalOrden = parseTotalOrden();
            const totalPagado = window.orderPayments.reduce((sum, p) => sum + (parseFloat(p.importe) || 0), 0);
            const saldoPendiente = totalOrden - totalPagado;

            if (importe > saldoPendiente + 0.01) {
                showToast(`El importe excede el saldo pendiente (${saldoPendiente.toFixed(2)}€)`, true);
                return;
            }

            window.orderPayments.push({
                idMedioPago: parseInt(metodoId),
                codigoMedioPago: metodoCodigo,
                metodoNombre: metodoNombre,
                importe: importe,
                referencia: referencia || null,
                idCaja: 1
            });

            console.log('[Pagos] Pagos actuales:', window.orderPayments);

            if (importeInput) importeInput.value = '';
            if (referenciaInput) referenciaInput.value = '';

            renderPayments();
            updatePaymentSummary(totalOrden);
            showToast(`Pago de ${importe.toFixed(2)}€ agregado`);
        });
    }

    // Eliminar pago
    const pagosTbody = document.getElementById('pagos-tbody');
    if (pagosTbody) {
        pagosTbody.addEventListener('click', (e) => {
            // Buscar el botón de eliminar (puede ser el target o un ancestro)
            const btn = e.target.closest('.remove-pago-btn');
            if (btn) {
                const index = parseInt(btn.dataset.index);
                console.log('[Pagos] Click en eliminar, index:', index);

                const pagoEliminado = window.orderPayments[index];
                console.log('[Pagos] Pago a eliminar:', pagoEliminado);

                // Si el pago tiene id (existe en el backend), guardarlo para eliminarlo
                if (pagoEliminado && pagoEliminado.id) {
                    window.pagosEliminados = window.pagosEliminados || [];
                    window.pagosEliminados.push(pagoEliminado.id);
                    console.log('[Pagos] Pago marcado para eliminar del backend:', pagoEliminado.id);
                    console.log('[Pagos] Lista de pagos a eliminar:', window.pagosEliminados);
                }

                window.orderPayments.splice(index, 1);
                renderPayments();
                updatePaymentSummary();
            }
        });
    }
});
