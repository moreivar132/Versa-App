const STORAGE_KEY = 'versa_auth_store_v1';
const VALID_ROLES = ['admin', 'empleado'];
const DEFAULT_ADMIN = Object.freeze({
  email: 'admin@versa.com',
  name: 'Administrador Versa',
  role: 'admin',
  password: 'VersaAdmin#2024'
});

const DEFAULT_SEEDED_USERS = Object.freeze([
  Object.freeze({
    email: 'ivan.moreno@goversa.es',
    name: 'Iván Moreno',
    role: 'admin',
    password: '1523699292',
    metadata: Object.freeze({ createdBy: 'seed:default' })
  }),
  Object.freeze({
    email: 'rafael.quintero@goversa.es',
    name: 'Rafael Quintero',
    role: 'admin',
    password: '1234567891',
    metadata: Object.freeze({ createdBy: 'seed:default' })
  }),
  Object.freeze({
    email: 'moreivar132@gmail.com',
    name: 'Empleado Moreivar',
    role: 'empleado',
    password: '1515151515',
    metadata: Object.freeze({ createdBy: 'seed:default' })
  }),
]);

const textEncoder = new TextEncoder();
const cryptoObj = window.crypto || window.msCrypto;
if (!cryptoObj || !cryptoObj.subtle) {
  throw new Error('Este navegador no soporta las primitivas criptográficas necesarias.');
}

const state = {
  store: null,
  initialized: false,
};

function nowISO() {
  return new Date().toISOString();
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomBytes(length = 16) {
  const array = new Uint8Array(length);
  cryptoObj.getRandomValues(array);
  return array;
}

function randomString(length = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789@$&#!?';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function loadStore() {
  if (state.store) return state.store;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.store = {
      users: [],
      accessLogs: [],
    };
    return state.store;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.users || !Array.isArray(parsed.users)) {
      parsed.users = [];
    }
    if (!parsed.accessLogs || !Array.isArray(parsed.accessLogs)) {
      parsed.accessLogs = [];
    }
    state.store = parsed;
  } catch (error) {
    console.warn('UserStore: no se pudo parsear el almacenamiento, se reinicia.', error);
    state.store = {
      users: [],
      accessLogs: [],
    };
  }
  return state.store;
}

function persist() {
  const payload = JSON.stringify(state.store);
  localStorage.setItem(STORAGE_KEY, payload);
}

async function deriveHash(secret, salt) {
  if (!secret) throw new Error('Se requiere una clave para generar el hash.');
  const data = textEncoder.encode(`${salt}:${secret}`);
  const buffer = await cryptoObj.subtle.digest('SHA-256', data);
  return toBase64(buffer);
}

function sanitizeUser(entry) {
  return {
    email: entry.email,
    name: entry.name,
    role: entry.role,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastLoginAt: entry.lastLoginAt || null,
  };
}

function assertRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error('Rol no válido. Usa "admin" o "empleado".');
  }
}

function findUser(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return loadStore().users.find((entry) => entry.normalizedEmail === normalized) || null;
}

function ensureAdminCount(afterAction) {
  const { users } = loadStore();
  const admins = users.filter((user) => user.role === 'admin');
  if (admins.length === 0) {
    throw new Error(afterAction || 'Debe existir al menos un administrador.');
  }
}

async function ensureDefaults() {
  const store = loadStore();
  const existing = new Set(store.users.map((user) => user.normalizedEmail));

  const seeds = [
    {
      email: DEFAULT_ADMIN.email,
      name: DEFAULT_ADMIN.name,
      role: DEFAULT_ADMIN.role,
      password: DEFAULT_ADMIN.password,
      metadata: { createdBy: 'seed:default' },
    },
    ...DEFAULT_SEEDED_USERS.map((entry) => ({
      email: entry.email,
      name: entry.name,
      role: entry.role,
      password: entry.password,
      metadata: { ...(entry.metadata || {}) },
    })),
  ];

  const createdEmails = [];
  for (const seed of seeds) {
    const normalizedEmail = normalizeEmail(seed.email);
    if (!normalizedEmail || existing.has(normalizedEmail)) continue;

    await createUser({
      email: seed.email,
      name: seed.name,
      role: seed.role,
      password: seed.password,
      skipDuplicateCheck: true,
      metadata: { ...(seed.metadata || {}), seed: true },
    });
    existing.add(normalizedEmail);
    createdEmails.push(seed.email.trim());
  }

  if (createdEmails.length > 0) {
    console.info('UserStore: se inicializaron cuentas predeterminadas.', createdEmails);
  }
}

