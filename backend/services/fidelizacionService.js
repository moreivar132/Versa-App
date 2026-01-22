/**
 * Fidelización Service
 * Lógica de negocio para el sistema de puntos y tarjeta wallet
 */

const crypto = require('crypto');
const { getTenantDb } = require('../src/core/db/tenant-db');
const emailAutomationService = require('./emailAutomationService');
const notificacionService = require('./notificacionService');
// Removido notificationService duplicado o incorrecto

// Configuración desde variables de entorno
const PEPPER = process.env.LOYALTY_PUBLIC_TOKEN_PEPPER || 'default_pepper_change_in_production';
const QR_TTL_SECONDS = parseInt(process.env.LOYALTY_QR_TTL_SECONDS || '300');
const { APP_URL } = require('../config/urls');

function resolveDb(ctxOrDb) {
    if (!ctxOrDb) return getTenantDb({}, { allowNoTenant: true });
    if (typeof ctxOrDb.query === 'function') return ctxOrDb;
    return getTenantDb(ctxOrDb);
}

/**
 * Genera un token aleatorio seguro (32 bytes, base64url)
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Genera un nonce aleatorio para QR (16 bytes, hex)
 */
function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash con pepper usando SHA256
 */
function hashWithPepper(value) {
    return crypto.createHash('sha256').update(value + PEPPER).digest('hex');
}

/**
 * Genera un código de miembro corto y único
 */
function generateMemberCode() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `V${timestamp.slice(-4)}${random}`;
}

/**
 * Obtener o crear el programa de fidelización de un tenant
 */
async function getOrCreatePrograma(idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    // Buscar programa existente
    let result = await db.query(
        'SELECT * FROM fidelizacion_programa WHERE id_tenant = $1',
        [idTenant]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Crear programa por defecto
    result = await db.query(
        `INSERT INTO fidelizacion_programa (id_tenant, nombre, etiqueta_puntos, activo)
         VALUES ($1, 'VERSA Puntos', 'Puntos', true)
         RETURNING *`,
        [idTenant]
    );

    return result.rows[0];
}

/**
 * Inscribir un cliente en el programa de fidelización
 */
async function enrollMember(idCliente, idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);

    return db.txWithRLS(async (tx) => {
        // Verificar que el cliente existe y pertenece al tenant
        const clienteResult = await tx.query(
            'SELECT id, nombre FROM clientefinal WHERE id = $1 AND id_tenant = $2',
            [idCliente, idTenant]
        );

        if (clienteResult.rows.length === 0) {
            throw new Error('Cliente no encontrado o no pertenece al tenant');
        }

        // Obtener o crear programa (usando tx)
        const programa = await getOrCreatePrograma(idTenant, tx);

        // Verificar si ya está inscrito
        const existingMember = await tx.query(
            'SELECT * FROM fidelizacion_miembro WHERE id_cliente = $1 AND id_tenant = $2',
            [idCliente, idTenant]
        );

        let miembro;
        if (existingMember.rows.length > 0) {
            miembro = existingMember.rows[0];
        } else {
            // Crear nuevo miembro
            const memberCode = generateMemberCode();
            const memberResult = await tx.query(
                `INSERT INTO fidelizacion_miembro (id_tenant, id_programa, id_cliente, member_code, estado)
                 VALUES ($1, $2, $3, $4, 'active')
                 RETURNING *`,
                [idTenant, programa.id, idCliente, memberCode]
            );
            miembro = memberResult.rows[0];
        }

        // Crear o actualizar el link público
        const token = generateSecureToken();
        const tokenHash = hashWithPepper(token);
        const tokenLast4 = token.slice(-4);

        // Upsert del link
        await tx.query(
            `INSERT INTO fidelizacion_tarjeta_link (id_tenant, id_miembro, public_token_hash, token_last4)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id_miembro) DO UPDATE SET
                public_token_hash = EXCLUDED.public_token_hash,
                token_last4 = EXCLUDED.token_last4,
                updated_at = CURRENT_TIMESTAMP`,
            [idTenant, miembro.id, tokenHash, tokenLast4]
        );

        // Construir URL pública
        const publicUrl = `${APP_URL}/card.html?token=${token}`;

        return {
            miembro,
            publicUrl,
            token, // Solo se devuelve una vez, nunca más
            clienteNombre: clienteResult.rows[0].nombre
        };
    });
}

