/**
 * Tasks & Leads Routes
 * 
 * API routes for the Tasks & Leads vertical.
 * All routes require vertical access and appropriate permissions.
 */

const express = require('express');
const router = express.Router();

// Controllers
const projectsCtrl = require('../controllers/projects.controller');
const tasksCtrl = require('../controllers/tasks.controller');
const leadsCtrl = require('../controllers/leads.controller');
const webhooksCtrl = require('../controllers/webhooks.controller');

// Middleware
const { requireVerticalAccess } = require('../../../../core/security/requireVerticalAccess');
const { requirePermission } = require('../../../../../middleware/rbac');

// =========================================================
// Public Webhooks (Validated via Token in Query)
// =========================================================
router.post('/webhooks/timelinesai', require('express').json({ limit: "200kb" }), webhooksCtrl.timelinesWebhook);

// =========================================================
// Vertical Access Gate - All routes require tasks_leads access
// =========================================================
router.use(requireVerticalAccess('tasks_leads'));

// =========================================================
// Dashboard
// =========================================================
router.get('/dashboard', requirePermission('tasksleads.projects.view'), leadsCtrl.dashboard);

// =========================================================
// Projects Routes
// =========================================================
router.get('/projects', requirePermission('tasksleads.projects.view'), projectsCtrl.list);
router.get('/projects/:id', requirePermission('tasksleads.projects.view'), projectsCtrl.getById);
router.post('/projects', requirePermission('tasksleads.projects.create'), projectsCtrl.create);
router.patch('/projects/:id', requirePermission('tasksleads.projects.edit'), projectsCtrl.update);
router.delete('/projects/:id', requirePermission('tasksleads.projects.delete'), projectsCtrl.remove);

// =========================================================
// Tasks Routes
// =========================================================
router.get('/tasks', requirePermission('tasksleads.tasks.view'), tasksCtrl.list);
router.get('/tasks/:id', requirePermission('tasksleads.tasks.view'), tasksCtrl.getById);
router.post('/tasks', requirePermission('tasksleads.tasks.create'), tasksCtrl.create);
router.patch('/tasks/:id', requirePermission('tasksleads.tasks.edit'), tasksCtrl.update);
router.delete('/tasks/:id', requirePermission('tasksleads.tasks.delete'), tasksCtrl.remove);

// =========================================================
// Leads Routes
// =========================================================
router.get('/leads', requirePermission('tasksleads.leads.view'), leadsCtrl.list);
router.get('/leads/:id', requirePermission('tasksleads.leads.view'), leadsCtrl.getById);
router.post('/leads', requirePermission('tasksleads.leads.create'), leadsCtrl.create);
router.patch('/leads/:id', requirePermission('tasksleads.leads.edit'), leadsCtrl.update);
router.post('/leads/:id/close', requirePermission('tasksleads.leads.close'), leadsCtrl.close);
router.delete('/leads/:id', requirePermission('tasksleads.leads.close'), leadsCtrl.remove);

// =========================================================
// Timeline Integration Routes
// =========================================================
router.get('/leads/:id/timeline', requirePermission('tasksleads.timeline.view'), leadsCtrl.getTimeline);
router.post('/leads/:id/link-chat', requirePermission('tasksleads.timeline.sync'), leadsCtrl.linkChat);

// =========================================================
// Timeline Sync Routes (Import leads from TimelinesAI)
// =========================================================
router.get('/timeline/pending', requirePermission('tasksleads.timeline.view'), leadsCtrl.getPendingChats);
router.post('/timeline/sync', requirePermission('tasksleads.timeline.sync'), leadsCtrl.syncFromTimeline);

// Timeline Full History Routes
router.get('/timeline/chats', requirePermission('tasksleads.timeline.view'), leadsCtrl.getAllChats);
router.get('/timeline/chats/:id/messages', requirePermission('tasksleads.timeline.view'), leadsCtrl.getChatMessages);

module.exports = router;
