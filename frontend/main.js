import { requireAuth, clearSession } from './auth.js';
import './admin.js';  // Import admin module to ensure it's processed by Vite

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// ====== CONFIG ======
const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;
const LS_KEY = 'portal_facturas_v2';

let cachedUser = null;

(async function enforceAuth() {
  const user = await requireAuth();
  if (!user) return;

  cachedUser = user;
  const isAdmin = Boolean(user.is_super_admin || user.role === 'admin');
  const roleLabel = isAdmin ? 'Administrador' : 'Usuario';

  document.body?.setAttribute('data-user-role', isAdmin ? 'admin' : 'empleado');

  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.textContent = `${user.nombre || user.email} · ${roleLabel}`;
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  if (mobileUserInfo) mobileUserInfo.textContent = user.nombre || user.email;

  document.querySelectorAll('[data-requires="admin"]').forEach((el) => {
    if (isAdmin) {
      el.removeAttribute('hidden');
      el.style.display = '';
    } else {
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    }
  });

  const logoutBtn = document.getElementById('btnLogout');
  logoutBtn?.addEventListener('click', () => {
    clearSession();
    window.location.replace('login.html');
  });
})();

// Activa/Desactiva filtros (para pruebas, mejor FALSE)
const STRICT_FILTERS = false;   // si algo falla déjalo en false
const AREA_OPTIONS = Object.freeze(['Flota', 'Taller', 'Bicicletas']);
const NATURALEZA_OPTIONS = Object.freeze(['Ingreso', 'Egreso']);
const PAYMENT_METHODS = ['Tarjeta', 'Transferencia', 'Efectivo'];
const CATEGORY_OPTIONS = [
  'Combustible',
  'Mantenimiento',
  'Recambios',
  'Seguros',
  'Alquiler',
  'Nóminas',
  'Suscripciones',
  'Impuestos',
  'Servicios externos',
  'Ventas',
  'Reparaciones',
  'Electricidad / Agua / Luz',
  'Publicidad',
  'Herramientas / Equipos',
  'Otros'
];

const DEFAULT_LOTE_META = Object.freeze({
  descripcion: '',
  area: '',
  naturaleza: 'Egreso',
  metodoPago: 'Tarjeta',
  categoria: 'Otros',
  fecha: '',
  subtotal: '',
  iva: '',
  total: '',
  notas: ''
});

const CSV_FIELD_LABELS = Object.freeze({
  descripcion: 'Descripción',
  area: 'Área',
  naturaleza: 'Naturaleza',
  metodoPago: 'Método de pago',
  categoria: 'Categoría',
  fecha: 'Fecha',
  subtotal: 'Subtotal',
  iva: 'IVA',
  total: 'Total',
  notas: 'Notas'
});

const CSV_FIELD_MAP = Object.freeze({
  descripcion: ['descripcion', 'descripción', 'description', 'detalle', 'concepto'],
  area: ['area', 'área', 'departamento', 'unidad'],
  naturaleza: ['naturaleza', 'tipo', 'tipomovimiento'],
  metodoPago: ['metodopago', 'metodo_pago', 'metodo-de-pago', 'pago', 'forma_pago'],
  categoria: ['categoria', 'categoría', 'rubro'],
  fecha: ['fecha', 'fechaemision', 'fechafactura', 'fecha_documento', 'date'],
  subtotal: ['subtotal', 'neto', 'importe', 'base'],
  iva: ['iva', 'impuesto', 'tax'],
  total: ['total', 'monto', 'importe_total', 'totalfactura'],
  notas: ['notas', 'comentarios', 'observaciones', 'notes']
});

const CSV_REQUIRED_FIELDS = ['descripcion', 'area'];
const CSV_PREVIEW_LIMIT = 5;
const DEFAULT_CSV_PREVIEW_COLUMNS = ['descripcion', 'area', 'naturaleza', 'fecha', 'total'];

// ====== STATE + UTILS ======
function createEmptyCSVImport() {
  return {
    entries: [],
    filename: '',
    headers: [],
    columns: {},
    error: null,
    missingRequired: [],
    missingOptional: [],
    detectedFields: [],
    skippedRows: [],
    delimiter: ',',
    file: null
  };
}

