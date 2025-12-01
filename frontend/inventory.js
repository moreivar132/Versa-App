import Quagga from 'quagga';

// Endpoints
const API_BASE_URL = '/api/inventory';
const PROVIDERS_SEARCH_URL = '/api/proveedores/search'; // Assuming this exists or will be created

function setupCustomSelect(inputId, optionsId, searchUrl, onSelectCallback) {
  const input = document.getElementById(inputId);
  const optionsContainer = document.getElementById(optionsId);
  if (!input || !optionsContainer) return;

  let debounceTimeout;

  function renderOptions(data) {
    optionsContainer.innerHTML = '';
    if (data.length > 0) {
      data.forEach((item) => {
        const div = document.createElement('div');
        // Determine display text based on input type
        let optionText = '';
        if (inputId === 'codigo_barras_articulo') {
          optionText = `${item.codigo_barras || item.codigo_barras_articulo || ''} - ${item.nombre || ''}`;
        } else if (inputId === 'proveedor') {
          optionText = item.nombre || item.nombre_empresa || item;
        } else {
          optionText = item.nombre || item;
        }

        div.className = 'option';
        div.textContent = optionText;

        div.addEventListener('click', () => {
          if (onSelectCallback) {
            onSelectCallback(item);
          } else {
            input.value = optionText;
          }
          optionsContainer.classList.remove('show');
        });
        optionsContainer.appendChild(div);
      });
    } else {
      optionsContainer.innerHTML = '<div class="option" style="cursor:default;">No se encontraron resultados</div>';
    }
  }

  input.addEventListener('focus', () => {
    if (input.value.length > 1) optionsContainer.classList.add('show');
  });

  input.addEventListener('keyup', () => {
    clearTimeout(debounceTimeout);
    const query = input.value;
    if (query.length < 2) {
      optionsContainer.classList.remove('show');
      return;
    }

    debounceTimeout = setTimeout(() => {
      // Use searchUrl if provided, otherwise default to inventory search
      const url = searchUrl ? `${searchUrl}?q=${encodeURIComponent(query)}` : `${API_BASE_URL}/search?q=${encodeURIComponent(query)}`;

      fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
        }
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Error de red: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          // Normalize data structure if needed
          const results = Array.isArray(data) ? data : (data.results || []);
          renderOptions(results);
          optionsContainer.classList.add('show');
        })
        .catch((err) => {
          console.error(`Error en la búsqueda de ${inputId}:`, err.message);
          optionsContainer.innerHTML = '<div class="option" style="cursor:default;">Error al buscar</div>';
          optionsContainer.classList.add('show');
        });
    }, 300);
  });

  document.addEventListener('click', (event) => {
    if (!input.contains(event.target) && !optionsContainer.contains(event.target)) {
      optionsContainer.classList.remove('show');
    }
  });
}

