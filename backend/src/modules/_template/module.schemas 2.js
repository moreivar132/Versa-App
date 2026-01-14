/**
 * Module Schemas Template
 * Define schemas de validación para el módulo.
 * 
 * Por ahora usamos validación manual, pero este archivo prepara
 * la estructura para migrar a Zod/Joi en el futuro.
 */

/**
 * Schema para creación
 */
const createSchema = {
    required: ['nombre'],
    optional: ['descripcion', 'estado'],
    defaults: {
        estado: 'ACTIVO'
    }
};

/**
 * Schema para actualización
 */
const updateSchema = {
    required: [],
    optional: ['nombre', 'descripcion', 'estado']
};

/**
 * Schema para filtros de búsqueda
 */
const querySchema = {
    optional: ['q', 'estado', 'limit', 'offset'],
    defaults: {
        limit: 50,
        offset: 0
    }
};

/**
 * Aplicar valores por defecto
 */
function applyDefaults(data, schema) {
    return {
        ...schema.defaults,
        ...data
    };
}

/**
 * Extraer solo campos permitidos
 */
function pickFields(data, schema) {
    const allowed = [...(schema.required || []), ...(schema.optional || [])];
    const result = {};
    for (const key of allowed) {
        if (data[key] !== undefined) {
            result[key] = data[key];
        }
    }
    return result;
}

module.exports = {
    createSchema,
    updateSchema,
    querySchema,
    applyDefaults,
    pickFields
};