const state = { files: [], sending: false, MAX_FILES: 50, MAX_MB: 50, intakeMode: 'files', csvImport: createEmptyCSVImport() };
const el = (s) => document.querySelector(s);
const formatBytes = (b) => { if (!b && b !== 0) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b > 1024 && i < u.length - 1) { b /= 1024; i++; } return `${b.toFixed(1)} ${u[i]}`; };
const escapeHTML = (value = '') => `${value}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return `${value}`.replace(/^\uFEFF/, '').trim();
};

const normalizeHeaderKey = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();

const formatFieldList = (fields = []) => fields
  .map((key) => CSV_FIELD_LABELS[key] || key)
  .join(', ');

const detectDelimiter = (line = '') => {
  const sanitized = normalizeText(line);
  if (!sanitized) return ',';
  const counts = {
    ',': (sanitized.match(/,/g) || []).length,
    ';': (sanitized.match(/;/g) || []).length,
    '\t': (sanitized.match(/\t/g) || []).length
  };
  let delimiter = ',';
  let max = counts[delimiter];
  Object.entries(counts).forEach(([candidate, count]) => {
    if (count > max) {
      delimiter = candidate;
      max = count;
    }
  });
  return max === 0 ? ',' : delimiter;
};

const splitCSVRows = (text = '', delimiter = ',') => {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(normalizeText(current));
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(normalizeText(current));
      rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length || row.length) {
    row.push(normalizeText(current));
    rows.push(row);
  }
  return rows
    .map((cells) => {
      const filled = [...cells];
      return filled;
    })
    .filter((cells) => cells.some((cell) => normalizeText(cell)));
};

const normalizeEnumValue = (value, options = []) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const match = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return match || normalized;
};

const sanitizeSelectValue = (value, options = [], fallback = '') => {
  const normalized = normalizeEnumValue(value, options);
  if (!normalized) return fallback;
  const match = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return match || fallback;
};

const sanitizeCategoryValue = (value, fallback = DEFAULT_LOTE_META.categoria) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const key = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (key === 'repuestos' || key === 'recambios') {
    return 'Recambios';
  }
  if (key === 'otrascosas') {
    return 'Otros';
  }
  return sanitizeSelectValue(normalized, CATEGORY_OPTIONS, fallback) || fallback;
};

const sanitizeMetadata = (meta = {}) => {
  const sanitized = { ...meta };
  sanitized.descripcion = normalizeText(sanitized.descripcion || DEFAULT_LOTE_META.descripcion);
  sanitized.area = sanitizeSelectValue(sanitized.area || DEFAULT_LOTE_META.area, AREA_OPTIONS);
  sanitized.naturaleza = sanitizeSelectValue(
    sanitized.naturaleza || DEFAULT_LOTE_META.naturaleza,
    NATURALEZA_OPTIONS,
    DEFAULT_LOTE_META.naturaleza
  );
  sanitized.metodoPago = sanitizeSelectValue(
    sanitized.metodoPago || DEFAULT_LOTE_META.metodoPago,
    PAYMENT_METHODS,
    DEFAULT_LOTE_META.metodoPago
  );
  sanitized.categoria = sanitizeCategoryValue(sanitized.categoria || DEFAULT_LOTE_META.categoria);
  sanitized.fecha = normalizeDateFromCSV(sanitized.fecha || DEFAULT_LOTE_META.fecha);
  sanitized.subtotal = normalizeNumber(sanitized.subtotal || DEFAULT_LOTE_META.subtotal);
  sanitized.iva = normalizeNumber(sanitized.iva || DEFAULT_LOTE_META.iva);
  sanitized.total = normalizeNumber(sanitized.total || DEFAULT_LOTE_META.total);
  sanitized.notas = normalizeText(sanitized.notas || DEFAULT_LOTE_META.notas);
  return sanitized;
};

const normalizeNaturaleza = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'ingreso') return 'Ingreso';
  if (normalized === 'egreso' || normalized === 'gasto') return 'Egreso';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : DEFAULT_LOTE_META.naturaleza;
};

const normalizeNumber = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const candidate = normalized.replace(/\s+/g, '').replace(/,/g, '.');
  const parsed = Number(candidate);
  if (Number.isNaN(parsed)) return normalized;
  return parsed.toFixed(2);
};

const normalizeDateFromCSV = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const dmy = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${year}-${month}-${day}`;
  }
  return normalized;
};

const parseCSVText = (text = '') => {
  const content = text ?? '';
  const lines = content.split(/\r?\n/);
  const firstDataLine = lines.find((line) => normalizeText(line));
  const delimiter = detectDelimiter(firstDataLine || '');
  const rows = splitCSVRows(content, delimiter);
  return { rows, delimiter };
};

const buildCSVImport = (rows = [], delimiter = ',') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...createEmptyCSVImport(), error: 'El CSV está vacío o no tiene datos.', delimiter };
  }

  const headerRow = rows[0].map((cell) => normalizeText(cell));
  if (!headerRow.length) {
    return { ...createEmptyCSVImport(), error: 'No se pudieron detectar encabezados en el CSV.', delimiter };
  }

  const columnMap = {};
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeaderKey(header);
    Object.entries(CSV_FIELD_MAP).forEach(([field, aliases]) => {
      if (columnMap[field] !== undefined) return;
      if (aliases.includes(normalized)) {
        columnMap[field] = index;
      }
    });
  });

  const detectedFields = Object.keys(columnMap);
  const missingRequired = CSV_REQUIRED_FIELDS.filter((field) => columnMap[field] === undefined);
  const optionalFields = Object.keys(CSV_FIELD_LABELS).filter((field) => !CSV_REQUIRED_FIELDS.includes(field));
  const missingOptional = optionalFields.filter((field) => columnMap[field] === undefined);

  if (missingRequired.length) {
    return {
      ...createEmptyCSVImport(),
      delimiter,
      headers: headerRow,
      columns: columnMap,
      missingRequired,
      missingOptional,
      detectedFields,
      error: `El CSV debe incluir las columnas obligatorias: ${formatFieldList(missingRequired)}.`
    };
  }

  const entries = [];
  const skippedRows = [];
  const dataRows = rows.slice(1);
  dataRows.forEach((row, rowIndex) => {
    const cells = headerRow.map((_, index) => normalizeText(row[index] ?? ''));
    const hasMeaningfulCell = Object.values(columnMap).some((colIndex) => normalizeText(cells[colIndex]));
    if (!hasMeaningfulCell) return;

    const entry = { ...DEFAULT_LOTE_META };
    const rowNumber = rowIndex + 2;
    const getValue = (field) => {
      const columnIndex = columnMap[field];
      if (columnIndex === undefined) return '';
      return cells[columnIndex] ?? '';
    };

    entry.descripcion = getValue('descripcion') || '';
    if (!entry.descripcion) {
      skippedRows.push(rowNumber);
      return;
    }
    if (columnMap.area !== undefined) {
      const area = sanitizeSelectValue(getValue('area'), AREA_OPTIONS);
      entry.area = area || entry.area;
    }
    if (!entry.area) {
      skippedRows.push(rowNumber);
      return;
    }
    if (columnMap.naturaleza !== undefined) {
      entry.naturaleza = normalizeNaturaleza(getValue('naturaleza'));
    }
    if (columnMap.metodoPago !== undefined) {
      const metodo = normalizeEnumValue(getValue('metodoPago'), PAYMENT_METHODS);
      entry.metodoPago = metodo || entry.metodoPago;
    }
    if (columnMap.categoria !== undefined) {
      entry.categoria = sanitizeCategoryValue(getValue('categoria'), entry.categoria);
    }
    if (columnMap.fecha !== undefined) {
      entry.fecha = normalizeDateFromCSV(getValue('fecha'));
    }
    if (columnMap.subtotal !== undefined) {
      entry.subtotal = normalizeNumber(getValue('subtotal'));
    }
    if (columnMap.iva !== undefined) {
      entry.iva = normalizeNumber(getValue('iva'));
    }
    if (columnMap.total !== undefined) {
      entry.total = normalizeNumber(getValue('total'));
    }
    if (columnMap.notas !== undefined) {
      entry.notas = getValue('notas');
    }

    entries.push(entry);
  });

  if (!entries.length) {
    const reason = skippedRows.length
      ? `No se encontraron filas válidas en el CSV. Filas sin descripción: ${skippedRows.join(', ')}.`
      : 'No se encontraron filas con datos en el CSV.';
    return {
      ...createEmptyCSVImport(),
      delimiter,
      headers: headerRow,
      columns: columnMap,
      missingRequired,
      missingOptional,
      detectedFields,
      skippedRows,
      error: reason
    };
  }

  return {
    entries,
    filename: '',
    headers: headerRow,
    columns: columnMap,
    missingRequired,
    missingOptional,
    detectedFields,
    skippedRows,
    delimiter,
    error: null
  };
};

