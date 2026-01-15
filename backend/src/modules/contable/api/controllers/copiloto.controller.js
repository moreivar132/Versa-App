/**
 * Copiloto Controller
 * API endpoints para chat, insights y alertas del copiloto IA
 */

const pool = require('../../../../../db');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const chatgptService = require('../../../../../services/copilot/chatgpt.service');
const insightsService = require('../../../../../services/copilot/insights.service');

/**
 * POST /api/contabilidad/copiloto/chat
 * Enviar mensaje al copiloto
 */
async function chat(req, res) {
    const client = await pool.connect();

    try {
        const tenantId = getEffectiveTenant(req);
        const userId = req.user?.id;
        const empresaId = req.headers['x-empresa-id'];

        const { session_id, message, periodo_inicio, periodo_fin } = req.body;

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa requeridos' });
        }

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ ok: false, error: 'Mensaje requerido' });
        }

        const isSuperAdmin = req.isSuperAdmin || req.userPermissions?.isSuperAdmin;

        // Verificar empresa pertenece al tenant
        let empresaQuery = 'SELECT nombre_legal, id_tenant FROM accounting_empresa WHERE id = $1 AND deleted_at IS NULL';
        let empresaParams = [empresaId];

        if (!isSuperAdmin) {
            empresaQuery += ' AND id_tenant = $2';
            empresaParams.push(tenantId);
        }

        const empresaCheck = await client.query(empresaQuery, empresaParams);

        if (empresaCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        const empresaNombre = empresaCheck.rows[0].nombre_legal;
        if (isSuperAdmin) {
            tenantId = empresaCheck.rows[0].id_tenant;
        }

        await client.query('BEGIN');

        // Crear o recuperar sesión
        let sessionId = session_id;
        let conversationHistory = [];

        if (!sessionId) {
            // Nueva sesión
            const sessionResult = await client.query(`
                INSERT INTO copilot_chat_session (
                    id_tenant, id_empresa, created_by, 
                    context_periodo_inicio, context_periodo_fin
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [tenantId, empresaId, userId, periodo_inicio, periodo_fin]);

            sessionId = sessionResult.rows[0].id;
        } else {
            // Recuperar historial
            const historyResult = await client.query(`
                SELECT role, content
                FROM copilot_chat_message
                WHERE session_id = $1
                ORDER BY created_at
                LIMIT 20
            `, [sessionId]);

            conversationHistory = historyResult.rows.map(r => ({
                role: r.role,
                content: r.content
            }));
        }

        // Guardar mensaje del usuario
        await client.query(`
            INSERT INTO copilot_chat_message (session_id, role, content)
            VALUES ($1, 'user', $2)
        `, [sessionId, message]);

        // Llamar a ChatGPT
        const response = await chatgptService.askCopilot(message, {
            empresaId,
            empresaNombre,
            periodoInicio: periodo_inicio,
            periodoFin: periodo_fin,
            conversationHistory
        });

        // Guardar respuesta del asistente
        const assistantMsgResult = await client.query(`
            INSERT INTO copilot_chat_message (
                session_id, role, content, evidence_json, tools_used, tokens_used
            ) VALUES ($1, 'assistant', $2, $3, $4, $5)
            RETURNING id
        `, [
            sessionId,
            response.content,
            JSON.stringify(response.evidence),
            response.toolsUsed,
            response.tokensUsed
        ]);

        // Generar título si es primera interacción
        if (!session_id) {
            const title = await chatgptService.generateSessionTitle(message);
            await client.query(
                'UPDATE copilot_chat_session SET title = $1 WHERE id = $2',
                [title, sessionId]
            );
        }

        await client.query('COMMIT');

        res.json({
            ok: true,
            data: {
                session_id: sessionId,
                message_id: assistantMsgResult.rows[0].id,
                role: 'assistant',
                content: response.content,
                evidence: response.evidence,
                suggested_actions: generateSuggestedActions(response.evidence)
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Copiloto] Error in chat:', error);
        res.status(500).json({ ok: false, error: error.message });
    } finally {
        client.release();
    }
}

/**
 * GET /api/contabilidad/copiloto/insights
 * Obtener insights automáticos
 */
async function getInsights(req, res) {
    try {
        const userId = req.user?.id;

        // Resolve tenant: If superadmin, we can try to get it from the company
        let tenantId = getEffectiveTenant(req);
        let empresaId = req.query.empresa_id || req.headers['x-empresa-id'];

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa requeridos' });
        }

        // Si es superadmin y no tenemos tenantId o sospechamos que no coincide, 
        // lo resolvemos desde la empresa para evitar el error de validación
        const isSuperAdmin = req.isSuperAdmin || req.userPermissions?.isSuperAdmin;

        // Verificar empresa
        let empresaQuery = 'SELECT id, id_tenant FROM accounting_empresa WHERE id = $1';
        let empresaParams = [empresaId];

        if (!isSuperAdmin) {
            empresaQuery += ' AND id_tenant = $2';
            empresaParams.push(tenantId);
        }

        const empresaCheck = await pool.query(empresaQuery, empresaParams);

        if (empresaCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: `Empresa ${empresaId} no encontrada` });
        }

        // Si somos SuperAdmin, usamos el tenant real de la empresa
        if (isSuperAdmin) {
            tenantId = empresaCheck.rows[0].id_tenant;
        }

        // Construir periodo con valores por defecto seguros
        const period = {
            type: type || 'quarter',
            year: parseInt(year) || new Date().getFullYear(),
            quarter: parseInt(quarter) || Math.ceil((new Date().getMonth() + 1) / 3),
            month: parseInt(month) || (new Date().getMonth() + 1)
        };

        const insights = await insightsService.generateInsights(empresaId, period);
        const { dateFrom, dateTo } = insightsService.calculatePeriodDates(period);

        res.json({
            ok: true,
            data: {
                periodo: {
                    type: period.type,
                    year: period.year,
                    quarter: period.quarter,
                    month: period.month,
                    inicio: dateFrom,
                    fin: dateTo
                },
                cards: insights
            }
        });

    } catch (error) {
        console.error('[Copiloto] Error getting insights:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/copiloto/alerts
 * Listar alertas
 */
async function listAlerts(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.query.empresa_id || req.headers['x-empresa-id'];
        const status = req.query.status; // 'NEW', 'SEEN', 'SNOOZED'

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant requerido' });
        }

        let query = `
            SELECT 
                e.*,
                r.name as rule_name,
                r.tipo as rule_tipo
            FROM copilot_alert_event e
            JOIN copilot_alert_rule r ON r.id = e.rule_id
            WHERE r.id_tenant = $1
        `;
        const params = [tenantId];
        let paramCount = 2;

        if (empresaId) {
            query += ` AND (r.id_empresa = $${paramCount} OR r.id_empresa IS NULL)`;
            params.push(empresaId);
            paramCount++;
        }

        if (status) {
            query += ` AND e.status = $${paramCount}`;
            params.push(status);
        }

        query += ' ORDER BY e.created_at DESC LIMIT 50';

        const result = await pool.query(query, params);

        res.json({
            ok: true,
            data: {
                items: result.rows,
                total: result.rows.length
            }
        });

    } catch (error) {
        console.error('[Copiloto] Error listing alerts:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/copiloto/alerts
 * Crear nueva regla de alerta
 */
async function createAlertRule(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const userId = req.user?.id;
        const { id_empresa, name, tipo, params_json, frequency = 'WEEKLY' } = req.body;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant requerido' });
        }

        if (!name || !tipo) {
            return res.status(400).json({ ok: false, error: 'name y tipo requeridos' });
        }

        const result = await pool.query(`
            INSERT INTO copilot_alert_rule (
                id_tenant, id_empresa, name, tipo, params_json, frequency, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [tenantId, id_empresa || null, name, tipo, params_json || {}, frequency, userId]);

        res.status(201).json({
            ok: true,
            data: result.rows[0],
            message: 'Regla de alerta creada'
        });

    } catch (error) {
        console.error('[Copiloto] Error creating alert rule:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/contabilidad/copiloto/alerts/:id
 * Actualizar regla o marcar alerta
 */
async function updateAlert(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const userId = req.user?.id;
        const alertId = req.params.id;
        const { is_enabled, status, snoozed_until } = req.body;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant requerido' });
        }

        // Determinar si es regla o evento
        if (is_enabled !== undefined) {
            // Actualizar regla
            const result = await pool.query(`
                UPDATE copilot_alert_rule
                SET is_enabled = $1, updated_at = now()
                WHERE id = $2 AND id_tenant = $3
                RETURNING *
            `, [is_enabled, alertId, tenantId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ ok: false, error: 'Regla no encontrada' });
            }

            return res.json({ ok: true, data: result.rows[0] });
        }

        // Actualizar evento
        const updates = [];
        const params = [];
        let paramCount = 1;

        if (status) {
            updates.push(`status = $${paramCount}`);
            params.push(status);
            paramCount++;

            if (status === 'SEEN') {
                updates.push(`seen_at = now(), seen_by = $${paramCount}`);
                params.push(userId);
                paramCount++;
            }
        }

        if (snoozed_until) {
            updates.push(`snoozed_until = $${paramCount}, status = 'SNOOZED'`);
            params.push(snoozed_until);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay campos para actualizar' });
        }

        params.push(alertId);

        const result = await pool.query(`
            UPDATE copilot_alert_event
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Alerta no encontrada' });
        }

        res.json({ ok: true, data: result.rows[0] });

    } catch (error) {
        console.error('[Copiloto] Error updating alert:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/copiloto/sessions
 * Listar sesiones de chat
 */
async function listSessions(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.query.empresa_id || req.headers['x-empresa-id'];
        const userId = req.user?.id;

        if (!tenantId || !empresaId) {
            return res.status(400).json({ ok: false, error: 'Tenant y empresa requeridos' });
        }

        const result = await pool.query(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM copilot_chat_message WHERE session_id = s.id) as message_count
            FROM copilot_chat_session s
            WHERE s.id_tenant = $1 
              AND s.id_empresa = $2
              AND s.created_by = $3
            ORDER BY s.updated_at DESC
            LIMIT 20
        `, [tenantId, empresaId, userId]);

        res.json({
            ok: true,
            data: {
                items: result.rows,
                total: result.rows.length
            }
        });

    } catch (error) {
        console.error('[Copiloto] Error listing sessions:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/copiloto/sessions/:id/messages
 * Obtener mensajes de una sesión
 */
async function getSessionMessages(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const sessionId = req.params.id;
        const userId = req.user?.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant requerido' });
        }

        // Verificar sesión pertenece al usuario
        const sessionCheck = await pool.query(
            'SELECT id FROM copilot_chat_session WHERE id = $1 AND id_tenant = $2 AND created_by = $3',
            [sessionId, tenantId, userId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
        }

        const result = await pool.query(`
            SELECT * FROM copilot_chat_message
            WHERE session_id = $1
            ORDER BY created_at
        `, [sessionId]);

        res.json({
            ok: true,
            data: {
                items: result.rows,
                total: result.rows.length
            }
        });

    } catch (error) {
        console.error('[Copiloto] Error getting session messages:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * Generar acciones sugeridas basadas en evidencia
 */
function generateSuggestedActions(evidence) {
    const actions = [];

    // Siempre ofrecer ver documentos filtrados
    if (evidence.items && evidence.items.length > 0) {
        actions.push({
            label: 'Ver facturas filtradas',
            type: 'navigate',
            url: `/src/verticals/finsaas/pages/documentos.html?periodo_inicio=${evidence.periodo.inicio}&periodo_fin=${evidence.periodo.fin}`
        });
    }

    return actions;
}

module.exports = {
    chat,
    getInsights,
    listAlerts,
    createAlertRule,
    updateAlert,
    listSessions,
    getSessionMessages
};
