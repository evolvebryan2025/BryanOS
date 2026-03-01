const express = require('express');
const path = require('path');
require('dotenv').config();

const GoogleSheetsService = require('./services/googleSheets');
const AIAgent = require('./services/aiAgent');
const AssignmentRulesService = require('./services/assignmentRules');
const NotificationService = require('./services/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Services
const sheets = new GoogleSheetsService();
const aiAgent = new AIAgent();
const assignmentRules = new AssignmentRulesService();
const notifications = new NotificationService();

// Process transcript with AI
app.post('/api/process-transcript', async (req, res) => {
  try {
    const { transcript, client } = req.body;

    if (!transcript || !client) {
      return res.status(400).json({
        error: 'Missing required fields: transcript, client'
      });
    }

    console.log(`Processing transcript for client: ${client}`);

    // Process with AI
    const { formatted, provider } = await aiAgent.processTranscript(transcript, client);

    // Parse tasks
    const parsedTasks = aiAgent.parseTaskDocument(formatted);

    // Add client to each task
    const tasks = parsedTasks.map(task => ({
      ...task,
      client,
    }));

    res.json({
      success: true,
      formatted,
      tasks,
      provider,
    });
  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({
      error: error.message || 'Failed to process transcript'
    });
  }
});

// Create tasks in Google Sheets
app.post('/api/tasks/create', async (req, res) => {
  try {
    const { tasks, createdBy = 'Bryan' } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Missing tasks array' });
    }

    // Get next task ID
    const existingTasks = await sheets.readSheet('Build Queue');
    const nextId = existingTasks.length; // Header is row 1, so length = next ID

    const rows = [];
    const createdTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // Suggest assignee
      const suggestedAssignee = await assignmentRules.suggestAssignee(task);
      const assignee = task.assignee || suggestedAssignee;

      const taskId = nextId + i;
      const dateAdded = new Date().toISOString().split('T')[0];

      const row = [
        taskId,
        task.title,
        task.priority || 'Medium',
        task.client,
        task.system || 'Other',
        'Not Started',
        assignee,
        dateAdded,
        '', // dateCompleted
        task.notes || '',
        task.timestamp || '',
        createdBy,
      ];

      rows.push(row);

      createdTasks.push({
        id: taskId,
        task: task.title,
        priority: task.priority || 'Medium',
        client: task.client,
        system: task.system || 'Other',
        status: 'Not Started',
        assignedTo: assignee,
        dateAdded,
        notes: task.notes || '',
        timestamp: task.timestamp || '',
        createdBy,
      });
    }

    // Append to sheet
    await sheets.appendRows('Build Queue', rows);

    // Send notifications
    for (const task of createdTasks) {
      await notifications.notifyTaskCreated(task);
    }

    res.json({
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error('Error creating tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks with optional filters
app.get('/api/tasks', async (req, res) => {
  try {
    const { client, status, assignee, priority } = req.query;

    const rows = await sheets.readSheet('Build Queue');

    // Skip header row
    let tasks = rows.slice(1).map(row => ({
      id: row[0],
      task: row[1],
      priority: row[2],
      client: row[3],
      system: row[4],
      status: row[5],
      assignedTo: row[6],
      dateAdded: row[7],
      dateCompleted: row[8],
      notes: row[9],
      timestamp: row[10],
      createdBy: row[11],
    }));

    // Apply filters
    if (client) tasks = tasks.filter(t => t.client === client);
    if (status) tasks = tasks.filter(t => t.status === status);
    if (assignee) tasks = tasks.filter(t => t.assignedTo === assignee);
    if (priority) tasks = tasks.filter(t => t.priority === priority);

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.patch('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, assignedTo, notes, updatedBy = 'Bryan' } = req.body;

    // Get current task
    const task = await sheets.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Find row index (taskId + 2 because header is row 1, IDs start at 1)
    const rowIndex = parseInt(taskId) + 2;

    // Build updated row
    const updatedTask = {
      ...task,
      status: status || task.status,
      assignedTo: assignedTo || task.assignedTo,
      notes: notes || task.notes,
      dateCompleted: status === 'Done' ? new Date().toISOString().split('T')[0] : task.dateCompleted,
    };

    const row = [
      updatedTask.id,
      updatedTask.task,
      updatedTask.priority,
      updatedTask.client,
      updatedTask.system,
      updatedTask.status,
      updatedTask.assignedTo,
      updatedTask.dateAdded,
      updatedTask.dateCompleted,
      updatedTask.notes,
      updatedTask.timestamp,
      updatedTask.createdBy,
    ];

    // Update sheet
    await sheets.updateRow('Build Queue', rowIndex, row);

    // Send notification
    if (status === 'Done') {
      await notifications.notifyTaskCompleted(updatedTask);
    } else {
      await notifications.notifyTaskUpdated(updatedTask, updatedBy);
    }

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team members
app.get('/api/config/team-members', async (req, res) => {
  try {
    const teamMembers = await assignmentRules.getTeamMembers();
    res.json({ success: true, teamMembers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get clients
app.get('/api/config/clients', async (req, res) => {
  try {
    const clients = await assignmentRules.getClients();
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suggest assignee
app.post('/api/assign/suggest', async (req, res) => {
  try {
    const { task } = req.body;
    const suggested = await assignmentRules.suggestAssignee(task);
    res.json({ success: true, suggestedAssignee: suggested });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Build Queue server running on http://localhost:${PORT}`);
});
