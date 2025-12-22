import { loadSucursales } from './loadSucursales.js';
import { searchClientes, createClient } from './services/clientes-service.js';
import { searchInventario, createProduct } from './services/inventory-service.js';
import { createVenta } from './services/ventas-service.js';
import '/components/datetime-picker.js';

let salesItems = [];
let clienteMostradorId = null;

// UI Helpers
const showToast = (message, isError = false) => {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    msgEl.textContent = message;

    // Reset classes
    toast.className = `fixed bottom-5 right-5 z-[100] bg-[#1e242d] text-white px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 transform transition-all duration-300 ${isError ? 'border-red-500' : 'border-green-500'}`;

    // Show
    toast.classList.remove('translate-y-20', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Sucursales
    loadSucursales(); // Populates #taller

    // 2. Set Date/Time
    if (window.VersaDateTimePicker) {
        window.VersaDateTimePicker.initDateTimePicker('fecha-venta');
    }

    // 3. Init Buttons
    document.getElementById('btn-cliente-rapido').addEventListener('click', setClienteMostrador);
    document.getElementById('btn-new-client').addEventListener('click', () => {
        document.getElementById('new-client-modal').classList.remove('hidden');
    });
    document.getElementById('btn-new-product').addEventListener('click', () => {
        // Pre-fill sucursal logic if needed?
        if (!document.getElementById('taller').value) {
            showToast("Selecciona sucursal primero", true);
            return;
        }
        document.getElementById('new-product-modal').classList.remove('hidden');
    });

    // 4. Client Search
    setupClientSearch();
    document.getElementById('new-client-form').addEventListener('submit', handleNewClientSubmit);

    // 5. Product Search
    setupProductSearch();
    document.getElementById('new-product-form').addEventListener('submit', handleNewProductSubmit);

    // 6. Init Form Submit
    document.getElementById('sales-form').addEventListener('submit', handleSaleSubmit);

    // 7. Add Item Logic
    document.getElementById('add-item-btn').addEventListener('click', addItemToCart);

    // 8. Clean / Global Helpers
    document.getElementById('btn-limpiar').addEventListener('click', resetForm);
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('success-modal').classList.add('hidden');
        resetForm();
    });

    // Pending Item Logic
    ['new-item-quantity', 'new-item-price', 'new-item-discount', 'new-item-iva'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePendingItemTotal);
    });
});

// --- Logic ---

async function setClienteMostrador() {
    const input = document.getElementById('buscar-cliente');

    input.value = "Buscando...";
    input.disabled = true;

    try {
        const results = await searchClientes("Cliente Mostrador");
        let client = results.find(c => c.nombre.toLowerCase().includes("mostrador"));

        if (!client) {
            client = await createClient({
                nombre: "Cliente Mostrador",
                documento: "000000000",
                telefono: "000000000",
                direccion: "Mostrador",
                email: "noreply@mostrador.com"
            });
        }

        if (client) {
            clienteMostradorId = client.id;
            selectClient(client);
            showToast("Cliente Mostrador seleccionado");
        }
    } catch (error) {
        console.error(error);
        showToast("Error al asignar Cliente Mostrador", true);
        input.value = "";
    } finally {
        input.disabled = false;
    }
}

function selectClient(client) {
    document.getElementById('buscar-cliente').value = client.nombre;
    document.getElementById('id-cliente-hidden').value = client.id;
    document.getElementById('cliente-options').classList.remove('show');
}

async function handleNewClientSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const newClient = await createClient(data);
        selectClient(newClient);
        showToast("Cliente creado correctamente");
        document.getElementById('new-client-modal').classList.add('hidden');
        e.target.reset();
    } catch (err) {
        showToast(err.message, true);
    }
}

