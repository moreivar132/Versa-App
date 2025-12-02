
import os

file_path = 'manager-taller-ordenes.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the start and end markers for the block we want to replace
start_marker = 'function setupCustomSelect({ inputId, optionsId, searchUrl, onSelect, renderOption }) {'
end_marker = 'setupCustomSelect({\n        inputId: \'new-item-name\','

# We need to find the end of the last setupCustomSelect call.
# It ends at line 1151 in the previous view, which is the closing }); for the last call.
# Let's look for the text after the block to be safe.
# Line 1154: // --- LÓGICA DE LA TABLA DE ITEMS ---

end_block_marker = '// --- LÓGICA DE LA TABLA DE ITEMS ---'

start_index = content.find(start_marker)
end_index = content.find(end_block_marker)

if start_index == -1 or end_index == -1:
    print("Error: Could not find the block to replace.")
    print(f"Start found: {start_index != -1}")
    print(f"End found: {end_index != -1}")
    exit(1)

# The new content to insert
new_code = """      const USE_MOCK_DATA = true; // Set to false when backend is fixed

      const MOCK_TECNICOS = [
        { id: 101, nombre: "Juan Pérez" },
        { id: 102, nombre: "Ana Gómez" },
        { id: 103, nombre: "Carlos Ruiz" }
      ];
      
      const MOCK_CLIENTES = [
        { id: 201, nombre: "Empresa ABC S.L.", dni: "B12345678", telefono: "600111222" },
        { id: 202, nombre: "Laura Martínez", dni: "12345678Z", telefono: "600333444" }
      ];

      const MOCK_VEHICULOS = [
        { id: 301, Marca: "Toyota", Propietario: "Corolla", Matricula: "1234-ABC" },
        { id: 302, Marca: "Ford", Propietario: "Focus", Matricula: "5678-DEF" }
      ];

      const MOCK_PRODUCTOS = [
        { id: 401, nombre: "Aceite 5W30", precio_venta: 45.50 },
        { id: 402, nombre: "Filtro de Aire", precio_venta: 15.20 },
        { id: 403, nombre: "Mano de Obra (h)", precio_venta: 50.00 },
        { id: 404, nombre: "Pastillas de Freno", precio_venta: 80.00 }
      ];

      // --- LÓGICA DE BÚSQUEDA DINÁMICA ---
      function setupCustomSelect({ inputId, optionsId, searchUrl, onSelect, renderOption, mockData = [] }) {
        const input = document.getElementById(inputId);
        const optionsContainer = document.getElementById(optionsId);
        let debounceTimeout;

        input.addEventListener("keyup", () => {
          clearTimeout(debounceTimeout);
          const query = input.value.toLowerCase();
          
          if (query.length < 1) {
            optionsContainer.innerHTML = '';
            optionsContainer.classList.remove('show');
            return;
          }

          debounceTimeout = setTimeout(() => {
            if (USE_MOCK_DATA) {
                console.log(`Buscando en MOCK data para ${inputId}...`);
                const results = mockData.filter(item => {
                    return Object.values(item).some(val => 
                        String(val).toLowerCase().includes(query)
                    );
                });
                renderResults(results);
                return;
            }

            fetch(searchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query: query })
            })
              .then(async response => {
                const responseText = await response.text();
                if (!response.ok) {
                  throw new Error(`Error de red: ${response.status} ${response.statusText} - ${responseText}`);
                }
                return responseText;
              })
              .then(text => {
                let data = [];
                try {
                  data = JSON.parse(text);
                } catch (e) {
                  console.error("Error parsing JSON:", text);
                  renderResults([]); 
                  return;
                }
                const results = Array.isArray(data) ? data : (data ? [data] : []);
                renderResults(results);
              })
              .catch(error => {
                console.error('Error durante la búsqueda:', error);
                optionsContainer.innerHTML = `<div class="option" style="color: var(--error-color);">Error de conexión.</div>`;
                optionsContainer.classList.add('show');
              });
          }, 300);
        });

        function renderResults(results) {
            optionsContainer.innerHTML = '';
            if (results.length > 0) {
              results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'option';
                div.innerHTML = renderOption(item);
                div.addEventListener('click', () => {
                  onSelect(item);
                  optionsContainer.classList.remove('show');
                });
                optionsContainer.appendChild(div);
              });
            } else {
              optionsContainer.innerHTML = `<div class="option" style="color: var(--text-secondary);">No se encontraron resultados.</div>`;
            }
            optionsContainer.classList.add('show');
        }

        document.addEventListener("click", (e) => {
          if (!input.contains(e.target) && !optionsContainer.contains(e.target) && !document.getElementById('add-item-btn').contains(e.target)) {
            optionsContainer.classList.remove('show');
          }
        });
      }

      // Configurar buscadores
      setupCustomSelect({
        inputId: 'tecnico',
        optionsId: 'tecnico-options',
        searchUrl: MAKE_TECHNICIAN_SEARCH_URL,
        mockData: MOCK_TECNICOS,
        renderOption: item => item.nombre,
        onSelect: item => {
          document.getElementById('tecnico').value = item.nombre;
          document.getElementById('id-tecnico-hidden').value = item.id; // CAPTURA DE ID
        }
      });
      setupCustomSelect({
        inputId: 'buscar-cliente',
        optionsId: 'cliente-options',
        searchUrl: MAKE_CLIENT_SEARCH_URL,
        mockData: MOCK_CLIENTES,
        renderOption: item => `${item.nombre} <small>(${item.dni || 'Sin DNI'})</small>`,
        onSelect: item => {
          document.getElementById('buscar-cliente').value = item.nombre;
          document.getElementById('cliente-info').textContent = `${item.dni || ''} | ${item.telefono || ''}`;
          document.getElementById('id-cliente-hidden').value = item.id; // CAPTURA DE ID
        }
      });
      setupCustomSelect({
        inputId: 'buscar-vehiculo',
        optionsId: 'vehiculo-options',
        searchUrl: MAKE_VEHICLE_SEARCH_URL,
        mockData: MOCK_VEHICULOS,
        renderOption: item => `${item.Marca} ${item.Propietario} <small>(${item.Matricula})</small>`,
        onSelect: item => {
          document.getElementById('buscar-vehiculo').value = `${item.Marca} ${item.Propietario}`;
          document.getElementById('vehiculo-info').textContent = item.Matricula;
          document.getElementById('id-vehiculo-hidden').value = item.id; // CAPTURA DE ID
        }
      });
      setupCustomSelect({
        inputId: 'new-item-name',
        optionsId: 'product-options',
        searchUrl: MAKE_PRODUCT_SEARCH_URL,
        mockData: MOCK_PRODUCTOS,
        renderOption: item => `${item.nombre} <small>(${parseFloat(item.precio_venta || 0).toFixed(2)}€)</small>`,
        onSelect: item => {
          document.getElementById('new-item-name').value = item.nombre;
          document.getElementById('new-item-price').value = parseFloat(item.precio_venta || 0).toFixed(2);
          document.getElementById('new-item-id-hidden').value = item.id; // CAPTURA DE ID
        }
      });

      
"""

# Construct the new file content
# We replace everything from start_marker to end_block_marker (exclusive of end_block_marker)
final_content = content[:start_index] + new_code + content[end_index:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Successfully patched the file.")