const formatDateDDMMYYYY = (value) => {
  if (!value && value !== 0) return '';
  const raw = value instanceof Date ? value.toISOString() : `${value}`.trim();
  if (!raw) return '';
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${d}/${m}/${y}`;
  }
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  return raw;
};

const applyDateFormatting = (meta = {}) => {
  if (!meta || typeof meta !== 'object') return meta;
  const copy = { ...meta };
  if (copy.fecha) {
    const formatted = formatDateDDMMYYYY(copy.fecha);
    if (formatted && formatted !== copy.fecha) {
      copy.fechaISO = copy.fecha;
      copy.fecha = formatted;
    }
  }
  return copy;
};

const STATUS_VARIANTS = {
  default: [],
  info: ['text-orange-400', 'font-semibold'],
  success: ['text-emerald-400', 'font-semibold'],
  error: ['text-red-400', 'font-semibold']
};

function setStatus(message, variant = 'default') {
  const statusEl = el('#status');
  if (!statusEl) return;
  const baseClasses = ['helper-text', 'transition-colors', 'duration-150'];
  statusEl.className = baseClasses.join(' ');
  const classes = STATUS_VARIANTS[variant] || STATUS_VARIANTS.default;
  classes.forEach(cls => statusEl.classList.add(cls));
  statusEl.textContent = message;
}

function getLoteMetadata() {
  const defaults = { ...DEFAULT_LOTE_META };
  const form = document.getElementById('metaForm');
  if (!form) return defaults;
  try {
    const data = Object.fromEntries(new FormData(form));
    return sanitizeMetadata({ ...defaults, ...data });
  } catch {
    return { ...defaults };
  }
}

function hasMeaningfulLoteMetadata(lote) {
  if (!lote) return false;
  const normalize = (val) => (val ?? '').toString().trim();
  if (normalize(lote.descripcion)) return true;
  if (normalize(lote.fecha)) return true;
  if (['subtotal', 'iva', 'total', 'notas'].some(k => normalize(lote[k]))) return true;
  if (['area', 'naturaleza', 'metodoPago', 'categoria'].some(k => {
    const value = normalize(lote[k]);
    const defaultValue = normalize(DEFAULT_LOTE_META[k]);
    return value && value !== defaultValue;
  })) return true;
  return false;
}

function updateSendButtonState() {
  const btn = el('#btnEnviar'); if (!btn) return;
  const hasFiles = state.files.length > 0;
  const csvReady = Array.isArray(state.csvImport?.entries) && state.csvImport.entries.length > 0 && !state.csvImport.error;
  const lote = getLoteMetadata();
  const hasMetadata = hasMeaningfulLoteMetadata(lote);
  const descriptionProvided = !!(lote.descripcion && lote.descripcion.toString().trim());
  const areaProvided = !!(lote.area && lote.area.toString().trim());
  const filesRequireArea = state.files.some((f) => {
    const meta = sanitizeMetadata(f.meta);
    return !meta.area;
  }) && !areaProvided;

  let shouldDisable = state.sending;
  if (!shouldDisable) {
    if (state.intakeMode === 'manual') {
      shouldDisable = !descriptionProvided || !hasMetadata || !areaProvided;
    } else {
      shouldDisable = (!hasFiles && !csvReady) || filesRequireArea;
    }
  }

  btn.disabled = shouldDisable;

  if (state.sending) {
    btn.textContent = 'Enviando…';
  } else if (state.intakeMode === 'manual' && !descriptionProvided) {
    btn.textContent = 'Añade la descripción';
  } else if (state.intakeMode === 'manual' && !areaProvided) {
    btn.textContent = 'Selecciona el área';
  } else if (state.intakeMode === 'manual' && !hasMetadata) {
    btn.textContent = 'Completa los datos';
  } else if (filesRequireArea) {
    btn.textContent = 'Selecciona el área de cada archivo';
  } else if (!hasFiles && csvReady) {
    btn.textContent = 'Enviar metadatos CSV';
  } else if (!hasFiles) {
    btn.textContent = 'Añade archivos o CSV';
  } else {
    btn.textContent = 'Enviar';
  }
}

function guessTipo(file) {
  const n = (file.name || '').toLowerCase(), m = (file.type || '').toLowerCase();
  if (n.includes('ticket') || n.includes('receipt')) return 'Ticket';
  if (m.includes('pdf')) return 'Factura';
  if (m.startsWith('image/')) return 'Ticket';
  return 'Factura';
}
function getPreviewType(file) {
  if (!(file instanceof File)) return null;
  if ((file.type || '').startsWith('image/')) return 'image';
  if ((file.type || '').toLowerCase() === 'application/pdf') return 'pdf';
  return null;
}

function getPreviewURL(file) {
  const type = getPreviewType(file);
  if (!type) return { previewURL: null, previewType: null };
  return { previewURL: URL.createObjectURL(file), previewType: type };
}
function isDuplicate(file) {
  return state.files.some(f => f.file.name === file.name && f.file.size === file.size);
}


// ====== RENDER ======
function renderSelectOptions(options, selected) {
  return options.map(opt => `<option value="${opt}" ${opt === selected ? 'selected' : ''}>${opt}</option>`).join('');
}

function renderAreaOptions(selected, includePrompt = false) {
  const options = [];
  if (includePrompt) {
    options.push(`<option value="" ${selected ? '' : 'selected'} disabled>Selecciona área</option>`);
  }
  options.push(...AREA_OPTIONS.map(opt => `<option value="${opt}" ${opt === selected ? 'selected' : ''}>${opt}</option>`));
  return options.join('');
}

function renderFiles() {
  const cont = el('#fileList');
  const emptyState = el('#fileListEmpty');
  if (!cont) return;
  let metaUpdated = false;
  state.files.forEach(f => {
    const sanitized = sanitizeMetadata(f.meta);
    Object.entries(DEFAULT_LOTE_META).forEach(([key, value]) => {
      if (!(key in sanitized)) {
        sanitized[key] = value;
      }
    });
    if (JSON.stringify(f.meta) !== JSON.stringify(sanitized)) {
      f.meta = sanitized;
      metaUpdated = true;
    }
    if (!('tipo' in f.meta)) { f.meta.tipo = 'Factura'; metaUpdated = true; }

  });
  if (metaUpdated) persist();
  if (!state.files.length) {
    cont.innerHTML = '';
    if (emptyState) { emptyState.hidden = false; }
    updateSendButtonState();
    return;
  }
  if (emptyState) { emptyState.hidden = true; }
  cont.innerHTML = state.files.map(f => {
    const previewType = f.previewType || getPreviewType(f.file);
    const previewMarkup = (() => {
      if (previewType === 'image' && f.previewURL) {
        return `<figure class="file-card__preview"><img src="${f.previewURL || ''}" alt="Vista previa" /></figure>`;
      }
      if (previewType === 'pdf' && f.previewURL) {
        return `<figure class="file-card__preview file-card__preview--pdf"><embed src="${f.previewURL || ''}" type="application/pdf" aria-label="Vista previa de ${escapeHTML(f.file.name)}" /></figure>`;
      }
      return '';
    })();
    return `
      <article class="file-card">
        ${previewMarkup}
        <div class="file-card__body">
          <header class="file-card__header">
            <div class="file-card__title">
              <p class="file-card__name" title="${f.file.name}">${f.file.name}</p>
              <span class="file-card__meta">${f.file.type || '—'} · ${formatBytes(f.file.size)}</span>
            </div>
            <button class="file-card__remove" type="button" onclick="removeFile('${f.id}')" aria-label="Eliminar ${f.file.name}">✕</button>
          </header>
          <div class="file-card__grid">
            <label class="field field--compact">
              <span>Área</span>
              <select class="input" required onchange="updateFileMeta('${f.id}','area',this.value)">
                ${renderAreaOptions(f.meta.area, true)}
              </select>
            </label>
            <label class="field field--compact">
              <span>Naturaleza</span>
              <select class="input" onchange="updateFileMeta('${f.id}','naturaleza',this.value)">
                <option value="Ingreso" ${f.meta.naturaleza === 'Ingreso' ? 'selected' : ''}>Ingreso</option>
                <option value="Egreso" ${f.meta.naturaleza === 'Egreso' ? 'selected' : ''}>Egreso</option>
              </select>
            </label>
            <label class="field field--compact">
              <span>Método de pago</span>
              <select class="input" onchange="updateFileMeta('${f.id}','metodoPago',this.value)">
                ${renderSelectOptions(PAYMENT_METHODS, f.meta.metodoPago)}
              </select>
            </label>
            <label class="field field--compact">
              <span>Categoría</span>
              <select class="input" onchange="updateFileMeta('${f.id}','categoria',this.value)">
                ${renderSelectOptions(CATEGORY_OPTIONS, f.meta.categoria)}
              </select>
            </label>
            <label class="field field--compact">
              <span>Tipo</span>
              <select class="input" onchange="updateFileMeta('${f.id}','tipo',this.value)">
                <option value="Factura" ${f.meta.tipo === 'Factura' ? 'selected' : ''}>Factura</option>
                <option value="Ticket" ${f.meta.tipo === 'Ticket' ? 'selected' : ''}>Ticket</option>
              </select>
            </label>
            <label class="field field--compact" style="grid-column: 1 / -1">
              <span>Notas</span>
              <textarea rows="2" class="input" onchange="updateFileMeta('${f.id}','notas',this.value)">${f.meta.notas || ''}</textarea>
            </label>
          </div>
        </div>
      </article>`;
  }).join('');
  updateSendButtonState();
}

const getCSVPreviewColumns = () => {
  const columnMap = state.csvImport?.columns || {};
  const preferred = DEFAULT_CSV_PREVIEW_COLUMNS.filter((key) => columnMap[key] !== undefined);
  let columns = preferred.length ? preferred : Object.keys(columnMap);
  if (!columns.includes('descripcion')) {
    columns = ['descripcion', ...columns];
  }
  const unique = [];
  columns.forEach((key) => {
    if (!unique.includes(key)) unique.push(key);
  });
  if (!unique.length) unique.push('descripcion');
  return unique.slice(0, 7);
};

const formatCSVPreviewValue = (key, entry) => {
  if (!entry || typeof entry !== 'object') return '';
  if (key === 'fecha') {
    return formatDateDDMMYYYY(entry.fecha || entry.fechaISO || '');
  }
  return entry[key] || '';
};

const buildCSVPreviewMarkup = (entries = []) => {
  const columns = getCSVPreviewColumns();
  const header = columns
    .map((key) => `<th scope="col">${escapeHTML(CSV_FIELD_LABELS[key] || key)}</th>`)
    .join('');
  const body = entries
    .slice(0, CSV_PREVIEW_LIMIT)
    .map((entry) => {
      const cells = columns
        .map((key) => {
          const value = formatCSVPreviewValue(key, entry);
          return `<td>${escapeHTML(value || '—')}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const safeBody = body || `<tr><td colspan="${columns.length}">No hay datos para mostrar.</td></tr>`;
  const remaining = Math.max(entries.length - CSV_PREVIEW_LIMIT, 0);
  const more = remaining > 0
    ? `<div class="csv-preview__more">Se muestran ${CSV_PREVIEW_LIMIT} de ${entries.length} registros.</div>`
    : '';
  return `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${safeBody}</tbody>
    </table>
    ${more}
  `;
};

