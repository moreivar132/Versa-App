/**
 * Routing Rules Controller
 * Handles CRUD operations for automatic lead assignment rules.
 */

const repo = require('../../infra/repos/tasks-leads.repo');

async function listRules(req, res) {
    try {
        const rules = await repo.listRoutingRules(req.context);
        return res.json({ ok: true, rules });
    } catch (error) {
        console.error('[RoutingRules] List error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

async function getRule(req, res) {
    try {
        const { id } = req.params;
        const rule = await repo.getRoutingRuleById(req.context, id);
        if (!rule) return res.status(404).json({ ok: false, error: 'Rule not found' });
        return res.json({ ok: true, rule });
    } catch (error) {
        console.error('[RoutingRules] Get error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

async function createRule(req, res) {
    try {
        const data = req.body;
        if (!data.tag || !data.user_id) {
            return res.status(400).json({ ok: false, error: 'Tag and User ID are required' });
        }
        const rule = await repo.createRoutingRule(req.context, data);
        return res.status(201).json({ ok: true, rule });
    } catch (error) {
        console.error('[RoutingRules] Create error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

async function updateRule(req, res) {
    try {
        const { id } = req.params;
        const data = req.body;
        const rule = await repo.updateRoutingRule(req.context, id, data);
        return res.json({ ok: true, rule });
    } catch (error) {
        console.error('[RoutingRules] Update error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

async function deleteRule(req, res) {
    try {
        const { id } = req.params;
        await repo.deleteRoutingRule(req.context, id);
        return res.json({ ok: true });
    } catch (error) {
        console.error('[RoutingRules] Delete error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    listRules,
    getRule,
    createRule,
    updateRule,
    deleteRule
};
