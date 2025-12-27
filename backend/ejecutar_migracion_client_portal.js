/**
 * VERSA - PASO 5: Portal Cliente
 * Script para ejecutar migración de tabla clientefinal_auth
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function runMigration() {
    console.log("🚀 Iniciando migración: clientefinal_auth...\n");

    const migrationPath = path.join(__dirname, "migrations", "create_clientefinal_auth.sql");

    if (!fs.existsSync(migrationPath)) {
        console.error("❌ Archivo de migración no encontrado:", migrationPath);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        console.log("📋 Ejecutando SQL de migración...");
        await client.query(sql);

        await client.query("COMMIT");
        console.log("\n✅ Migración completada exitosamente!");

        // Verificar tabla creada
        const checkResult = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'clientefinal_auth'
            ORDER BY ordinal_position
        `);

        console.log("\n📊 Estructura de tabla clientefinal_auth:");
        console.table(checkResult.rows);

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("\n❌ Error durante la migración:", error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
