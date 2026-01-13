const pool = require('../db');

async function createWhatsAppTables() {
    try {
        console.log('🔧 Creando tablas para WhatsApp TimelinesAI...');

        // Tabla para almacenar la información de los chats
        await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) UNIQUE,
        phone VARCHAR(50) NOT NULL,
        nombre VARCHAR(255),
        label VARCHAR(100) DEFAULT 'Manager',
        origen VARCHAR(100) DEFAULT 'Manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Tabla para almacenar los mensajes
        await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        message_text TEXT NOT NULL,
        sender_type VARCHAR(50) NOT NULL, -- 'client' o 'operator'
        sender_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
        timelines_message_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES whatsapp_chats(chat_id) ON DELETE CASCADE
      );
    `);

        // Índices para mejorar el rendimiento
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone ON whatsapp_chats(phone);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_chat_id ON whatsapp_chats(chat_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);
    `);

        console.log('✅ Tablas de WhatsApp TimelinesAI creadas exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando tablas:', error);
        process.exit(1);
    }
}

createWhatsAppTables();
