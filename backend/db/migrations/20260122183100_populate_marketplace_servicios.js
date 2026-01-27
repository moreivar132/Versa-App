/**
 * Migration: populate_marketplace_servicios
 * Source: backend/archive/legacy-migrations/populate_marketplace_servicios.sql
 * Module: Marketplace
 * Risk Level: Medio (data seed)
 * 
 * Seeds the marketplace_servicio catalog with common services:
 * - Motorcycle services
 * - Car services  
 * - Bicycle/E-bike services
 */

exports.up = async function (knex) {
    console.log('[Migration] Seeding marketplace_servicio catalog...');

    await knex.raw(`
        -- Servicios para Motos
        INSERT INTO marketplace_servicio (nombre, categoria, descripcion, activo) VALUES
        ('Cambio de aceite', 'Mantenimiento', 'Cambio de aceite y filtro', true),
        ('Cambio de aceite express', 'Mantenimiento', 'Cambio rápido de aceite (20min)', true),
        ('Revisión de frenos', 'Frenos', 'Inspección completa del sistema de frenos', true),
        ('Cambio de pastillas de freno', 'Frenos', 'Sustitución de pastillas delanteras o traseras', true),
        ('Cambio de discos de freno', 'Frenos', 'Sustitución de discos de freno', true),
        ('Cambio de líquido de frenos', 'Frenos', 'Cambio completo de líquido de frenos', true),
        ('Cambio de neumáticos', 'Neumáticos', 'Cambio de neumáticos delantero y/o trasero', true),
        ('Equilibrado de ruedas', 'Neumáticos', 'Equilibrado y balanceo de ruedas', true),
        ('Reparación de pinchazos', 'Neumáticos', 'Reparación de neumáticos pinchados', true),
        ('Diagnosis electrónica', 'Diagnóstico', 'Diagnóstico completo del sistema electrónico', true),
        ('Diagnosis de motor', 'Diagnóstico', 'Diagnóstico del sistema del motor', true),
        ('ITV pre-revisión', 'ITV', 'Revisión previa a la ITV', true),
        ('ITV acompañamiento', 'ITV', 'Acompañamiento y gestión de ITV', true),
        ('Revisión general', 'Mantenimiento', 'Revisión completa del vehículo', true),
        ('Mantenimiento general', 'Mantenimiento', 'Mantenimiento completo programado', true),
        ('Cambio de filtro de aire', 'Mantenimiento', 'Sustitución del filtro de aire', true),
        ('Limpieza de carburadores', 'Mantenimiento', 'Limpieza y ajuste de carburadores', true),
        ('Sincronización de carburadores', 'Mantenimiento', 'Sincronización de carburadores múltiples', true),
        ('Ajuste de cadena', 'Transmisión', 'Ajuste y lubricación de cadena', true),
        ('Cambio de kit de transmisión', 'Transmisión', 'Cambio completo de cadena, piñón y corona', true),
        ('Cambio de embrague', 'Transmisión', 'Sustitución de discos de embrague', true),
        ('Revisión de suspensión', 'Suspensión', 'Inspección y ajuste de suspensión', true),
        ('Cambio de amortiguadores', 'Suspensión', 'Sustitución de amortiguadores', true),
        ('Revisión de batería', 'Eléctrico', 'Comprobación y carga de batería', true),
        ('Cambio de batería', 'Eléctrico', 'Sustitución de batería', true),
        ('Actualización de software', 'Eléctrico', 'Actualización del software del vehículo', true),
        ('Cambio de escape', 'Personalización', 'Instalación de escape deportivo o custom', true),
        ('Pintura custom', 'Personalización', 'Pintura personalizada del vehículo', true),
        ('Personalización completa', 'Personalización', 'Proyecto de customización integral', true)
        ON CONFLICT (nombre) DO NOTHING;

        -- Servicios para Coches
        INSERT INTO marketplace_servicio (nombre, categoria, descripcion, activo) VALUES
        ('Cambio de aceite y filtros (coche)', 'Mantenimiento', 'Cambio de aceite y filtros para coche', true),
        ('Revisión pre-ITV (coche)', 'ITV', 'Revisión previa a la ITV para coche', true),
        ('Cambio de neumáticos (coche)', 'Neumáticos', 'Cambio de neumáticos para coche', true),
        ('Alineación y geometría', 'Neumáticos', 'Alineación de ruedas y geometría', true),
        ('Cambio de kit de distribución', 'Motor', 'Cambio de correa/cadena de distribución', true),
        ('Revisión de aire acondicionado', 'Climatización', 'Revisión y recarga de A/A', true),
        ('Recarga de aire acondicionado', 'Climatización', 'Recarga de gas refrigerante', true),
        ('Limpieza de inyectores', 'Motor', 'Limpieza ultrasónica de inyectores', true),
        ('Cambio de filtro de partículas', 'Motor', 'Sustitución de filtro DPF/FAP', true),
        ('Regeneración de filtro de partículas', 'Motor', 'Regeneración forzada de DPF/FAP', true)
        ON CONFLICT (nombre) DO NOTHING;

        -- Servicios para Bicicletas/E-bikes
        INSERT INTO marketplace_servicio (nombre, categoria, descripcion, activo) VALUES
        ('Revisión de bicicleta', 'Mantenimiento', 'Revisión completa de bicicleta', true),
        ('Ajuste de cambios', 'Mantenimiento', 'Ajuste de sistema de cambios', true),
        ('Centrado de ruedas', 'Mantenimiento', 'Centrado y tensado de radios', true),
        ('Cambio de cubiertas', 'Neumáticos', 'Cambio de cubiertas delanteras y/o traseras', true),
        ('Revisión de batería (e-bike)', 'Eléctrico', 'Diagnóstico de batería de e-bike', true),
        ('Revisión de motor (e-bike)', 'Eléctrico', 'Diagnóstico de motor eléctrico', true),
        ('Actualización firmware (e-bike)', 'Eléctrico', 'Actualización de firmware del sistema', true),
        ('Puesta a punto completa', 'Mantenimiento', 'Puesta a punto integral de la bicicleta', true)
        ON CONFLICT (nombre) DO NOTHING;
    `);

    console.log('[Migration] ✅ marketplace_servicio catalog seeded');
};

exports.down = async function (knex) {
    console.log('[Migration] ⚠️ Data seed - manual cleanup required');
    // Seed data is not automatically removed to prevent data loss
    // If rollback is needed, delete specific records manually
    return Promise.resolve();
};

exports.config = { transaction: true };
