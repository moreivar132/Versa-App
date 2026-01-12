/**
 * Configuración base de la base de datos (Knex / Pool).
 * Actualmente actúa como un cascarón para la futura migración.
 */

// Simulación de configuración de pool
export const dbConfig = {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 }
};

export const getDbConnection = () => {
    // Aquí se retornaría la instancia de Knex o el Pool de pg
    return {};
};