/**
 * Regenerar el token de un miembro
 */
async function regenerateToken(idMiembro, idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const token = generateSecureToken();
    const tokenHash = hashWithPepper(token);
    const tokenLast4 = token.slice(-4);

    const result = await db.query(
        `UPDATE fidelizacion_tarjeta_link 
         SET public_token_hash = $1, token_last4 = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id_miembro = $3 AND id_tenant = $4
         RETURNING *`,
        [tokenHash, tokenLast4, idMiembro, idTenant]
    );

    if (result.rows.length === 0) {
        throw new Error('Link no encontrado');
    }

    const publicUrl = `${APP_URL}/card.html?token=${token}`;
    return { publicUrl, token };
}

/**
 * Validar un token público y obtener datos de la tarjeta
 */
async function getCardData(token, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const tokenHash = hashWithPepper(token);

    const result = await db.query(
        `SELECT 
            tl.id AS link_id,
            tl.id_miembro,
            tl.id_tenant,
            tl.last_opened_at,
            m.id_cliente,
            m.member_code,
            m.estado,
            c.nombre AS cliente_nombre,
            p.nombre AS programa_nombre,
            p.etiqueta_puntos,
            COALESCE(s.balance, 0) AS balance
         FROM fidelizacion_tarjeta_link tl
         JOIN fidelizacion_miembro m ON m.id = tl.id_miembro
         JOIN clientefinal c ON c.id = m.id_cliente
         JOIN fidelizacion_programa p ON p.id = m.id_programa
         LEFT JOIN vw_fidelizacion_saldo s ON s.id_miembro = m.id
         WHERE tl.public_token_hash = $1`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const data = result.rows[0];

    // Actualizar last_opened_at
    await db.query(
        'UPDATE fidelizacion_tarjeta_link SET last_opened_at = CURRENT_TIMESTAMP WHERE id = $1',
        [data.link_id]
    );

    // Buscar promo activa
    const promoResult = await db.query(
        `SELECT id, titulo, descripcion 
         FROM fidelizacion_promo 
         WHERE id_tenant = $1 
         AND activo = true 
         AND starts_at <= CURRENT_TIMESTAMP 
         AND ends_at >= CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [data.id_tenant]
    );

    // Abreviar nombre (ej: "Rafael Quintero" -> "Rafael Q.")
    const nombreParts = data.cliente_nombre.split(' ');
    let displayName = nombreParts[0];
    if (nombreParts.length > 1) {
        displayName += ` ${nombreParts[1][0]}.`;
    }

    return {
        display_name: displayName,
        points_balance: data.balance,
        points_label: data.etiqueta_puntos,
        program_name: data.programa_nombre,
        member_code: data.member_code,
        estado: data.estado,
        promo_activa: promoResult.rows.length > 0 ? promoResult.rows[0] : null,
        qr_refresh_seconds: parseInt(process.env.LOYALTY_QR_REFRESH_SECONDS || '30'),
        id_miembro: data.id_miembro,
        id_tenant: data.id_tenant
    };
}

/**
 * Generar una sesión de QR dinámica
 */
async function generateQRSession(idMiembro, idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const nonce = generateNonce();
    const nonceHash = hashWithPepper(nonce);
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

    await db.query(
        `INSERT INTO fidelizacion_qr_sesion (id_tenant, id_miembro, nonce_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [idTenant, idMiembro, nonceHash, expiresAt]
    );

    // Construir payload del QR
    // Formato: VERSAQR.v1.{id_tenant}.{id_miembro}.{nonce}.{expUnix}
    const expUnix = Math.floor(expiresAt.getTime() / 1000);
    const qrPayload = `VERSAQR.v1.${idTenant}.${idMiembro}.${nonce}.${expUnix}`;

    return {
        qr_payload: qrPayload,
        expires_at: expiresAt.toISOString(),
        expires_unix: expUnix
    };
}

/**
 * Validar QR y sumar puntos
 */
async function validateAndEarnPoints(adminIdTenant, qrPayload, puntos, motivo, userId, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    let idMiembro;
    let sessionId = null;

    if (qrPayload.startsWith('VERSAQR.v1.')) {
        // === LÓGICA QR ===
        const parts = qrPayload.split('.');
        if (parts.length !== 6) {
            throw new Error('Formato de QR inválido');
        }

        const [, , idTenantStr, idMiembroStr, nonce, expUnixStr] = parts;
        const qrIdTenant = parseInt(idTenantStr);
        idMiembro = parseInt(idMiembroStr);
        const expUnix = parseInt(expUnixStr);

        if (isNaN(qrIdTenant) || isNaN(idMiembro) || isNaN(expUnix)) {
            throw new Error('Datos del QR inválidos');
        }

        if (qrIdTenant !== adminIdTenant) {
            throw new Error('El QR no pertenece a este taller');
        }

        // Verificar expiración
        const now = Math.floor(Date.now() / 1000);
        if (expUnix < now) {
            throw new Error('QR expirado');
        }

        // Buscar sesión válida
        const nonceHash = hashWithPepper(nonce);
        const sessionResult = await db.query(
            `SELECT id, used_at FROM fidelizacion_qr_sesion 
             WHERE id_tenant = $1 
               AND id_miembro = $2 
               AND nonce_hash = $3 
               AND expires_at >= CURRENT_TIMESTAMP`,
            [adminIdTenant, idMiembro, nonceHash]
        );

        if (sessionResult.rows.length === 0) {
            throw new Error('QR no válido o ya expirado');
        }

        const session = sessionResult.rows[0];
        if (session.used_at) {
            throw new Error('QR ya utilizado');
        }
        sessionId = session.id;

    } else {
        // === LÓGICA MANUAL (CÓDIGO MIEMBRO) ===
        const code = qrPayload.replace('#', '').trim();
        if (code.length < 3) {
            throw new Error('Código inválido (muy corto)');
        }

        const memberRes = await db.query(
            'SELECT id FROM fidelizacion_miembro WHERE id_tenant = $1 AND member_code = $2',
            [adminIdTenant, code]
        );

        if (memberRes.rows.length === 0) {
            throw new Error('Miembro no encontrado con ese código');
        }
        idMiembro = memberRes.rows[0].id;
    }

    return db.txWithRLS(async (tx) => {
        // Si es QR, marcar sesión como usada
        if (sessionId) {
            await tx.query(
                'UPDATE fidelizacion_qr_sesion SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
                [sessionId]
            );
        }

        // Insertar movimiento
        await tx.query(
            `INSERT INTO fidelizacion_movimiento (id_tenant, id_miembro, tipo, puntos, motivo, created_by)
             VALUES ($1, $2, 'earn', $3, $4, $5)`,
            [adminIdTenant, idMiembro, puntos, motivo, userId]
        );

        // Obtener nuevo balance
        const balanceResult = await tx.query(
            'SELECT balance FROM vw_fidelizacion_saldo WHERE id_miembro = $1',
            [idMiembro]
        );
        const nuevoBalance = balanceResult.rows[0]?.balance || puntos;

        // Obtener id_cliente para la notificación
        const memberClientResult = await tx.query(
            'SELECT id_cliente FROM fidelizacion_miembro WHERE id = $1',
            [idMiembro]
        );
        const id_cliente = memberClientResult.rows[0]?.id_cliente;

        if (id_cliente) {
            // Notificación Dashboard (fuera de tx estricta, pero awaitable)
            // Se puede hacer async sin await si se quiere rendimiento, pero mejor consistente
            await notificacionService.crearNotificacion(
                id_cliente,
                'points_earned',
                `¡Has sumado ${puntos} puntos!`,
                `Motivo: ${motivo}. Tu nuevo saldo es ${nuevoBalance} puntos.`,
                { nuevoBalance, puntos, motivo }
            );

            // Notificación Email via Automation Service
            try {
                const clienteData = await tx.query('SELECT nombre, email FROM clientefinal WHERE id = $1', [id_cliente]);
                if (clienteData.rows[0]?.email) {
                    // Primero aseguramos que la plantilla base existe (id_tenant = NULL)
                    await tx.query(`
                        INSERT INTO email_template (id_tenant, code, name, subject, html_body, variables_json)
                        VALUES (NULL, 'LOYALTY_POINTS_EARNED', 'Puntos Fidelización Recibidos', '¡Has ganado {{puntos_ganados}} puntos!', $1, $2)
                        ON CONFLICT (id_tenant, code) DO NOTHING
                    `, [
                        `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111318; color: white; padding: 20px; border-radius: 16px;">
                            <h2 style="color: #ff5f00;">¡Felicidades, {{nombre}}!</h2>
                            <p>Acabas de sumar puntos en tu tarjeta de fidelización.</p>
                            <div style="background-color: #1a1d24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #282e39;">
                                <p style="font-size: 24px; font-weight: bold; margin: 0; color: #ff5f00;">+{{puntos_ganados}} Puntos</p>
                                <p style="color: #9da6b9; margin: 5px 0 0 0;">Motivo: {{motivo}}</p>
                            </div>
                            <p>Tu saldo actual es de: <strong>{{balance_total}} puntos</strong></p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{{portal_url}}" style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver mi Tarjeta</a>
                            </div>
                        </div>`,
                        JSON.stringify(['nombre', 'puntos_ganados', 'balance_total', 'motivo', 'portal_url'])
                    ]);

                    // Aseguramos que la automatización existe para este tenant
                    await tx.query(`
                        INSERT INTO email_automation (id_tenant, event_code, template_code, enabled)
                        VALUES ($1, 'LOYALTY_POINTS_EARNED', 'LOYALTY_POINTS_EARNED', true)
                        ON CONFLICT (id_tenant, event_code) DO NOTHING
                    `, [adminIdTenant]);

                    // call external service - assuming it handles its own DB or is robust
                    await emailAutomationService.triggerEvent({
                        id_tenant: adminIdTenant,
                        event_code: 'LOYALTY_POINTS_EARNED',
                        id_cliente: id_cliente,
                        to_email: clienteData.rows[0].email,
                        variables: {
                            nombre: clienteData.rows[0].nombre,
                            puntos_ganados: puntos,
                            balance_total: nuevoBalance,
                            motivo: motivo,
                            portal_url: 'https://goversa.app/portal'
                        }
                    });
                }
            } catch (emailErr) {
                console.error('Error enviando email fidelizacion via automation:', emailErr);
            }
        }

        return {
            success: true,
            puntos_sumados: puntos,
            nuevo_balance: nuevoBalance,
            id_miembro: idMiembro
        };
    });
}

/**
 * Ajuste manual de puntos
 */
async function adjustPoints(idMiembro, idTenant, puntos, motivo, userId, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    // Verificar que el miembro existe y pertenece al tenant
    const memberCheck = await db.query(
        'SELECT id FROM fidelizacion_miembro WHERE id = $1 AND id_tenant = $2',
        [idMiembro, idTenant]
    );

    if (memberCheck.rows.length === 0) {
        throw new Error('Miembro no encontrado');
    }

    await db.query(
        `INSERT INTO fidelizacion_movimiento (id_tenant, id_miembro, tipo, puntos, motivo, created_by)
         VALUES ($1, $2, 'adjust', $3, $4, $5)`,
        [idTenant, idMiembro, puntos, motivo, userId]
    );

    const balanceResult = await db.query(
        'SELECT balance FROM vw_fidelizacion_saldo WHERE id_miembro = $1',
        [idMiembro]
    );

    return {
        success: true,
        puntos_ajustados: puntos,
        nuevo_balance: balanceResult.rows[0]?.balance || 0
    };
}

/**
 * Buscar miembros por nombre, teléfono, email o código
 */
async function searchMembers(idTenant, query, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const searchQuery = `%${query}%`;

    const result = await db.query(
        `SELECT 
            m.id,
            m.member_code,
            m.estado,
            m.created_at,
            c.id AS id_cliente,
            c.nombre,
            c.telefono,
            c.email,
            COALESCE(s.balance, 0) AS balance,
            tl.token_last4
         FROM fidelizacion_miembro m
         JOIN clientefinal c ON c.id = m.id_cliente
         LEFT JOIN vw_fidelizacion_saldo s ON s.id_miembro = m.id
         LEFT JOIN fidelizacion_tarjeta_link tl ON tl.id_miembro = m.id
         WHERE m.id_tenant = $1
           AND (
               c.nombre ILIKE $2
               OR c.telefono ILIKE $2
               OR c.email ILIKE $2
               OR m.member_code ILIKE $2
           )
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [idTenant, searchQuery]
    );

    return result.rows;
}

/**
 * Listar todos los miembros de un tenant
 */
async function listMembers(idTenant, limit = 50, offset = 0, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const result = await db.query(
        `SELECT 
            m.id,
            m.member_code,
            m.estado,
            m.created_at,
            c.id AS id_cliente,
            c.nombre,
            c.telefono,
            c.email,
            COALESCE(s.balance, 0) AS balance,
            tl.token_last4
         FROM fidelizacion_miembro m
         JOIN clientefinal c ON c.id = m.id_cliente
         LEFT JOIN vw_fidelizacion_saldo s ON s.id_miembro = m.id
         LEFT JOIN fidelizacion_tarjeta_link tl ON tl.id_miembro = m.id
         WHERE m.id_tenant = $1
         ORDER BY m.created_at DESC
         LIMIT $2 OFFSET $3`,
        [idTenant, limit, offset]
    );

    return result.rows;
}

/**
 * Obtener historial de movimientos de un miembro
 */
async function getMemberHistory(idMiembro, idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const result = await db.query(
        `SELECT 
            mov.id,
            mov.tipo,
            mov.puntos,
            mov.motivo,
            mov.created_at,
            u.nombre AS created_by_nombre
         FROM fidelizacion_movimiento mov
         LEFT JOIN usuario u ON u.id = mov.created_by
         WHERE mov.id_miembro = $1 AND mov.id_tenant = $2
         ORDER BY mov.created_at DESC
         LIMIT 100`,
        [idMiembro, idTenant]
    );

    return result.rows;
}

/**
 * Obtener detalle de un miembro
 */
async function getMemberDetail(idMiembro, idTenant, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const result = await db.query(
        `SELECT 
            m.id,
            m.member_code,
            m.estado,
            m.created_at,
            c.id AS id_cliente,
            c.nombre,
            c.telefono,
            c.email,
            COALESCE(s.balance, 0) AS balance,
            tl.token_last4,
            tl.last_opened_at
         FROM fidelizacion_miembro m
         JOIN clientefinal c ON c.id = m.id_cliente
         LEFT JOIN vw_fidelizacion_saldo s ON s.id_miembro = m.id
         LEFT JOIN fidelizacion_tarjeta_link tl ON tl.id_miembro = m.id
         WHERE m.id = $1 AND m.id_tenant = $2`,
        [idMiembro, idTenant]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const member = result.rows[0];
    const history = await getMemberHistory(idMiembro, idTenant, db);

    return {
        ...member,
        historial: history
    };
}

// ==================== PROMOS ====================

/**
 * Listar promos de un tenant
 */
async function listPromos(idTenant, includeInactive = false, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    let query = `
        SELECT * FROM fidelizacion_promo 
        WHERE id_tenant = $1
    `;

    if (!includeInactive) {
        query += ' AND activo = true';
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, [idTenant]);
    return result.rows;
}

/**
 * Crear una promo
 */
async function createPromo(idTenant, data, userId, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const { titulo, descripcion, starts_at, ends_at, activo = true } = data;

    const result = await db.query(
        `INSERT INTO fidelizacion_promo (id_tenant, titulo, descripcion, starts_at, ends_at, activo, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [idTenant, titulo, descripcion, starts_at, ends_at, activo, userId]
    );

    const promo = result.rows[0];

    // --- CREAR CAMPAÑA EN BORRADOR (en vez de enviar automáticamente) ---
    try {
        const emailCampaignService = require('./emailCampaignService');

        // Obtener la plantilla de promociones
        const templateResult = await db.query(`
            SELECT html_body, subject FROM email_template 
            WHERE code = 'LOYALTY_PROMO_CREATED' 
            AND (id_tenant IS NULL OR id_tenant = $1)
            ORDER BY id_tenant DESC NULLS LAST
            LIMIT 1
        `, [idTenant]);

        const template = templateResult.rows[0] || {
            subject: '🎁 Nueva Promoción: {{promo_titulo}}',
            html_body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111318; color: white; padding: 20px; border-radius: 16px;">
                    <h2 style="color: #ff5f00;">¡Hola {{nombre}}! 🎁</h2>
                    <p>Tenemos una nueva promoción especial para ti.</p>
                    <div style="background-color: #1a1d24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #282e39;">
                        <h3 style="margin: 0; color: #ff5f00;">{{promo_titulo}}</h3>
                        <p style="color: #9da6b9; margin: 10px 0 0 0;">{{promo_descripcion}}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{portal_url}}" style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver mi Tarjeta</a>
                    </div>
                </div>`
        };

        // Reemplazar variables de la promo en la plantilla
        let htmlBody = template.html_body
            .replace(/\{\{\s*promo_titulo\s*\}\}/g, titulo)
            .replace(/\{\{\s*promo_descripcion\s*\}\}/g, descripcion || '');

        let subject = template.subject
            .replace(/\{\{\s*promo_titulo\s*\}\}/g, titulo);

        // Crear la campaña en borrador
        const campaign = await emailCampaignService.createCampaign(idTenant, {
            nombre: `Promo: ${titulo}`,
            tipo: 'promo',
            id_promo: promo.id,
            template_code: 'LOYALTY_PROMO_CREATED',
            subject: subject,
            html_body: htmlBody,
            preview_text: descripcion || '',
            recipient_filter: { type: 'active_members' },
            created_by: userId
        });

        // Devolver promo con info de la campaña
        promo.campaign_id = campaign.id;
        promo.campaign_status = campaign.status;
        promo.campaign_recipients = campaign.total_recipients;

    } catch (err) {
        console.error('Error creando campaña para promo:', err);
        // No fallar la creación de promo si falla la campaña
    }

    // --- NOTIFICACIÓN EN DASHBOARD (esto sí es inmediato) ---
    try {
        const membersResult = await db.query(`
            SELECT m.id_cliente FROM fidelizacion_miembro m 
            WHERE m.id_tenant = $1 AND m.estado = 'active'`,
            [idTenant]
        );

        for (const member of membersResult.rows) {
            await notificacionService.crearNotificacion(
                member.id_cliente,
                'promo_created',
                `🎁 Nueva Promo: ${titulo}`,
                descripcion || 'Tenemos una nueva promoción para ti.',
                { id_promo: promo.id }
            );
        }
    } catch (err) {
        console.error('Error creando notificaciones dashboard:', err);
    }

    return promo;
}

/**
 * Actualizar una promo
 */
async function updatePromo(idPromo, idTenant, data, ctxOrDb = null) {
    const db = resolveDb(ctxOrDb);
    const { titulo, descripcion, starts_at, ends_at, activo } = data;

    const result = await db.query(
        `UPDATE fidelizacion_promo 
         SET titulo = COALESCE($1, titulo),
             descripcion = COALESCE($2, descripcion),
             starts_at = COALESCE($3, starts_at),
             ends_at = COALESCE($4, ends_at),
             activo = COALESCE($5, activo),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND id_tenant = $7
         RETURNING *`,
        [titulo, descripcion, starts_at, ends_at, activo, idPromo, idTenant]
    );

    if (result.rows.length === 0) {
        throw new Error('Promo no encontrada');
    }

    return result.rows[0];
}

module.exports = {
    generateSecureToken,
    hashWithPepper,
    enrollMember,
    regenerateToken,
    getCardData,
    generateQRSession,
    validateAndEarnPoints,
    adjustPoints,
    searchMembers,
    listMembers,
    getMemberHistory,
    getMemberDetail,
    listPromos,
    createPromo,
    updatePromo
};