function renderCSVImport() {
  const statusEl = el('#csvStatus');
  const previewEl = el('#csvPreview');
  const clearBtn = el('#csvClear');
  const alertsEl = el('#csvAlerts');
  if (!statusEl || !previewEl || !clearBtn || !alertsEl) return;

  const { entries, filename, error, missingOptional, detectedFields, skippedRows } = state.csvImport;
  const csvReady = Array.isArray(entries) && entries.length > 0 && !error;

  alertsEl.innerHTML = '';

  if (error) {
    alertsEl.innerHTML += `<div class="alert alert--error">${escapeHTML(error)}</div>`;
  }

  if (!error && Array.isArray(missingOptional) && missingOptional.length) {
    alertsEl.innerHTML += `<div class="alert alert--warning">Faltan columnas opcionales: ${escapeHTML(formatFieldList(missingOptional))}. Se utilizarán valores por defecto donde aplique.</div>`;
  }

  if (!error && Array.isArray(skippedRows) && skippedRows.length) {
    alertsEl.innerHTML += `<div class="alert alert--warning">Se omitieron ${skippedRows.length} fila(s) por faltar datos obligatorios (filas: ${escapeHTML(skippedRows.join(', '))}).</div>`;
  }

  if (csvReady) {
    let message = `${entries.length} registros importados`;
    if (filename) {
      message += ` de ${filename}`;
    }
    if (Array.isArray(detectedFields) && detectedFields.length) {
      message += `. Campos detectados: ${formatFieldList(detectedFields)}.`;
    } else {
      message += '.';
    }
    statusEl.textContent = message;
    previewEl.hidden = false;
    previewEl.innerHTML = buildCSVPreviewMarkup(entries);
    clearBtn.hidden = false;
  } else {
    statusEl.textContent = error ? 'No se pudieron procesar los datos del CSV.' : 'No hay CSV importado todavía.';
    previewEl.hidden = true;
    previewEl.innerHTML = '';
    clearBtn.hidden = !(filename || error);
  }
}

