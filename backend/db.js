const { Pool } = require('pg');

// 1. SOLO cargar .env si NO estamos en producción (o si se fuerza explícitamente en scripts locales)
// Esto previene que un archivo .env residual en producción sobrescriba las variables del sistema.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

/**
 * Resolución de Connection String
 * Soporta múltiples proveedores (Neon, Railway, Standard) y asegura prioridad.
 */
const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL;

// 2. Fail-Fast: Si no hay connection string, morir inmediatamente.
if (!connectionString) {
  const message = '❌ ERROR FATAL: No connection string found. Define DATABASE_URL, NEON_DATABASE_URL or POSTGRES_URL.';
  console.error(message);
  process.exit(1);
}

// 3. Guardrail de Seguridad en Producción
if (process.env.NODE_ENV === 'production') {
  // Verificar sanidad básica de la URL (no apuntar a localhost en prod)
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    console.error('❌ SECURITY ALERT: Producción intentando conectar a Localhost. Abortando inicio.');
    process.exit(1);
  }

  // Log seguro (solo mostrar protocolo y host, ocultar credenciales)
  try {
    const url = new URL(connectionString);
    console.log(`🔌 Initializing DB Pool for Production: ${url.protocol}//${url.hostname}${url.pathname}`);
  } catch (e) {
    console.log('🔌 Initializing DB Pool for Production (URL oculta por formato no estándar)');
  }
}

let pool;
try {
  // La DATABASE_URL ya contiene la configuración de SSL
  pool = new Pool({ connectionString });
} catch (error) {
  console.error('❌ No se pudo inicializar el pool de la base de datos.', error);
  throw error;
}

// Evento para verificar la conexión
pool.on('connect', () => {
  // En producción reducimos el ruido, en dev confirmamos conexión
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔌 Conexión exitosa a la base de datos!');
  }
});

// Evento para capturar errores de conexión
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el cliente del pool de la base de datos', err);
  // No salir del proceso en error transitorio de conexión, dejar que el pool maneje reconexión o el healthcheck falle
});

module.exports = pool;
