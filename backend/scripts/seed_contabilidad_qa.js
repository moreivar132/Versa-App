const pool = require('../db');
const bcrypt = require('bcryptjs');

async function seedQA() {
    console.log('🌱 Iniciando Seed QA para Contabilidad V2...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Limpiar datos previos de prueba (evitar duplicados)
        // Usamos emails específicos para identificar datos de QA
        console.log('🧹 Limpiando datos anteriores...');
        await client.query("DELETE FROM usuario WHERE email LIKE '%@qa.versa.com'");
        await client.query("DELETE FROM tenant WHERE nombre LIKE 'QA Tenant%'");

        // 2. Crear Tenants
        console.log('🏢 Creando Tenants...');
        const tenantA = await client.query(`
            INSERT INTO tenant (nombre, created_at) 
            VALUES ('QA Tenant A', now()) RETURNING id
        `);
        const idTenantA = tenantA.rows[0].id;

        const tenantB = await client.query(`
            INSERT INTO tenant (nombre, created_at) 
            VALUES ('QA Tenant B', now()) RETURNING id
        `);
        const idTenantB = tenantB.rows[0].id;

        // 3. Crear Usuarios
        console.log('👤 Creando Usuarios...');
        const pass = await bcrypt.hash('123456', 10);

        // Admin Tenant A
        const userAdminA = await client.query(`
            INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
            VALUES ($1, 'Admin A', 'adminA@qa.versa.com', $2, false) RETURNING id
        `, [idTenantA, pass]);

        // Contable Tenant A
        const userContableA = await client.query(`
            INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
            VALUES ($1, 'Contable A', 'contableA@qa.versa.com', $2, false) RETURNING id
        `, [idTenantA, pass]);

        // Admin Tenant B
        const userAdminB = await client.query(`
            INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
            VALUES ($1, 'Admin B', 'adminB@qa.versa.com', $2, false) RETURNING id
        `, [idTenantB, pass]);

        // 4. Crear Empresas (Fiscales)
        console.log('🏭 Creando Empresas Fiscales...');

        // Empresa A1 (Tenant A)
        const empresaA1 = await client.query(`
            INSERT INTO accounting_empresa (id_tenant, nombre_legal, nif_cif, pais, moneda, activo)
            VALUES ($1, 'Empresa A1 S.L.', 'B-QA-A1', 'ES', 'EUR', true) RETURNING id
        `, [idTenantA]);
        const idEmpresaA1 = empresaA1.rows[0].id;

        // Empresa A2 (Tenant A)
        const empresaA2 = await client.query(`
            INSERT INTO accounting_empresa (id_tenant, nombre_legal, nif_cif, pais, moneda, activo)
            VALUES ($1, 'Empresa A2 Int.', 'B-QA-A2', 'US', 'USD', true) RETURNING id
        `, [idTenantA]);
        const idEmpresaA2 = empresaA2.rows[0].id;

        // Empresa B1 (Tenant B)
        const empresaB1 = await client.query(`
            INSERT INTO accounting_empresa (id_tenant, nombre_legal, nif_cif, pais, moneda, activo)
            VALUES ($1, 'Empresa B1 S.L.', 'B-QA-B1', 'ES', 'EUR', true) RETURNING id
        `, [idTenantB]);
        const idEmpresaB1 = empresaB1.rows[0].id;

        // 5. Asignar Usuarios a Empresas
        console.log('🔗 Asignando usuarios a empresas...');

        // Admin A -> A1 (Admin)
        await client.query(`
            INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa)
            VALUES ($1, $2, 'empresa_admin')
        `, [userAdminA.rows[0].id, idEmpresaA1]);

        // Admin A -> A2 (Lector)
        await client.query(`
            INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa)
            VALUES ($1, $2, 'empresa_lector')
        `, [userAdminA.rows[0].id, idEmpresaA2]);

        // Contable A -> A1 (Contable)
        await client.query(`
            INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa)
            VALUES ($1, $2, 'empresa_contable')
        `, [userContableA.rows[0].id, idEmpresaA1]);

        // Admin B -> B1 (Admin)
        await client.query(`
            INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa)
            VALUES ($1, $2, 'empresa_admin')
        `, [userAdminB.rows[0].id, idEmpresaB1]);

        // 6. Crear Contactos
        console.log('👥 Creando Contactos...');
        const contactoC1 = await client.query(`
            INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif)
            VALUES ($1, $2, 'CLIENTE', 'Cliente QA 1', 'C-QA-1') RETURNING id
        `, [idTenantA, idEmpresaA1]);

        const contactoP1 = await client.query(`
            INSERT INTO contabilidad_contacto (id_tenant, id_empresa, tipo, nombre, nif_cif)
            VALUES ($1, $2, 'PROVEEDOR', 'Proveedor QA 1', 'P-QA-1') RETURNING id
        `, [idTenantA, idEmpresaA1]);

        // 7. Crear Facturas
        console.log('🧾 Creando Facturas...');

        // Factura Ingreso en A1
        await client.query(`
            INSERT INTO contabilidad_factura (
                id_tenant, id_empresa, tipo, numero_factura, 
                fecha_emision, fecha_devengo, base_imponible, iva_porcentaje, iva_importe, total,
                estado, id_contacto
            ) VALUES (
                $1, $2, 'INGRESO', 'FAC-QA-001',
                CURRENT_DATE, CURRENT_DATE, 1000.00, 21.00, 210.00, 1210.00,
                'PENDIENTE', $3
            )
        `, [idTenantA, idEmpresaA1, contactoC1.rows[0].id]);

        // Factura Gasto en A1
        await client.query(`
            INSERT INTO contabilidad_factura (
                id_tenant, id_empresa, tipo, numero_factura, 
                fecha_emision, fecha_devengo, base_imponible, iva_porcentaje, iva_importe, total,
                estado, id_contacto
            ) VALUES (
                $1, $2, 'GASTO', 'GAS-QA-001',
                CURRENT_DATE, CURRENT_DATE, 500.00, 21.00, 105.00, 605.00,
                'PAGADA', $3
            )
        `, [idTenantA, idEmpresaA1, contactoP1.rows[0].id]);

        // Factura en A2 (Verificar isolation)
        await client.query(`
            INSERT INTO contabilidad_factura (
                id_tenant, id_empresa, tipo, numero_factura, 
                fecha_emision, fecha_devengo, base_imponible, iva_porcentaje, iva_importe, total,
                estado
            ) VALUES (
                $1, $2, 'INGRESO', 'FAC-US-001',
                CURRENT_DATE, CURRENT_DATE, 2000.00, 0.00, 0.00, 2000.00,
                'PENDIENTE'
            )
        `, [idTenantA, idEmpresaA2]);

        await client.query('COMMIT');
        console.log('✅ SEED QA FINALIZADO CORRECTAMENTE');
        console.log('-----------------------------------');
        console.log(`Resource IDs:`);
        console.log(`Tenant A: ${idTenantA} | Tenant B: ${idTenantB}`);
        console.log(`Admin A Email: adminA@qa.versa.com (123456)`);
        console.log(`Empresa A1: ${idEmpresaA1} | Empresa A2: ${idEmpresaA2}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Seed QA:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end(); // Cerrar pool para terminar script
    }
}

seedQA();
