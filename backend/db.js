const { Pool } = require('pg');
require('dotenv').config(); // Carga las variables de entorno

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const message = 'La variable de entorno DATABASE_URL no está definida. Añade tu cadena de conexión en un archivo .env o en el entorno antes de iniciar el backend.';
  console.error(`❌ ${message}`);
  throw new Error(message);
}

let pool;
try {
  // La DATABASE_URL ya contiene la configuración de SSL, por lo que no es
  // necesario añadirla de nuevo en la configuración del Pool.
  pool = new Pool({ connectionString });
} catch (error) {
  console.error('❌ No se pudo inicializar el pool de la base de datos. Revisa el formato de tu DATABASE_URL.', error);
  throw error;
}

// Evento para verificar la conexión
pool.on('connect', () => {
  console.log('🔌 Conexión exitosa a la base de datos de Neon!');
});

// Evento para capturar errores de conexión
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el cliente del pool de la base de datos', err);
  process.exit(-1);
});

module.exports = pool;