// Search Setup Helpers
function setupClientSearch() {
    const input = document.getElementById('buscar-cliente');
    const options = document.getElementById('cliente-options');
    let timer;

    input.addEventListener('input', () => {
        clearTimeout(timer);
        if (input.value.length < 2) { options.classList.remove('show'); return; }

        timer = setTimeout(async () => {
            const results = await searchClientes(input.value);
            options.innerHTML = '';

            if (results.length > 0) {
                results.forEach(c => {
                    const div = document.createElement('div');
                    div.className = 'option';
                    div.innerHTML = `
                        <div class="font-bold">${c.nombre}</div>
                        <div class="text-xs text-gray-400">${c.documento || ''} - ${c.telefono || ''}</div>
                    `;
                    div.onclick = () => selectClient(c);
                    options.appendChild(div);
                });
            }

            // Always add "Create new client" option at the end
            const divNew = document.createElement('div');
            divNew.className = 'option';
            divNew.style.background = '#1a1d24';
            divNew.style.borderTop = '1px solid #282e39';
            divNew.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; color: #ff652b;">
                    <i class="fas fa-plus-circle"></i>
                    <span style="font-weight: bold;">Crear nuevo cliente</span>
                </div>
                <div style="font-size: 12px; color: #9da6b9;">Registrar "${input.value}" como nuevo cliente</div>
            `;
            divNew.onclick = () => {
                // Pre-fill the modal with the searched name
                document.getElementById('new-client-form').querySelector('[name="nombre"]').value = input.value;
                document.getElementById('new-client-modal').classList.remove('hidden');
                options.classList.remove('show');
            };
            options.appendChild(divNew);
            options.classList.add('show');
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !options.contains(e.target) && !e.target.closest('#btn-cliente-rapido') && !e.target.closest('#btn-new-client')) {
            options.classList.remove('show');
        }
    });
}

function setupProductSearch() {
    const input = document.getElementById('new-item-name');
    const options = document.getElementById('product-options');
    const sucursalSelect = document.getElementById('taller');
    let timer;

    input.addEventListener('input', () => {
        const idSucursal = sucursalSelect.value;
        if (!idSucursal) {
            showToast("Seleccione una sucursal primero", true);
            return;
        }

        clearTimeout(timer);
        if (input.value.length < 2) { options.classList.remove('show'); return; }

        timer = setTimeout(async () => {
            const results = await searchInventario(input.value, idSucursal);

            options.innerHTML = '';
            if (results && results.length > 0) {
                results.forEach(p => {
                    // if (p.stock <= 0) return; 

                    const div = document.createElement('div');
                    div.className = 'option';
                    div.innerHTML = `
                        <div class="flex justify-between">
                            <span class="font-bold text-white">${p.nombre}</span>
                            <span class="text-[var(--brand-orange)] font-bold">${parseFloat(p.precio).toFixed(2)}€</span>
                        </div>
                        <div class="text-xs text-gray-400 flex justify-between">
                            <span>Cod: ${p.codigo_barras || 'N/A'}</span>
                            <span>Stock: ${p.stock}</span>
                        </div>
                    `;
                    div.onclick = () => selectProduct(p);
                    options.appendChild(div);
                });
                options.classList.add('show');
            } else {
                options.classList.remove('show');
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !options.contains(e.target)) options.classList.remove('show');
    });
}

async function handleNewProductSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Add context if needed
    data.id_sucursal = document.getElementById('taller').value;
    data.tipo = 'PRODUCTO'; // Default type
    data.iva = 21; // Default

    try {
        const newProduct = await createProduct(data);
        selectProduct(newProduct);
        showToast("Producto creado correctamente");
        document.getElementById('new-product-modal').classList.add('hidden');
        e.target.reset();
    } catch (err) {
        showToast(err.message, true);
    }
}

let currentSelectedProduct = null;

function selectProduct(product) {
    currentSelectedProduct = product;
    document.getElementById('new-item-name').value = product.nombre;
    document.getElementById('new-item-id-hidden').value = product.id;
    document.getElementById('new-item-price').value = parseFloat(product.precio).toFixed(2);
    document.getElementById('new-item-stock').value = product.stock;

    document.getElementById('new-item-quantity').value = 1;
    document.getElementById('new-item-discount').value = 0;
    document.getElementById('new-item-quantity').focus();

    updatePendingItemTotal();

    document.getElementById('product-options').classList.remove('show');
}

function updatePendingItemTotal() {
    const qty = parseFloat(document.getElementById('new-item-quantity').value) || 0;
    const price = parseFloat(document.getElementById('new-item-price').value) || 0;
    const discount = parseFloat(document.getElementById('new-item-discount').value) || 0;
    const iva = parseFloat(document.getElementById('new-item-iva').value) || 21;

    const baseTotal = qty * price;
    const discountAmount = baseTotal * (discount / 100);
    const subtotal = baseTotal - discountAmount;
    const ivaAmount = subtotal * (iva / 100);
    const total = subtotal + ivaAmount;

    document.getElementById('new-item-total').textContent = total.toFixed(2) + '€';
}

function addItemToCart() {
    let name = document.getElementById('new-item-name').value;
    let qty = parseFloat(document.getElementById('new-item-quantity').value) || 0;
    let price = parseFloat(document.getElementById('new-item-price').value) || 0;
    let stock = parseFloat(document.getElementById('new-item-stock').value) || 0;
    let discount = parseFloat(document.getElementById('new-item-discount').value) || 0;
    let iva = parseFloat(document.getElementById('new-item-iva').value) || 21;
    let idProducto = document.getElementById('new-item-id-hidden').value;

    if (!name || qty <= 0 || price < 0) {
        showToast("Datos inválidos", true);
        return;
    }

    if (!idProducto && !currentSelectedProduct) {
        // Ad-hoc item sin ID
    }

    // Check stock only if real product
    if (idProducto && qty > stock) {
        showToast(`Stock insuficiente (Máx: ${stock})`, true);
        return;
    }

    const subtotal = (price * qty) * (1 - discount / 100);
    const ivaAmount = subtotal * (iva / 100);
    const total = subtotal + ivaAmount;

    // Add to cart
    salesItems.push({
        idProducto: idProducto ? parseInt(idProducto) : null,
        nombre: name,
        precio: price,
        cantidad: qty,
        stock: stock,
        descuento: discount,
        iva: iva,
        subtotal: subtotal,
        total: total
    });

    renderCart();

    // Reset footer inputs
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-id-hidden').value = '';
    document.getElementById('new-item-price').value = '';
    document.getElementById('new-item-stock').value = '-';
    document.getElementById('new-item-quantity').value = 1;
    document.getElementById('new-item-discount').value = '';
    document.getElementById('new-item-iva').value = 21;
    document.getElementById('new-item-total').textContent = '0.00€';
    currentSelectedProduct = null;
    document.getElementById('new-item-name').focus();
}

function renderCart() {
    const tbody = document.getElementById('sales-items-list');
    tbody.innerHTML = '';

    if (salesItems.length === 0) {
        tbody.innerHTML = '<tr id="empty-cart-msg"><td colspan="8" class="p-8 text-center text-gray-500 italic">No hay productos en la venta</td></tr>';
        updateTotals();
        return;
    }

    salesItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-[#282e39] hover:bg-[#111318]/50';

        // Editable Inputs with IVA column
        tr.innerHTML = `
            <td class="p-2">
                <input type="text" class="form-input text-sm bg-transparent border-none text-white focus:bg-[#1a1d24]" 
                    value="${item.nombre}" onchange="updateItem(${index}, 'nombre', this.value)">
            </td>
            <td class="p-2 w-24">
                <input type="number" class="form-input text-sm bg-transparent border-none text-[#9da6b9] focus:bg-[#1a1d24] text-right" 
                    value="${item.precio}" step="0.01" onchange="updateItem(${index}, 'precio', this.value)">
            </td>
            <td class="p-2 w-20">
                <input type="number" class="form-input text-sm bg-transparent border-none text-[#9da6b9] focus:bg-[#1a1d24] text-center" 
                    value="${item.descuento}" min="0" max="100" onchange="updateItem(${index}, 'descuento', this.value)">
            </td>
            <td class="p-2 w-16">
                <input type="number" class="form-input text-sm bg-transparent border-none text-[#9da6b9] focus:bg-[#1a1d24] text-center" 
                    value="${item.iva}" min="0" max="100" onchange="updateItem(${index}, 'iva', this.value)">
            </td>
            <td class="p-2 w-16 text-[#9da6b9] text-center">${item.stock}</td>
            <td class="p-2 w-16">
                <input type="number" class="form-input text-sm bg-transparent border-none text-white focus:bg-[#1a1d24] text-center" 
                    value="${item.cantidad}" min="1" onchange="updateItem(${index}, 'cantidad', this.value)">
            </td>
            <td class="p-2 w-24 text-white font-bold text-right">${item.total.toFixed(2)}€</td>
            <td class="p-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-400" onclick="removeItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateTotals();
}

window.updateItem = (index, field, value) => {
    const item = salesItems[index];

    if (field === 'nombre') item.nombre = value;
    if (field === 'precio') item.precio = parseFloat(value) || 0;
    if (field === 'cantidad') item.cantidad = parseFloat(value) || 0;
    if (field === 'descuento') item.descuento = parseFloat(value) || 0;
    if (field === 'iva') item.iva = parseFloat(value) || 21;

    // Recalculate Total with IVA
    const subtotal = (item.precio * item.cantidad) * (1 - item.descuento / 100);
    const ivaAmount = subtotal * (item.iva / 100);
    item.subtotal = subtotal;
    item.total = subtotal + ivaAmount;

    renderCart(); // Re-render to show updated row totals
};

window.removeItem = (index) => {
    salesItems.splice(index, 1);
    renderCart();
};

function updateTotals() {
    let subtotal = 0;
    let totalIva = 0;

    salesItems.forEach(item => {
        const itemSubtotal = item.subtotal || (item.precio * item.cantidad) * (1 - item.descuento / 100);
        const ivaAmount = itemSubtotal * ((item.iva || 21) / 100);
        subtotal += itemSubtotal;
        totalIva += ivaAmount;
    });

    const total = subtotal + totalIva;

    // Determine average IVA percentage for display
    const avgIva = salesItems.length > 0
        ? salesItems.reduce((sum, item) => sum + (item.iva || 21), 0) / salesItems.length
        : 21;

    document.getElementById('summary-subtotal').textContent = subtotal.toFixed(2) + '€';

    // Update IVA label if mixed rates
    const ivaLabel = document.querySelector('td:has(+ #summary-iva), .summary-table tr:nth-child(2) td:first-child');
    if (ivaLabel) {
        ivaLabel.textContent = `IVA (${avgIva.toFixed(0)}%)`;
    }

    document.getElementById('summary-iva').textContent = totalIva.toFixed(2) + '€';
    document.getElementById('display-total').textContent = total.toFixed(2) + '€';
}

async function handleSaleSubmit(e) {
    e.preventDefault();

    if (salesItems.length === 0) {
        showToast("No hay productos en la venta", true);
        return;
    }

    const idSucursal = document.getElementById('taller').value;
    const idCliente = document.getElementById('id-cliente-hidden').value;

    if (!idSucursal || !idCliente) {
        showToast("Falta sucursal o cliente", true);
        return;
    }

    const totalDisplay = parseFloat(document.getElementById('display-total').textContent.replace('€', ''));
    const cajaValue = document.getElementById('caja').value;

    const ventaData = {
        idSucursal: parseInt(idSucursal),
        idCliente: parseInt(idCliente),
        idCaja: cajaValue ? parseInt(cajaValue) : null,
        observaciones: document.getElementById('observaciones').value || 'Venta Rápida',

        lineas: salesItems.map(item => ({
            idProducto: item.idProducto,
            cantidad: item.cantidad,
            precio: item.precio,
            descripcion: item.nombre,
            iva: item.iva || 21,
            descuento: item.descuento || 0
        })),

        pagos: [{
            codigoMedioPago: document.getElementById('medio-pago').value,
            importe: totalDisplay,
            idCaja: cajaValue ? parseInt(cajaValue) : null,
            referencia: 'Venta Mostrador'
        }]
    };

    try {
        await createVenta(ventaData);
        document.getElementById('success-modal').classList.remove('hidden');
    } catch (error) {
        console.error(error);
        showToast(error.message || "Error al registrar venta", true);
    }
}

function resetForm() {
    salesItems = [];
    renderCart();
    document.getElementById('buscar-cliente').value = '';
    document.getElementById('id-cliente-hidden').value = '';
    document.getElementById('display-total').textContent = '0.00€';
    document.getElementById('observaciones').value = '';

    // Clear footer inputs
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-price').value = '';
}