async function createUser({ email, name = '', role = 'empleado', password, skipDuplicateCheck = false, metadata = {} }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('El email es obligatorio.');
  }
  assertRole(role);
  if (!password || password.length < 10) {
    throw new Error('La contraseña debe tener al menos 10 caracteres.');
  }
  if (!skipDuplicateCheck && findUser(normalizedEmail)) {
    throw new Error('Ya existe un usuario con ese email.');
  }

  const salt = toBase64(randomBytes(16));
  const passwordHash = await deriveHash(password, salt);
  const now = nowISO();

  const entry = {
    id: metadata.id || (cryptoObj.randomUUID ? cryptoObj.randomUUID() : `user-${Date.now()}`),
    email: email.trim(),
    normalizedEmail,
    name: name.trim(),
    role,
    salt,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    metadata,
  };

  loadStore().users.push(entry);
  persist();
  return sanitizeUser(entry);
}

async function authenticate(email, password) {
  const user = findUser(email);
  if (!user) {
    throw new Error('Credenciales inválidas.');
  }
  if (!password) {
    throw new Error('Introduce tu contraseña.');
  }
  const hash = await deriveHash(password, user.salt);
  if (hash !== user.passwordHash) {
    throw new Error('Credenciales inválidas.');
  }
  user.lastLoginAt = nowISO();
  persist();
  return sanitizeUser(user);
}

function getUser(email) {
  const user = findUser(email);
  return user ? sanitizeUser(user) : null;
}

function listUsers() {
  return loadStore()
    .users.slice()
    .sort((a, b) => a.email.localeCompare(b.email))
    .map(sanitizeUser);
}

async function changeRole(email, role) {
  assertRole(role);
  const user = findUser(email);
  if (!user) {
    throw new Error('Usuario no encontrado.');
  }
  const originalRole = user.role;
  user.role = role;
  user.updatedAt = nowISO();
  persist();
  try {
    ensureAdminCount('No puedes dejar al sistema sin administradores.');
  } catch (error) {
    user.role = originalRole;
    user.updatedAt = nowISO();
    persist();
    throw error;
  }
  return sanitizeUser(user);
}

async function resetPassword(email, newPassword) {
  if (!newPassword || newPassword.length < 10) {
    throw new Error('La nueva contraseña debe tener al menos 10 caracteres.');
  }
  const user = findUser(email);
  if (!user) {
    throw new Error('Usuario no encontrado.');
  }
  const salt = toBase64(randomBytes(16));
  const passwordHash = await deriveHash(newPassword, salt);
  user.salt = salt;
  user.passwordHash = passwordHash;
  user.updatedAt = nowISO();
  persist();
  return sanitizeUser(user);
}

async function deleteUser(email) {
  const normalized = normalizeEmail(email);
  const store = loadStore();
  const index = store.users.findIndex((user) => user.normalizedEmail === normalized);
  if (index === -1) {
    throw new Error('Usuario no encontrado.');
  }
  const [removed] = store.users.splice(index, 1);
  persist();
  try {
    ensureAdminCount('No puedes eliminar al último administrador.');
  } catch (error) {
    store.users.splice(index, 0, removed);
    persist();
    throw error;
  }
  return true;
}

function generateSecurePassword(length = 16) {
  if (length < 10) length = 10;
  return randomString(length);
}

async function init() {
  if (state.initialized) return api;
  loadStore();
  await ensureDefaults();
  state.initialized = true;
  return api;
}

const api = Object.freeze({
  init,
  authenticate,
  createUser,
  listUsers,
  getUser,
  changeRole,
  resetPassword,
  deleteUser,
  generateSecurePassword,
  DEFAULT_ADMIN,
});

// Exportar directamente en lugar de asignar a global
export const UserStore = api;
// Mantener compatibilidad global temporalmente si es necesario, pero mejor eliminarlo si migramos todo
window.UserStore = api;