function clearCSVImport() {
  state.csvImport = createEmptyCSVImport();
  const input = el('#csvInput');
  if (input) {
    input.value = '';
  }
  renderCSVImport();
  updateSendButtonState();
}

function handleCSVFile(file) {
  if (!(file instanceof File)) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = typeof reader.result === 'string' ? reader.result : new TextDecoder().decode(reader.result || new Uint8Array());
      const { rows, delimiter } = parseCSVText(text);
      const parsed = buildCSVImport(rows, delimiter);
      state.csvImport = { ...createEmptyCSVImport(), ...parsed };
      state.csvImport.filename = file.name;
      state.csvImport.delimiter = delimiter;
      state.csvImport.file = parsed.error ? null : file;
    } catch (err) {
      console.error('Error procesando CSV', err);
      state.csvImport = { ...createEmptyCSVImport(), error: 'No se pudo procesar el CSV.' };
    }
    renderCSVImport();
    updateSendButtonState();
  };
  reader.onerror = () => {
    console.error('No se pudo leer el CSV', reader.error);
    state.csvImport = { ...createEmptyCSVImport(), error: 'No se pudo leer el archivo CSV.' };
    renderCSVImport();
    updateSendButtonState();
  };
  reader.readAsText(file, 'utf-8');
}

// ====== ACTIONS ======
window.removeFile = function (id) {
  const i = state.files.findIndex(f => f.id === id);
  if (i > -1) {
    const f = state.files[i];
    if (f.previewURL) URL.revokeObjectURL(f.previewURL);
    state.files.splice(i, 1);
  }
  persist(); renderFiles();
};
window.updateFileMeta = function (id, k, v) {
  const f = state.files.find(x => x.id === id);
  if (f) {
    if (k === 'categoria') {
      f.meta[k] = sanitizeCategoryValue(v, DEFAULT_LOTE_META.categoria);
    } else if (k === 'area') {
      f.meta[k] = sanitizeSelectValue(v, AREA_OPTIONS, DEFAULT_LOTE_META.area);
    } else if (k === 'naturaleza') {
      f.meta[k] = sanitizeSelectValue(v, NATURALEZA_OPTIONS, DEFAULT_LOTE_META.naturaleza);
    } else if (k === 'metodoPago') {
      f.meta[k] = sanitizeSelectValue(v, PAYMENT_METHODS, DEFAULT_LOTE_META.metodoPago);
    } else {
      f.meta[k] = v;
    }
    persist();
  }
  updateSendButtonState();
};

