// ============================================================
// BryanOS 1.0 — API Routes (Supabase-powered)
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireWorkspace, requireRole } = require('../middleware/auth');
const DatabaseService = require('../services/database');
const AIAgent = require('../services/aiAgent');
const NotificationService = require('../services/notifications');

const aiAgent = new AIAgent();

// All API routes require auth + workspace
router.use(requireAuth);
router.use(requireWorkspace);

// Helper: create DB service from request context
function getDB(req) {
  return new DatabaseService(req.supabase, req.workspaceId);
}

// ============================================================
// TASKS
// ============================================================

// Get all tasks (with filters + pagination)
router.get('/tasks', async (req, res) => {
  try {
    const db = getDB(req);
    const { status, priority, client_id, assigned_to, search, page, limit } = req.query;

    const result = await db.getTasks({
      status,
      priority,
      clientId: client_id,
      assignedTo: assigned_to,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single task
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const db = getDB(req);
    const task = await db.getTaskById(req.params.taskId);
    res.json({ success: true, task });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Create tasks (single or batch)
router.post('/tasks', async (req, res) => {
  try {
    const db = getDB(req);
    const { tasks: taskList, task: singleTask } = req.body;

    if (taskList && Array.isArray(taskList)) {
      // Batch create
      const tasks = await db.createTasksBatch(taskList, req.user.id);
      res.json({ success: true, tasks, count: tasks.length });
    } else if (singleTask || req.body.title) {
      // Single create
      const taskData = singleTask || req.body;
      taskData.createdBy = req.user.id;

      // Auto-assign if no assignee specified
      if (!taskData.assignedTo) {
        taskData.assignedTo = await db.suggestAssignee(taskData.clientId, taskData.systemId);
      }

      const task = await db.createTask(taskData);
      res.json({ success: true, task });
    } else {
      return res.status(400).json({ error: 'Missing task data' });
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const db = getDB(req);
    const task = await db.updateTask(req.params.taskId, req.body);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/tasks/:taskId', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const db = getDB(req);
    await db.deleteTask(req.params.taskId);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete
router.post('/tasks/bulk-delete', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const db = getDB(req);
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Missing taskIds array' });
    }

    const result = await db.deleteTasksBatch(taskIds);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TASK COMMENTS
// ============================================================

router.post('/tasks/:taskId/comments', async (req, res) => {
  try {
    const db = getDB(req);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await db.addComment(req.params.taskId, req.user.id, content.trim());
    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TRANSCRIPT PROCESSING
// ============================================================

router.post('/process-transcript', async (req, res) => {
  try {
    const db = getDB(req);
    const { transcript, clientId } = req.body;

    if (!transcript || !clientId) {
      return res.status(400).json({ error: 'Missing transcript or clientId' });
    }

    // Get client name for AI prompt
    const clients = await db.getClients();
    const client = clients.find(c => c.id === clientId);
    const clientName = client ? client.name : 'Unknown Client';

    // Process with AI
    const { formatted, provider } = await aiAgent.processTranscript(transcript, clientName);
    const parsedTasks = aiAgent.parseTaskDocument(formatted);

    // Save transcript record
    await db.saveTranscript({
      clientId,
      rawTranscript: transcript,
      formattedOutput: formatted,
      aiProvider: provider,
      tasksExtracted: parsedTasks.length,
      processedBy: req.user.id,
    });

    // Track usage
    const { supabaseAdmin } = require('../services/supabase');
    await supabaseAdmin.rpc('increment_usage', {
      ws_id: req.workspaceId,
      field: 'transcripts_processed',
    });

    res.json({
      success: true,
      formatted,
      tasks: parsedTasks,
      provider,
    });
  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CONFIG (clients, team, systems)
// ============================================================

router.get('/config/clients', async (req, res) => {
  try {
    const db = getDB(req);
    const clients = await db.getClients();
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/config/clients', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const db = getDB(req);
    const client = await db.createClient(req.body);
    res.json({ success: true, client });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/config/team-members', async (req, res) => {
  try {
    const db = getDB(req);
    const teamMembers = await db.getTeamMembers();
    res.json({ success: true, teamMembers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/config/systems', async (req, res) => {
  try {
    const db = getDB(req);
    const systems = await db.getSystems();
    res.json({ success: true, systems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ASSIGNMENT
// ============================================================

router.post('/assign/suggest', async (req, res) => {
  try {
    const db = getDB(req);
    const { clientId, systemId } = req.body;
    const assigneeId = await db.suggestAssignee(clientId, systemId);
    res.json({ success: true, assigneeId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ANALYTICS & STATS
// ============================================================

router.get('/stats', async (req, res) => {
  try {
    const db = getDB(req);
    const stats = await db.getWorkspaceStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/velocity', async (req, res) => {
  try {
    const db = getDB(req);
    const days = parseInt(req.query.days) || 30;
    const velocity = await db.getTeamVelocity(days);
    res.json({ success: true, velocity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const db = getDB(req);
    const limit = parseInt(req.query.limit) || 50;
    const activity = await db.getRecentActivity(limit);
    res.json({ success: true, activity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// REFERRAL MESSAGES
// ============================================================

router.post('/generate-referral-messages', async (req, res) => {
  try {
    const { contacts, pitch, offer, senderName } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Missing contacts array' });
    }

    if (!pitch || typeof pitch !== 'string' || pitch.trim().length === 0) {
      return res.status(400).json({ error: 'Missing pitch description' });
    }

    const result = await aiAgent.generateReferralMessages(
      contacts,
      pitch.trim(),
      (offer || '').trim(),
      (senderName || 'Bryan').trim()
    );

    // Track usage
    const { supabaseAdmin } = require('../services/supabase');
    await supabaseAdmin.rpc('increment_usage', {
      ws_id: req.workspaceId,
      field: 'referral_messages_generated',
    });

    res.json({ success: true, messages: result.messages, provider: result.provider });
  } catch (error) {
    console.error('Error generating referral messages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
