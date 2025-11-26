import Quagga from 'quagga';

const INVENTORY_SAVE_URL = import.meta.env.VITE_MAKE_INVENTORY_SAVE_URL ||
  'https://hook.eu2.make.com/vbjlx6f4oejtywzdvf6htry4zyzrganx';
const PRODUCT_SEARCH_URL = import.meta.env.VITE_MAKE_PRODUCT_SEARCH_URL ||
  'https://hook.eu2.make.com/8xfyw4ki7ja73vtb2rwbkr3pq1kxcdx8';
const PROVIDER_SEARCH_URL = import.meta.env.VITE_MAKE_PROVIDER_SEARCH_URL ||
  'https://hook.eu2.make.com/6qejq4jka5nh6l5itx0rxjt54k7y23lm';

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
        const optionText = inputId === 'codigo_barras_articulo'
          ? `${item.codigo_barras_articulo || ''} - ${item.nombre || ''}`
          : (item.nombre || item);

        div.className = 'option';
        div.textContent = optionText;

        div.addEventListener('click', () => {
          if (onSelectCallback) {
            onSelectCallback(item);
          } else {
            input.value = item.nombre || item;
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
      fetch(`${searchUrl}?query=${encodeURIComponent(query)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Error de red: ${response.statusText}`);
          }
          return response.text();
        })
        .then((text) => {
          let data;
          try {
            data = text ? JSON.parse(text) : [];
          } catch (e) {
            console.warn('La respuesta de búsqueda no era un JSON válido:', text);
            renderOptions([]);
            optionsContainer.classList.add('show');
            return;
          }

          let processedData;
          if (Array.isArray(data)) {
            processedData = data.map((item) => item.Body || item);
          } else if (data && data.Body) {
            processedData = Array.isArray(data.Body) ? data.Body : [data.Body];
          } else {
            processedData = Array.isArray(data) ? data : [data];
          }

          const finalResults = processedData
            .map((item) => {
              if (typeof item === 'string') {
                try { return JSON.parse(item); } catch (e) { return null; }
              }
              return item;
            })
            .filter(Boolean);

          renderOptions(finalResults);
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
  setValue('codigo_barras_articulo', product.codigo_barras_articulo);
  setValue('modelo', product.modelo);
  setValue('descripcion', product.descripcion);
  setValue('marca', product.marca);
  setValue('id_categoria', product.id_categoria);
  setValue('proveedor', product.proveedor);
  setValue('costo_compra', product.costo_compra);
  setValue('iva', product.iva || '21');
  setValue('recargo', product.recargo);
  setValue('precio_venta_bruto', product.precio_venta_bruto);
  setValue('stock', product.stock);
  setValue('stock_minimo', product.stock_minimo);
  setValue('unidad_medida', product.unidad_medida || 'UNIDAD');
  setValue('taller', product.taller);
  const activeInput = document.getElementById('activo');
  if (activeInput instanceof HTMLInputElement) {
    activeInput.checked = product.activo === 'SI' || product.activo === true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inventory-form');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const activeInput = document.getElementById('activo');
    data.activo = activeInput?.checked ? 'SI' : 'NO';

    fetch(INVENTORY_SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then((response) => {
        if (!response.ok) throw new Error('La respuesta del servidor no fue exitosa.');
        return response.text();
      })
      .then(() => {
        showSuccessModal();
      })
      .catch((err) => {
        console.error('Error al guardar el producto:', err);
        alert('Hubo un error al guardar el producto.');
      });
  });

  const costoCompraInput = document.getElementById('costo_compra');
  const recargoInput = document.getElementById('recargo');
  const precioVentaBrutoInput = document.getElementById('precio_venta_bruto');

  const calculateSellingPrice = () => {
    const costo = parseFloat(costoCompraInput?.value) || 0;
    const recargo = parseFloat(recargoInput?.value) || 0;

    if (costo > 0 && precioVentaBrutoInput) {
      const precioVenta = costo * (1 + recargo / 100);
      precioVentaBrutoInput.value = precioVenta.toFixed(2);
    }
  };

  costoCompraInput?.addEventListener('input', calculateSellingPrice);
  recargoInput?.addEventListener('input', calculateSellingPrice);

  setupCustomSelect('codigo_barras_articulo', 'product-options', PRODUCT_SEARCH_URL, populateFormWithProduct);
  setupCustomSelect('proveedor', 'provider-options', PROVIDER_SEARCH_URL, (provider) => {
    const providerInput = document.getElementById('proveedor');
    if (providerInput) providerInput.value = provider.nombre;
  });

  const successModal = document.getElementById('success-modal');
  const closeSuccessModalBtn = document.getElementById('close-success-modal');

  function showSuccessModal() {
    successModal?.classList.add('show');
  }
  function closeSuccessModal() {
    successModal?.classList.remove('show');
    form.reset();
  }
  closeSuccessModalBtn?.addEventListener('click', closeSuccessModal);

  const scannerModal = document.getElementById('scanner-modal');
  const scanBtn = document.getElementById('scan-barcode-btn');
  const closeScannerBtn = document.getElementById('close-scanner');
  let scannerRunning = false;

  const stopScanner = () => {
    if (scannerModal) scannerModal.style.display = 'none';
    if (scannerRunning) {
      Quagga.stop();
      scannerRunning = false;
    }
  };

  scanBtn?.addEventListener('click', () => {
    if (!scannerModal) return;
    scannerModal.style.display = 'flex';
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
