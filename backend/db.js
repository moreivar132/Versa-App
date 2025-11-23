const { Pool } = require('pg');
require('dotenv').config(); // Carga las variables de entorno

// La DATABASE_URL ya contiene la configuración de SSL, por lo que no es
// necesario añadirla de nuevo en la configuración del Pool.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