function addFiles(list) {
  console.log('addFiles ->', list?.length, list);
  const meta = getLoteMetadata();

  [...list].forEach(file => {
    console.log('  candidate:', file?.name, file?.size, file instanceof File);
    if (!(file instanceof File)) { console.warn('Descartado: no es File', file); return; }

    const lowerName = (file.name || '').toLowerCase();
    if (lowerName.endsWith('.csv') || file.type === 'text/csv') {
      handleCSVFile(file);
      return;
    }

    if (state.files.length >= state.MAX_FILES) return;
    if (STRICT_FILTERS && isDuplicate(file)) return;
    if (STRICT_FILTERS && (file.size / (1024 * 1024)) > state.MAX_MB) return;

    state.files.push({
      id: crypto.randomUUID(),
      file,
      ...getPreviewURL(file),
      meta: {
        ...meta,
        tipo: guessTipo(file)
      }
    });
  });
  persist(); renderFiles();
}

function clearAll() {
  state.files.forEach(f => f.previewURL && URL.revokeObjectURL(f.previewURL));
  state.files = []; persist(); renderFiles();
}

function persist() {
  try {
    const serializable = state.files.map(f => ({
      id: f.id,
      meta: f.meta,
      file: { name: f.file.name, size: f.file.size, type: f.file.type }
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(serializable));
  } catch { }
}

// ====== INIT + SEND ======
function initApp() {
  enhanceMetaForm();
  // Inputs
  el('#fileInput')?.addEventListener('change', e => addFiles(e.target.files));
  el('#cameraInput')?.addEventListener('change', e => addFiles(e.target.files));
  el('#csvInput')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleCSVFile(file);
    }
    e.target.value = '';
  });

  // Dropzone
  const dz = el('#dropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
    dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  }

  el('#clearAll')?.addEventListener('click', clearAll);
  el('#csvClear')?.addEventListener('click', clearCSVImport);

  document.querySelectorAll('.segmented-control__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.segmented-control');
      if (!group) return;
      group.querySelectorAll('.segmented-control__item').forEach(item => {
        if (item === btn) {
          item.classList.add('is-active');
          item.setAttribute('aria-selected', 'true');
        } else {
          item.classList.remove('is-active');
          item.setAttribute('aria-selected', 'false');
        }
      });

      const mode = btn.dataset.intakeMode;
      if (mode) {
        setIntakeMode(mode);
      }
    });
  });

  setupDashboardFullscreen();

  // Enviar
  el('#btnEnviar')?.addEventListener('click', async (ev) => {
    ev?.preventDefault?.(); // evita submit del <form>

    if (!WEBHOOK_URL) { alert('Webhook no configurado.'); return; }
    const csvReady = Array.isArray(state.csvImport.entries) && state.csvImport.entries.length > 0 && !state.csvImport.error;
    if (!state.files.length) {
      if (csvReady) {
        console.warn('Envío sin archivos adjuntos: se enviará manifest con registros CSV.');
      } else {
        console.warn('Envío sin archivos: se enviará solo el manifest.');
      }
    }

    console.log('ENVIANDO',
      state.files.length,
      state.files.map(f => ({
        name: f.file?.name, size: f.file?.size, type: f.file?.type,
        isFile: f.file instanceof File
      })),
      csvReady ? { csvRegistros: state.csvImport.entries.length, csvArchivo: state.csvImport.filename || null } : null
    );

    const lote = sanitizeMetadata(getLoteMetadata());
    const manifestOnly = state.files.length === 0;
    const descriptionProvided = !!(lote.descripcion && lote.descripcion.toString().trim());
    const hasMetadata = hasMeaningfulLoteMetadata(lote);

    if (state.intakeMode === 'files' && !state.files.length && !csvReady) {
      setStatus('Añade al menos un archivo o importa un CSV antes de enviar.', 'error');
      return;
    }

    if (state.intakeMode === 'manual') {
      if (!descriptionProvided) {
        setStatus('Añade una descripción detallada antes de enviar.', 'error');
        return;
      }
      if (!hasMetadata) {
        console.warn('Intento de envío sin datos manuales. Abortado.');
        setStatus('Añade información del lote para enviar sin archivos.', 'error');
        return;
      }
      if (!lote.area) {
        setStatus('Selecciona el área del lote antes de enviar.', 'error');
        return;
      }
    }

    const fileMetas = state.files.map((f) => sanitizeMetadata(f.meta));
    const missingAreaFiles = [];
    let areaInjected = false;
    fileMetas.forEach((meta, index) => {
      if (!meta.area) {
        if (lote.area) {
          meta.area = lote.area;
          if (state.files[index]?.meta) {
            state.files[index].meta.area = lote.area;
            areaInjected = true;
          }
        } else {
          const name = state.files[index]?.file?.name || `Archivo ${index + 1}`;
          missingAreaFiles.push(name);
        }
      }
    });

    if (missingAreaFiles.length) {
      const preview = missingAreaFiles.slice(0, 3).join(', ');
      const extra = missingAreaFiles.length > 3 ? ` y ${missingAreaFiles.length - 3} más` : '';
      setStatus(`Selecciona el área para ${missingAreaFiles.length > 1 ? 'los archivos' : 'el archivo'} pendiente (${preview}${extra}).`, 'error');
      return;
    }

    if (areaInjected) {
      persist();
      renderFiles();
    }

    if (!lote.area) {
      const areas = fileMetas.map(meta => meta.area).filter(Boolean);
      const allSameArea = areas.length > 0 && areas.every(area => area === areas[0]);
      const dominantArea = allSameArea ? areas[0] : '';
      if (dominantArea) {
        lote.area = dominantArea;
      }
    }

    if (!lote.categoria || lote.categoria === DEFAULT_LOTE_META.categoria) {
      const categorias = fileMetas.map(meta => meta.categoria).filter(Boolean);
      const allSameCategoria = categorias.length > 0 && categorias.every((categoria) => categoria === categorias[0]);
      const dominantCategoria = allSameCategoria ? categorias[0] : '';
      if (dominantCategoria && dominantCategoria !== DEFAULT_LOTE_META.categoria) {
        lote.categoria = dominantCategoria;
      }
    }

    const manifest = {
      version: 'no-cors',
      enviadoEn: new Date().toISOString(),
      usuario: { email: (cachedUser || getCurrentUser())?.email || '' },
      lote: applyDateFormatting(lote),
      manifestOnly,
      archivos: state.files.map((f, index) => ({
        id: f.id,
        nombre: f.file.name,
        size: f.file.size,
        type: f.file.type,
        meta: applyDateFormatting(fileMetas[index])
      }))
    };

    if (csvReady) {
      manifest.csvImport = {
        archivo: state.csvImport.filename || '',
        delimitador: state.csvImport.delimiter || ',',
        camposDetectados: state.csvImport.detectedFields || [],
        columnasOpcionalesFaltantes: state.csvImport.missingOptional || [],
        filasOmitidas: state.csvImport.skippedRows || [],
        encabezados: state.csvImport.headers || [],
        mapeoColumnas: state.csvImport.columns || {},
        totalRegistros: state.csvImport.entries.length,
        registros: state.csvImport.entries.map((entry, index) => ({
          indice: index + 1,
          ...applyDateFormatting(entry)
        }))
      };
    }

    const fd = new FormData();
    fd.append('manifest', new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), 'manifest.json');
    fd.append('manifestOnly', manifestOnly ? '1' : '0');
    const appendFile = (file, origin) => {
      if (!(file instanceof File)) {
        console.warn('Saltado archivo no válido desde', origin, file);
        return;
      }
      fd.append('files', file, file.name);
    };

    // Adjuntar los archivos utilizando el mismo nombre (files[]) para que Make los trate como un array
    state.files.forEach((f) => appendFile(f.file, 'state'));

    if (csvReady && state.csvImport.file instanceof File) {
      fd.append('csv', state.csvImport.file, state.csvImport.file.name);
    }

    // PLAN B: adjunta también lo que haya en el input por si state.files fallara
    const fi = el('#fileInput');
    if (!state.files.length && fi?.files?.length) {
      console.log('Fallback input files:', fi.files.length);
      [...fi.files].forEach(file => appendFile(file, 'fallback'));
    }

    // Volcado del FormData
    for (const [k, v] of fd.entries()) {
      console.log('FD:', k, v instanceof File ? `${v.name} (${v.type}, ${v.size})` : v);
    }

    state.sending = true; updateSendButtonState();
    setStatus('Enviando lote desde Versa Finanzas…', 'info');

    try {
      await fetch(WEBHOOK_URL, { method: 'POST', body: fd, mode: 'no-cors' });
      setStatus('Envío registrado desde Versa Finanzas ✔️', 'success');
      clearAll();
      clearCSVImport();
      const autoClearToggle = el('#chkBorrado');
      if (autoClearToggle) {
        autoClearToggle.checked = false;
      }
    } catch (err) {
      console.error(err);
      setStatus('No se pudo completar el envío. Inténtalo nuevamente.', 'error');
      alert('⚠️ Error al enviar archivos');
    } finally {
      state.sending = false; updateSendButtonState();
    }
  });

  renderFiles();
  renderCSVImport();
  setIntakeMode(state.intakeMode);
}
document.addEventListener('DOMContentLoaded', initApp);