function populateFormWithProduct(product) {
  if (!product) return;

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
  };

  setValue('nombre', product.nombre);
  setValue('codigo_barras_articulo', product.codigo_barras || product.codigo_barras_articulo);
  setValue('modelo', product.modelo);
  setValue('descripcion', product.descripcion);
  setValue('marca', product.marca);
  setValue('id_categoria', product.categoria || product.id_categoria); // Handle both naming conventions
  setValue('proveedor', product.proveedor_nombre || product.proveedor); // Assuming we get name or ID
  setValue('costo_compra', product.costo || product.costo_compra);
  setValue('iva', product.iva || '21');
  setValue('recargo', product.recargo); // Need to ensure this exists in DB or calculate it
  setValue('precio_venta_bruto', product.precio || product.precio_venta_bruto);
  setValue('stock', product.stock_actual || product.stock); // Check DB column name
  setValue('stock_minimo', product.stock_minimo);
  setValue('unidad_medida', product.unidad_medida || 'UNIDAD');
  setValue('taller', product.sucursal_nombre || product.taller); // Need to handle sucursal mapping

  const activeInput = document.getElementById('activo');
  if (activeInput instanceof HTMLInputElement) {
    activeInput.checked = product.activo === true || product.activo === 'SI';
  }

  // Trigger calculation
  const costoInput = document.getElementById('costo_compra');
  if (costoInput) costoInput.dispatchEvent(new Event('input'));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inventory-form');
  if (!form) return;

  // Helper to get headers with token
  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  };

  // --- Populate Sucursales ---
  const tallerInput = document.getElementById('taller');
  if (tallerInput) {
    // Create a datalist or custom dropdown for sucursales if not exists
    // For now, let's assume it's a simple select or we convert it to one, 
    // BUT the HTML has a specific design. Let's try to fetch and if it's a custom select, populate it.
    // The HTML shows:
    // <div class="relative custom-select-container">
    //   <input type="text" id="taller" ... readonly>
    //   <div id="taller-options" class="options-container ..."></div>
    // </div>

    // So we need to populate #taller-options and handle click.
    const tallerOptions = document.getElementById('taller-options');

    fetch('/api/sucursales', { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && tallerOptions) {
          tallerOptions.innerHTML = '';
          data.forEach(sucursal => {
            const div = document.createElement('div');
            div.className = 'option';
            div.textContent = sucursal.nombre;
            div.dataset.id = sucursal.id;
            div.addEventListener('click', () => {
              tallerInput.value = sucursal.nombre;
              // Store ID if needed, maybe in a hidden field or dataset
              tallerInput.dataset.selectedId = sucursal.id;
              tallerOptions.classList.remove('show');
            });
            tallerOptions.appendChild(div);
          });

          // Toggle options visibility
          tallerInput.addEventListener('click', () => {
            tallerOptions.classList.toggle('show');
          });

          // Close on click outside
          document.addEventListener('click', (e) => {
            if (!tallerInput.contains(e.target) && !tallerOptions.contains(e.target)) {
              tallerOptions.classList.remove('show');
            }
          });
        }
      })
      .catch(err => console.error('Error fetching sucursales:', err));
  }

  // --- Form Submission ---
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Handle Checkbox
    const activeInput = document.getElementById('activo');
    data.activo = activeInput?.checked ? true : false;

    // Convert numeric fields
    ['costo_compra', 'recargo', 'precio_venta_bruto', 'iva', 'stock', 'stock_minimo'].forEach(field => {
      if (data[field]) data[field] = parseFloat(data[field]);
    });

    fetch(API_BASE_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })
      .then((response) => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.message || 'Error del servidor'); });
        return response.json();
      })
      .then(() => {
        showSuccessModal();
      })
      .catch((err) => {
        console.error('Error al guardar el producto:', err);
        alert(`Hubo un error al guardar el producto: ${err.message}`);
      });
  });

  // --- Price Calculation Logic ---
  const costoCompraInput = document.getElementById('costo_compra');
  const recargoInput = document.getElementById('recargo');
  const precioVentaBrutoInput = document.getElementById('precio_venta_bruto');

  const calculateSellingPrice = () => {
    const costo = parseFloat(costoCompraInput?.value) || 0;
    const recargo = parseFloat(recargoInput?.value) || 0;

    if (costo > 0) {
      const precioVenta = costo * (1 + recargo / 100);
      if (precioVentaBrutoInput) precioVentaBrutoInput.value = precioVenta.toFixed(2);
    }
  };

  // Reverse calculation: if price changes, update recargo
  const calculateRecargo = () => {
    const costo = parseFloat(costoCompraInput?.value) || 0;
    const precio = parseFloat(precioVentaBrutoInput?.value) || 0;

    if (costo > 0 && precio > 0) {
      const recargo = ((precio / costo) - 1) * 100;
      if (recargoInput) recargoInput.value = recargo.toFixed(2);
    }
  }

  costoCompraInput?.addEventListener('input', calculateSellingPrice);
  recargoInput?.addEventListener('input', calculateSellingPrice);
  precioVentaBrutoInput?.addEventListener('input', calculateRecargo);

  // --- Autocomplete Setup ---
  // Search products by barcode or name
  setupCustomSelect('codigo_barras_articulo', 'product-options', `${API_BASE_URL}/search`, populateFormWithProduct);

  // Search providers
  setupCustomSelect('proveedor', 'provider-options', PROVIDERS_SEARCH_URL, (provider) => {
    const providerInput = document.getElementById('proveedor');
    if (providerInput) {
      providerInput.value = provider.nombre || provider.nombre_empresa;
      // Optionally store ID in a hidden field if needed
    }
  });

  // --- Success Modal ---
  const successModal = document.getElementById('success-modal');
  const closeSuccessModalBtn = document.getElementById('close-success-modal');

  function showSuccessModal() {
    if (successModal) {
      successModal.classList.remove('invisible', 'opacity-0');
      successModal.classList.add('show'); // Ensure CSS handles this or use inline styles
      // Fallback if CSS class 'show' isn't defined for opacity/visibility
      successModal.style.visibility = 'visible';
      successModal.style.opacity = '1';
    }
  }
  function closeSuccessModal() {
    if (successModal) {
      successModal.classList.add('invisible', 'opacity-0');
      successModal.classList.remove('show');
      successModal.style.visibility = 'hidden';
      successModal.style.opacity = '0';
    }
    form.reset();
  }
  closeSuccessModalBtn?.addEventListener('click', closeSuccessModal);

  // --- Barcode Scanner ---
  const scannerModal = document.getElementById('scanner-modal');
  const scanBtn = document.getElementById('scan-barcode-btn');
  const closeScannerBtn = document.getElementById('close-scanner');
  let scannerRunning = false;

  const stopScanner = () => {
    if (scannerModal) scannerModal.classList.add('hidden');
    if (scannerRunning) {
      Quagga.stop();
      scannerRunning = false;
    }
  };

  scanBtn?.addEventListener('click', () => {
    if (!scannerModal) return;
    scannerModal.classList.remove('hidden');
    scannerModal.style.display = 'flex'; // Ensure flex is applied

    Quagga.init({
      inputStream: { name: 'Live', type: 'LiveStream', target: document.querySelector('#scanner-video'), constraints: { facingMode: 'environment' } },
      decoder: { readers: ['ean_reader', 'code_128_reader'] }
    }, (err) => {
      if (err) { console.error(err); alert('Error al iniciar el escáner.'); return; }
      Quagga.start();
      scannerRunning = true;
    });
  });

  Quagga.onDetected((data) => {
    const barcodeInput = document.getElementById('codigo_barras_articulo');
    if (!barcodeInput) return;
    barcodeInput.value = data.codeResult.code;
    // Trigger search
    barcodeInput.dispatchEvent(new Event('keyup', { bubbles: true }));
    stopScanner();
  });

  closeScannerBtn?.addEventListener('click', stopScanner);
  scannerModal?.addEventListener('click', (event) => {
    if (event.target === scannerModal) {
      stopScanner();
    }
  });
});