function setIntakeMode(nextMode) {
  const mode = nextMode === 'manual' ? 'manual' : 'files';
  state.intakeMode = mode;

  const showManual = mode === 'manual';
  const uploadSections = document.querySelectorAll('[data-intake-section="files"]');
  uploadSections.forEach(section => {
    section.hidden = showManual;
  });

  const manualArticle = el('#manualEntry');
  if (manualArticle) {
    manualArticle.hidden = !showManual;
  }

  const clearBtn = el('#clearAll');
  if (clearBtn) {
    clearBtn.hidden = showManual;
  }

  if (showManual) {
    if (state.files.length) {
      clearAll();
    }
    ['#cameraInput', '#fileInput', '#csvInput'].forEach(selector => {
      const input = el(selector);
      if (input) {
        input.setAttribute('disabled', 'true');
      }
    });
    setStatus('Introduce los datos de la factura manualmente.', 'info');
  } else {
    ['#cameraInput', '#fileInput', '#csvInput'].forEach(selector => {
      const input = el(selector);
      if (input) {
        input.removeAttribute('disabled');
      }
    });
    const csvReady = Array.isArray(state.csvImport.entries) && state.csvImport.entries.length > 0 && !state.csvImport.error;
    if (!state.files.length) {
      if (csvReady) {
        setStatus('CSV importado listo para enviar o complementa con archivos.', 'info');
      } else {
        setStatus('Añade tus archivos o un CSV para comenzar.', 'default');
      }
    }
  }

  updateSendButtonState();
}

function setupDashboardFullscreen() {
  const frame = el('#lookerFrame');
  const openBtn = el('#dashboardFullscreenBtn');
  const closeBtn = el('#dashboardFullscreenClose');
  if (!frame || !openBtn || !closeBtn) return;

  const body = document.body;
  const ACTIVE_CLASS = 'dashboard-fullscreen-active';
  const focusSafely = (element) => {
    if (!element || typeof element.focus !== 'function') return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  };

  const open = () => {
    if (body.classList.contains(ACTIVE_CLASS)) return;
    body.classList.add(ACTIVE_CLASS);
    openBtn.setAttribute('aria-expanded', 'true');
    closeBtn.setAttribute('aria-hidden', 'false');
    focusSafely(closeBtn);
  };

  const close = () => {
    if (!body.classList.contains(ACTIVE_CLASS)) return;
    body.classList.remove(ACTIVE_CLASS);
    openBtn.setAttribute('aria-expanded', 'false');
    closeBtn.setAttribute('aria-hidden', 'true');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
    focusSafely(openBtn);
  };

  openBtn.setAttribute('aria-expanded', 'false');

  openBtn.addEventListener('click', async () => {
    if (body.classList.contains(ACTIVE_CLASS)) {
      close();
      return;
    }

    open();
    if (frame.requestFullscreen && window.matchMedia('(max-width: 1024px)').matches) {
      try {
        await frame.requestFullscreen();
      } catch (err) {
        console.warn('No se pudo activar la API de pantalla completa', err);
      }
    }
  });

  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('resize', () => {
    if (!body.classList.contains(ACTIVE_CLASS)) return;
    if (window.innerWidth > 1280) close();
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement && document.fullscreenElement !== frame) return;
    if (!document.fullscreenElement) close();
  });
}

function enhanceMetaForm() {
  const form = el('#metaForm');
  if (!form || form.dataset.enhanced === '1') return;

  const existing = (() => {
    try { return Object.fromEntries(new FormData(form)); }
    catch { return {}; }
  })();

  const defaults = sanitizeMetadata(DEFAULT_LOTE_META);
  const sanitized = sanitizeMetadata(existing);
  const descripcion = sanitized.descripcion || defaults.descripcion;
  const area = sanitized.area || defaults.area;
  const naturaleza = sanitized.naturaleza || defaults.naturaleza;
  const metodoPago = sanitized.metodoPago || defaults.metodoPago;
  const categoria = sanitized.categoria || defaults.categoria;
  const notas = sanitized.notas || defaults.notas;
  const subtotal = sanitized.subtotal || defaults.subtotal;
  const iva = sanitized.iva || defaults.iva;
  const total = sanitized.total || defaults.total;

  const areaOptions = renderAreaOptions(area, true);

  const metodoOptions = renderSelectOptions(PAYMENT_METHODS, metodoPago);
  const categoriaOptions = renderSelectOptions(CATEGORY_OPTIONS, categoria);

  form.innerHTML = `
    <div class="grid gap-3 md:grid-cols-2 text-sm">
      <div>
        <label class="font-medium flex items-center gap-1">Descripción del lote <span class="text-red-500">*</span></label>
        <textarea name="descripcion" rows="3" class="input w-full mt-1" placeholder="Ej. Facturas de mantenimiento preventivo de la flota" required>${descripcion}</textarea>
        <p class="mt-1 text-xs helper-text">Resume el contenido del envío para acelerar la validación.</p>
      </div>
      <div>
        <label class="font-medium">Área</label>
        <select name="area" class="input w-full mt-1" required>${areaOptions}</select>
      </div>
      <div class="md:col-span-2">
        <label class="font-medium">Naturaleza</label>
        <div class="mt-1 flex flex-wrap gap-3">
          <label class="inline-flex items-center gap-2">
            <input type="radio" name="naturaleza" value="Ingreso" ${naturaleza === 'Ingreso' ? 'checked' : ''}>
            <span>Ingreso</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" name="naturaleza" value="Egreso" ${naturaleza !== 'Ingreso' ? 'checked' : ''}>
            <span>Egreso</span>
          </label>
        </div>
      </div>
      <div>
        <label class="font-medium">Método de pago</label>
        <select name="metodoPago" class="input w-full mt-1">${metodoOptions}</select>
      </div>
      <div>
        <label class="font-medium">Categoría</label>
        <select name="categoria" class="input w-full mt-1">${categoriaOptions}</select>
      </div>
      <div>
        <label class="font-medium">Subtotal</label>
        <div class="mt-1">
          <input name="subtotal" type="number" step="0.01" min="0" class="input w-full" value="${subtotal}" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="font-medium">IVA</label>
        <div class="mt-1">
          <input name="iva" type="number" step="0.01" min="0" class="input w-full" value="${iva}" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="font-medium">Total</label>
        <div class="mt-1">
          <input name="total" type="number" step="0.01" min="0" class="input w-full" value="${total}" placeholder="0.00">
        </div>
      </div>
      <div class="md:col-span-2">
        <label class="font-medium">Notas</label>
        <textarea name="notas" rows="3" class="input w-full mt-1" placeholder="Observaciones, centros de coste, referencias internas…">${notas}</textarea>
      </div>
    </div>
  `;

  form.dataset.enhanced = '1';

  form.querySelectorAll('input, select, textarea').forEach(ctrl => {
    ctrl.addEventListener('change', () => updateSendButtonState());
    ctrl.addEventListener('input', () => updateSendButtonState());
  });

  updateSendButtonState();
}


