# Prince Build Queue System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered task management system that processes meeting transcripts, auto-creates tasks in Google Sheets, suggests assignees, and sends Telegram notifications.

**Architecture:** Express.js backend with Google Sheets API integration, dual AI agent (Claude/OpenAI), plain HTML/CSS/JS frontend, n8n webhook for notifications. Config-driven assignment rules stored in Google Sheets for future-proofing.

**Tech Stack:** Node.js, Express, Google Sheets API, Claude API, OpenAI API, n8n, Telegram Bot API, Plain HTML/CSS/JavaScript

**Timeline:** 50-60 minutes total

---

## Prerequisites

Before starting, ensure you have:
- Google Cloud project with Sheets API enabled
- Service account JSON credentials downloaded
- Google Sheet created with 5 tabs (Build Queue, Team Members, Clients, Assignment Rules, Systems)
- n8n workflow imported and activated
- API keys for Claude and OpenAI

---

## Task 1: Project Setup & Dependencies

**Files:**
- Modify: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\package.json`
- Modify: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\.env`
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\.gitignore`

**Step 1: Install required npm packages**

```bash
cd "c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app"
npm install googleapis @anthropic-ai/sdk openai axios dotenv
```

Expected: Packages installed successfully

**Step 2: Update .env file with all credentials**

Add to `.env`:
```env
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Google Sheets (PLACEHOLDER - update after service account setup)
GOOGLE_SHEET_ID=YOUR_SHEET_ID_HERE
GOOGLE_SERVICE_ACCOUNT_EMAIL=YOUR_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE

# n8n
N8N_WEBHOOK_URL=https://madeeas.app.n8n.cloud/webhook/bryanOS

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Server
PORT=3000
NODE_ENV=development
```

**Step 3: Update .gitignore**

Add to `.gitignore`:
```
node_modules/
.env
google-credentials.json
*.log
```

**Step 4: Commit setup**

```bash
git add package.json .gitignore
git commit -m "feat: add dependencies for build queue system"
```

---

## Task 2: Google Sheets Service Setup

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\services\googleSheets.js`

**Step 1: Create Google Sheets service module**

Create `services/googleSheets.js`:
```javascript
const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
  }

  async readSheet(sheetName, range = 'A:Z') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error reading ${sheetName}:`, error.message);
      throw new Error(`Failed to read ${sheetName}`);
    }
  }

  async appendRows(sheetName, rows) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error appending to ${sheetName}:`, error.message);
      throw new Error(`Failed to append to ${sheetName}`);
    }
  }

  async updateRow(sheetName, rowIndex, values) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating row ${rowIndex}:`, error.message);
      throw new Error(`Failed to update row ${rowIndex}`);
    }
  }

  async getTaskById(taskId) {
    const rows = await this.readSheet('Build Queue');
    const taskRow = rows.find(row => row[0] === String(taskId));
    if (!taskRow) return null;

    return {
      id: taskRow[0],
      task: taskRow[1],
      priority: taskRow[2],
      client: taskRow[3],
      system: taskRow[4],
      status: taskRow[5],
      assignedTo: taskRow[6],
      dateAdded: taskRow[7],
      dateCompleted: taskRow[8],
      notes: taskRow[9],
      timestamp: taskRow[10],
      createdBy: taskRow[11],
    };
  }
}

module.exports = GoogleSheetsService;
```

**Step 2: Test connection (manual verification)**

Create test file `test-sheets.js` (temporary):
```javascript
const GoogleSheetsService = require('./services/googleSheets');

async function test() {
  const sheets = new GoogleSheetsService();
  const data = await sheets.readSheet('Build Queue');
  console.log('Connected! Rows:', data.length);
}

test().catch(console.error);
```

Run: `node test-sheets.js`
Expected: "Connected! Rows: X"

**Step 3: Commit**

```bash
git add services/googleSheets.js
git commit -m "feat: add Google Sheets service integration"
```

---

## Task 3: AI Agent Service (Claude + OpenAI)

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\services\aiAgent.js`

**Step 1: Create AI agent service with dual fallback**

Create `services/aiAgent.js`:
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
require('dotenv').config();

class AIAgent {
  constructor() {
    this.claude = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  buildPrompt(transcript, client) {
    return `You are Bryan's meeting task extractor. Analyze this meeting transcript and generate a formatted task document.

CLIENT: ${client}
TRANSCRIPT:
${transcript}

OUTPUT FORMAT (follow this EXACTLY):
📄 Bryan Task Document
Bryan x ${client} – ${new Date().toLocaleDateString()}

🚨 PRIORITY #1 — [CATEGORY NAME]
1️⃣ [Task Title] ([ASSIGNEE])
⏱ [timestamp if available]
🗣 Word-for-Word:
[relevant quotes if available]

📌 What You Must Deliver:
- [checklist item 1]
- [checklist item 2]

🔴 Priority Level: [Critical/High/Medium/Low]

[Repeat for all tasks, grouped by priority]

🔴 FINAL PRIORITY ORDER
DO FIRST (URGENT / CRITICAL)
- [task]
DO NEXT (HIGH PRIORITY)
- [task]
DO LATER (MEDIUM/LOW)
- [task]

ASSIGNMENT RULES:
- Prince tasks → Vee (or JOHN if after 9pm)
- Kyle tasks → Lee
- Juan tasks → Adam
- GHL tasks → Adam
- n8n tasks → Vee
- Web App tasks → Jameel
- New client builds → Jameel
- Internal tools → Lee

Extract all action items from the transcript, assign based on rules above, include timestamps and quotes where available in the transcript. Be thorough.`;
  }

  async processWithClaude(transcript, client) {
    const message = await this.claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: this.buildPrompt(transcript, client),
      }],
    });

    return message.content[0].text;
  }

  async processWithOpenAI(transcript, client) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: this.buildPrompt(transcript, client),
      }],
    });

    return completion.choices[0].message.content;
  }

  async processTranscript(transcript, client) {
    try {
      console.log('Trying Claude API...');
      const result = await this.processWithClaude(transcript, client);
      console.log('Claude API succeeded');
      return { formatted: result, provider: 'claude' };
    } catch (claudeError) {
      console.log('Claude API failed, falling back to OpenAI:', claudeError.message);

      try {
        const result = await this.processWithOpenAI(transcript, client);
        console.log('OpenAI API succeeded');
        return { formatted: result, provider: 'openai' };
      } catch (openaiError) {
        console.error('Both AI providers failed:', openaiError.message);
        throw new Error('AI processing failed: Both Claude and OpenAI APIs are unavailable');
      }
    }
  }

  parseTaskDocument(formatted) {
    const tasks = [];

    // Extract tasks using regex
    const taskRegex = /(\d️⃣)\s+(.+?)\s+\(([A-Za-z]+)\)/g;
    let match;

    while ((match = taskRegex.exec(formatted)) !== null) {
      const taskTitle = match[2].trim();
      const assignee = match[3].trim();

      // Find priority for this task
      const taskIndex = match.index;
      const beforeTask = formatted.substring(0, taskIndex);
      const lastPriorityMarker = beforeTask.lastIndexOf('Priority Level:');

      let priority = 'Medium';
      if (lastPriorityMarker !== -1) {
        const priorityLine = formatted.substring(lastPriorityMarker, lastPriorityMarker + 50);
        if (priorityLine.includes('Critical')) priority = 'Critical';
        else if (priorityLine.includes('High')) priority = 'High';
        else if (priorityLine.includes('Low')) priority = 'Low';
      }

      // Try to extract timestamp
      const timestampRegex = /⏱\s+([^\n]+)/;
      const timestampMatch = formatted.substring(match.index, match.index + 200).match(timestampRegex);
      const timestamp = timestampMatch ? timestampMatch[1].trim() : '';

      // Try to extract notes (What You Must Deliver section)
      const deliverStart = formatted.indexOf('📌 What You Must Deliver:', match.index);
      const deliverEnd = formatted.indexOf('🔴 Priority Level:', deliverStart);
      let notes = '';

      if (deliverStart !== -1 && deliverEnd !== -1) {
        notes = formatted.substring(deliverStart, deliverEnd).trim();
      }

      // Infer system type from task title
      let system = 'Other';
      if (taskTitle.toLowerCase().includes('ghl')) system = 'GHL';
      else if (taskTitle.toLowerCase().includes('n8n')) system = 'n8n';
      else if (taskTitle.toLowerCase().includes('web') || taskTitle.toLowerCase().includes('app')) system = 'Web App';
      else if (taskTitle.toLowerCase().includes('voice')) system = 'Voice Agent';
      else if (taskTitle.toLowerCase().includes('email')) system = 'Cold Email';

      tasks.push({
        title: taskTitle,
        assignee,
        priority,
        system,
        timestamp,
        notes,
      });
    }

    return tasks;
  }
}

module.exports = AIAgent;
```

**Step 2: Test AI agent (manual verification)**

Create test file `test-ai.js` (temporary):
```javascript
const AIAgent = require('./services/aiAgent');

const sampleTranscript = `Kyle mentioned that the GHL reminder email has a bug where it shows "brackets, first name" instead of the actual name. He wants this fixed ASAP. Also, his mom got the wrong automation email for an event when she should have gotten a purchase confirmation. This needs to be investigated and stopped.`;

async function test() {
  const agent = new AIAgent();
  const result = await agent.processTranscript(sampleTranscript, 'Kyle');
  console.log('Formatted output:\n', result.formatted);

  const tasks = agent.parseTaskDocument(result.formatted);
  console.log('\nParsed tasks:', tasks);
}

test().catch(console.error);
```

Run: `node test-ai.js`
Expected: Formatted document + parsed tasks array

**Step 3: Commit**

```bash
git add services/aiAgent.js
git commit -m "feat: add AI agent with Claude/OpenAI fallback"
```

---

## Task 4: Assignment Rules Service

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\services\assignmentRules.js`

**Step 1: Create assignment rules service**

Create `services/assignmentRules.js`:
```javascript
const GoogleSheetsService = require('./googleSheets');

class AssignmentRulesService {
  constructor() {
    this.sheets = new GoogleSheetsService();
    this.rulesCache = null;
    this.cacheTime = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  async loadRules() {
    const now = Date.now();

    // Use cache if fresh
    if (this.rulesCache && this.cacheTime && (now - this.cacheTime) < this.cacheDuration) {
      return this.rulesCache;
    }

    // Load from sheets
    const rulesData = await this.sheets.readSheet('Assignment Rules');
    const teamData = await this.sheets.readSheet('Team Members');
    const clientData = await this.sheets.readSheet('Clients');

    // Skip header rows
    const rules = rulesData.slice(1).map(row => ({
      type: row[0],
      condition: row[1],
      assignee: row[2],
      priority: parseInt(row[3]) || 999,
    }));

    const teamMembers = teamData.slice(1).map(row => ({
      name: row[0],
      role: row[1],
      specialties: row[2] || '',
      clients: row[3] || '',
      active: row[4] === 'Yes',
      schedule: row[5] || '',
    }));

    const clients = clientData.slice(1).map(row => ({
      name: row[0],
      primaryAssignee: row[1],
      backupAssignee: row[2] || null,
      active: row[3] === 'Yes',
    }));

    this.rulesCache = { rules, teamMembers, clients };
    this.cacheTime = now;

    return this.rulesCache;
  }

  async suggestAssignee(task) {
    const config = await this.loadRules();
    const hour = new Date().getHours();

    // Sort rules by priority
    const sortedRules = config.rules.sort((a, b) => a.priority - b.priority);

    // Priority 1: Client-based rules
    const clientRule = sortedRules.find(r =>
      r.type === 'Client' && r.condition === task.client
    );
    if (clientRule) {
      // Check time-based override for Prince
      if (task.client === 'Prince' && hour >= 21) {
        const nightRule = sortedRules.find(r =>
          r.type === 'Time' && r.condition.includes('Prince')
        );
        if (nightRule) return nightRule.assignee;
      }
      return clientRule.assignee;
    }

    // Priority 2: System-based rules
    const systemRule = sortedRules.find(r =>
      r.type === 'System' && r.condition === task.system
    );
    if (systemRule) return systemRule.assignee;

    // Priority 3: Default fallback
    const defaultRule = sortedRules.find(r => r.type === 'Default');
    return defaultRule ? defaultRule.assignee : 'Lee';
  }

  async getTeamMembers() {
    const config = await this.loadRules();
    return config.teamMembers.filter(m => m.active);
  }

  async getClients() {
    const config = await this.loadRules();
    return config.clients.filter(c => c.active);
  }
}

module.exports = AssignmentRulesService;
```

**Step 2: Commit**

```bash
git add services/assignmentRules.js
git commit -m "feat: add dynamic assignment rules service"
```

---

## Task 5: Notification Service (n8n Webhook)

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\services\notifications.js`

**Step 1: Create notification service**

Create `services/notifications.js`:
```javascript
const axios = require('axios');
require('dotenv').config();

class NotificationService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
  }

  async sendTaskNotification(event, task, updatedBy = null) {
    try {
      const payload = {
        event,
        task: {
          title: task.task || task.title,
          assignee: task.assignedTo || task.assignee,
          priority: task.priority,
          client: task.client,
          system: task.system,
          status: task.status,
          notes: task.notes,
          completedDate: task.dateCompleted,
        },
        updatedBy,
      };

      const response = await axios.post(this.webhookUrl, payload, {
        timeout: 30000, // 30 second timeout
      });

      console.log(`Notification sent (${event}):`, response.data);
      return response.data;
    } catch (error) {
      console.error('Notification failed:', error.message);
      // Don't throw - notifications are not critical
      return { success: false, error: error.message };
    }
  }

  async notifyTaskCreated(task) {
    return this.sendTaskNotification('task_created', task);
  }

  async notifyTaskUpdated(task, updatedBy) {
    return this.sendTaskNotification('task_updated', task, updatedBy);
  }

  async notifyTaskCompleted(task) {
    return this.sendTaskNotification('task_completed', task);
  }
}

module.exports = NotificationService;
```

**Step 2: Commit**

```bash
git add services/notifications.js
git commit -m "feat: add n8n notification service"
```

---

## Task 6: Express API Routes

**Files:**
- Modify: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\server.js`

**Step 1: Import services and add middleware**

Add to top of `server.js`:
```javascript
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
```

**Step 2: Add POST /api/process-transcript endpoint**

Add to `server.js`:
```javascript
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
```

**Step 3: Add POST /api/tasks/create endpoint**

Add to `server.js`:
```javascript
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
```

**Step 4: Add GET /api/tasks endpoint**

Add to `server.js`:
```javascript
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
```

**Step 5: Add PATCH /api/tasks/:taskId endpoint**

Add to `server.js`:
```javascript
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
```

**Step 6: Add config endpoints**

Add to `server.js`:
```javascript
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
```

**Step 7: Add server start**

Add to end of `server.js`:
```javascript
app.listen(PORT, () => {
  console.log(`Build Queue server running on http://localhost:${PORT}`);
});
```

**Step 8: Test server**

Run: `node server.js`
Expected: "Build Queue server running on http://localhost:3000"

**Step 9: Commit**

```bash
git add server.js
git commit -m "feat: add Express API routes for build queue"
```

---

## Task 7: Frontend HTML Structure

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\public\build-queue.html`
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\public\css\build-queue.css`
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\public\js\build-queue.js`

**Step 1: Create HTML structure**

Create `public/build-queue.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prince Build Queue</title>
  <link rel="stylesheet" href="/css/build-queue.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🏗️ Prince Build Queue</h1>
      <div class="header-actions">
        <button id="refresh-btn" class="btn btn-secondary">🔄 Refresh</button>
        <button id="add-manual-btn" class="btn btn-secondary">➕ Add Manual Task</button>
      </div>
    </header>

    <!-- Process Transcript Section -->
    <section class="process-section">
      <h2>📝 Process Meeting Transcript</h2>
      <div class="form-group">
        <label for="client-select">Client:</label>
        <select id="client-select" class="form-control">
          <option value="">Select client...</option>
        </select>
      </div>
      <div class="form-group">
        <label for="transcript-input">Meeting Transcript:</label>
        <textarea
          id="transcript-input"
          class="form-control"
          rows="8"
          placeholder="Paste raw meeting transcript here..."
        ></textarea>
      </div>
      <button id="process-btn" class="btn btn-primary">🤖 Process with AI</button>

      <div id="ai-output" class="ai-output hidden">
        <h3>AI Generated Task Document:</h3>
        <pre id="formatted-output"></pre>

        <h3>Parsed Tasks:</h3>
        <div id="parsed-tasks-table"></div>

        <div class="action-buttons">
          <button id="confirm-tasks-btn" class="btn btn-success">✅ Confirm & Create Tasks</button>
          <button id="retry-btn" class="btn btn-secondary">🔄 Edit & Retry</button>
        </div>
      </div>

      <div id="processing-spinner" class="spinner hidden">
        <div class="spinner-icon">⏳</div>
        <p>Processing transcript with AI...</p>
      </div>
    </section>

    <!-- Filters Section -->
    <section class="filters-section">
      <h2>🔍 Filters</h2>
      <div class="filters">
        <select id="filter-client" class="filter-control">
          <option value="">All Clients</option>
        </select>
        <select id="filter-status" class="filter-control">
          <option value="">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
          <option value="QA">QA</option>
          <option value="Blocked">Blocked</option>
        </select>
        <select id="filter-assignee" class="filter-control">
          <option value="">All Assignees</option>
        </select>
        <select id="filter-priority" class="filter-control">
          <option value="">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </section>

    <!-- Tasks Table -->
    <section class="tasks-section">
      <h2>📋 Tasks</h2>
      <div id="tasks-table-container">
        <table id="tasks-table" class="tasks-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Task</th>
              <th>Priority</th>
              <th>Client</th>
              <th>System</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tasks-tbody">
            <!-- Tasks populated by JS -->
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- Task Details Modal -->
  <div id="task-modal" class="modal hidden">
    <div class="modal-content">
      <span class="modal-close">&times;</span>
      <h2 id="modal-task-title"></h2>
      <div id="modal-task-details"></div>
      <div class="modal-actions">
        <div class="form-group">
          <label>Status:</label>
          <select id="modal-status" class="form-control">
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
            <option value="QA">QA</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reassign to:</label>
          <select id="modal-assignee" class="form-control">
            <!-- Populated by JS -->
          </select>
        </div>
        <div class="form-group">
          <label>Add Notes:</label>
          <textarea id="modal-notes" class="form-control" rows="3"></textarea>
        </div>
        <button id="modal-save-btn" class="btn btn-primary">💾 Save Changes</button>
      </div>
    </div>
  </div>

  <script src="/js/build-queue.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/build-queue.html
git commit -m "feat: add build queue HTML structure"
```

---

## Task 8: Frontend CSS Styling

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\public\css\build-queue.css`

**Step 1: Create CSS file**

Create `public/css/build-queue.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

header h1 {
  font-size: 28px;
  color: #2c3e50;
}

.header-actions {
  display: flex;
  gap: 10px;
}

section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h2 {
  font-size: 20px;
  margin-bottom: 15px;
  color: #2c3e50;
}

h3 {
  font-size: 16px;
  margin: 15px 0 10px;
  color: #34495e;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #555;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: #3498db;
}

textarea.form-control {
  resize: vertical;
  font-family: monospace;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover {
  background: #229954;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.ai-output {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.ai-output pre {
  background: white;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  max-height: 400px;
  overflow-y: auto;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.spinner {
  text-align: center;
  padding: 40px;
}

.spinner-icon {
  font-size: 48px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hidden {
  display: none !important;
}

.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-control {
  flex: 1;
  min-width: 150px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.tasks-table th {
  background: #34495e;
  color: white;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}

.tasks-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #ddd;
  font-size: 13px;
}

.tasks-table tbody tr {
  cursor: pointer;
  transition: background 0.2s;
}

.tasks-table tbody tr:hover {
  background: #f8f9fa;
}

.priority-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.priority-critical {
  background: #e74c3c;
  color: white;
}

.priority-high {
  background: #e67e22;
  color: white;
}

.priority-medium {
  background: #f39c12;
  color: white;
}

.priority-low {
  background: #27ae60;
  color: white;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.status-not-started {
  background: #ecf0f1;
  color: #7f8c8d;
}

.status-in-progress {
  background: #3498db;
  color: white;
}

.status-done {
  background: #27ae60;
  color: white;
}

.status-qa {
  background: #9b59b6;
  color: white;
}

.status-blocked {
  background: #e74c3c;
  color: white;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 20px;
  font-size: 28px;
  cursor: pointer;
  color: #999;
}

.modal-close:hover {
  color: #333;
}

#modal-task-details {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.modal-actions {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }

  .filter-control {
    width: 100%;
  }

  .tasks-table {
    font-size: 12px;
  }

  .tasks-table th,
  .tasks-table td {
    padding: 8px 4px;
  }
}
```

**Step 2: Commit**

```bash
git add public/css/build-queue.css
git commit -m "feat: add build queue CSS styling"
```

---

## Task 9: Frontend JavaScript Logic

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\public\js\build-queue.js`

**Step 1: Create JavaScript file** (Part 1 - Setup & API calls)

Create `public/js/build-queue.js`:
```javascript
// Global state
let allTasks = [];
let clients = [];
let teamMembers = [];
let currentParsedTasks = null;

// DOM elements
const clientSelect = document.getElementById('client-select');
const transcriptInput = document.getElementById('transcript-input');
const processBtn = document.getElementById('process-btn');
const aiOutput = document.getElementById('ai-output');
const formattedOutput = document.getElementById('formatted-output');
const parsedTasksTable = document.getElementById('parsed-tasks-table');
const confirmTasksBtn = document.getElementById('confirm-tasks-btn');
const retryBtn = document.getElementById('retry-btn');
const processingSpinner = document.getElementById('processing-spinner');
const tasksTableBody = document.getElementById('tasks-tbody');
const refreshBtn = document.getElementById('refresh-btn');
const taskModal = document.getElementById('task-modal');
const modalClose = document.querySelector('.modal-close');

// Filter elements
const filterClient = document.getElementById('filter-client');
const filterStatus = document.getElementById('filter-status');
const filterAssignee = document.getElementById('filter-assignee');
const filterPriority = document.getElementById('filter-priority');

// API functions
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

async function loadClients() {
  const data = await apiCall('/api/config/clients');
  clients = data.clients;

  // Populate client dropdowns
  clientSelect.innerHTML = '<option value="">Select client...</option>';
  filterClient.innerHTML = '<option value="">All Clients</option>';

  clients.forEach(client => {
    const option1 = document.createElement('option');
    option1.value = client.name;
    option1.textContent = client.name;
    clientSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = client.name;
    option2.textContent = client.name;
    filterClient.appendChild(option2);
  });
}

async function loadTeamMembers() {
  const data = await apiCall('/api/config/team-members');
  teamMembers = data.teamMembers;

  // Populate assignee filter
  filterAssignee.innerHTML = '<option value="">All Assignees</option>';

  teamMembers.forEach(member => {
    const option = document.createElement('option');
    option.value = member.name;
    option.textContent = member.name;
    filterAssignee.appendChild(option);
  });
}

async function loadTasks() {
  const params = new URLSearchParams();

  if (filterClient.value) params.append('client', filterClient.value);
  if (filterStatus.value) params.append('status', filterStatus.value);
  if (filterAssignee.value) params.append('assignee', filterAssignee.value);
  if (filterPriority.value) params.append('priority', filterPriority.value);

  const data = await apiCall(`/api/tasks?${params.toString()}`);
  allTasks = data.tasks;
  renderTasks();
}

async function processTranscript() {
  const transcript = transcriptInput.value.trim();
  const client = clientSelect.value;

  if (!transcript) {
    alert('Please paste a meeting transcript');
    return;
  }

  if (!client) {
    alert('Please select a client');
    return;
  }

  try {
    processingSpinner.classList.remove('hidden');
    aiOutput.classList.add('hidden');

    const data = await apiCall('/api/process-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript, client }),
    });

    currentParsedTasks = data.tasks;
    formattedOutput.textContent = data.formatted;
    renderParsedTasks(data.tasks);

    processingSpinner.classList.add('hidden');
    aiOutput.classList.remove('hidden');
  } catch (error) {
    processingSpinner.classList.add('hidden');
    alert('Error processing transcript: ' + error.message);
  }
}

async function createTasks() {
  if (!currentParsedTasks || currentParsedTasks.length === 0) {
    alert('No tasks to create');
    return;
  }

  try {
    confirmTasksBtn.disabled = true;
    confirmTasksBtn.textContent = 'Creating...';

    await apiCall('/api/tasks/create', {
      method: 'POST',
      body: JSON.stringify({
        tasks: currentParsedTasks,
        createdBy: 'Bryan',
      }),
    });

    alert(`Successfully created ${currentParsedTasks.length} tasks!`);

    // Reset form
    transcriptInput.value = '';
    clientSelect.value = '';
    aiOutput.classList.add('hidden');
    currentParsedTasks = null;

    // Reload tasks
    await loadTasks();
  } catch (error) {
    alert('Error creating tasks: ' + error.message);
  } finally {
    confirmTasksBtn.disabled = false;
    confirmTasksBtn.textContent = '✅ Confirm & Create Tasks';
  }
}

async function updateTask(taskId, updates) {
  try {
    await apiCall(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    alert('Task updated successfully!');
    taskModal.classList.add('hidden');
    await loadTasks();
  } catch (error) {
    alert('Error updating task: ' + error.message);
  }
}
```

**Step 2: Add rendering functions** (Part 2)

Add to `public/js/build-queue.js`:
```javascript
// Rendering functions
function renderParsedTasks(tasks) {
  let html = '<table class="tasks-table"><thead><tr>';
  html += '<th>Task</th><th>Priority</th><th>Assignee</th><th>System</th>';
  html += '</tr></thead><tbody>';

  tasks.forEach(task => {
    html += '<tr>';
    html += `<td>${escapeHtml(task.title)}</td>`;
    html += `<td><span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span></td>`;
    html += `<td>${escapeHtml(task.assignee)}</td>`;
    html += `<td>${escapeHtml(task.system)}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  parsedTasksTable.innerHTML = html;
}

function renderTasks() {
  tasksTableBody.innerHTML = '';

  if (allTasks.length === 0) {
    tasksTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No tasks found</td></tr>';
    return;
  }

  allTasks.forEach(task => {
    const row = document.createElement('tr');
    row.dataset.taskId = task.id;

    row.innerHTML = `
      <td>${task.id}</td>
      <td>${escapeHtml(task.task)}</td>
      <td><span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span></td>
      <td>${escapeHtml(task.client)}</td>
      <td>${escapeHtml(task.system)}</td>
      <td><span class="status-badge status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
      <td>${escapeHtml(task.assignedTo)}</td>
      <td>${task.dateAdded}</td>
      <td><button class="btn btn-secondary" onclick="openTaskModal('${task.id}')">Edit</button></td>
    `;

    tasksTableBody.appendChild(row);
  });
}

function openTaskModal(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('modal-task-title').textContent = task.task;

  let detailsHtml = `
    <p><strong>Client:</strong> ${task.client}</p>
    <p><strong>System:</strong> ${task.system}</p>
    <p><strong>Priority:</strong> <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span></p>
    <p><strong>Current Status:</strong> ${task.status}</p>
    <p><strong>Currently Assigned To:</strong> ${task.assignedTo}</p>
    <p><strong>Date Added:</strong> ${task.dateAdded}</p>
  `;

  if (task.timestamp) {
    detailsHtml += `<p><strong>Meeting Timestamp:</strong> ${task.timestamp}</p>`;
  }

  if (task.notes) {
    detailsHtml += `<p><strong>Notes:</strong></p><pre style="white-space: pre-wrap;">${escapeHtml(task.notes)}</pre>`;
  }

  document.getElementById('modal-task-details').innerHTML = detailsHtml;

  // Populate form fields
  document.getElementById('modal-status').value = task.status;

  const modalAssignee = document.getElementById('modal-assignee');
  modalAssignee.innerHTML = '';
  teamMembers.forEach(member => {
    const option = document.createElement('option');
    option.value = member.name;
    option.textContent = member.name;
    if (member.name === task.assignedTo) option.selected = true;
    modalAssignee.appendChild(option);
  });

  document.getElementById('modal-notes').value = task.notes || '';

  // Store taskId for save
  document.getElementById('modal-save-btn').dataset.taskId = taskId;

  taskModal.classList.remove('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Step 3: Add event listeners** (Part 3)

Add to `public/js/build-queue.js`:
```javascript
// Event listeners
processBtn.addEventListener('click', processTranscript);
confirmTasksBtn.addEventListener('click', createTasks);
retryBtn.addEventListener('click', () => {
  aiOutput.classList.add('hidden');
  currentParsedTasks = null;
});

refreshBtn.addEventListener('click', loadTasks);

filterClient.addEventListener('change', loadTasks);
filterStatus.addEventListener('change', loadTasks);
filterAssignee.addEventListener('change', loadTasks);
filterPriority.addEventListener('change', loadTasks);

modalClose.addEventListener('click', () => {
  taskModal.classList.add('hidden');
});

document.getElementById('modal-save-btn').addEventListener('click', function() {
  const taskId = this.dataset.taskId;
  const status = document.getElementById('modal-status').value;
  const assignedTo = document.getElementById('modal-assignee').value;
  const notes = document.getElementById('modal-notes').value;

  updateTask(taskId, { status, assignedTo, notes, updatedBy: 'Bryan' });
});

// Close modal on outside click
taskModal.addEventListener('click', (e) => {
  if (e.target === taskModal) {
    taskModal.classList.add('hidden');
  }
});

// Initialize on page load
async function init() {
  try {
    await loadClients();
    await loadTeamMembers();
    await loadTasks();
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Error loading data: ' + error.message);
  }
}

init();
```

**Step 4: Test frontend**

Open browser: `http://localhost:3000/build-queue.html`
Expected: Dashboard loads with client dropdown, transcript textarea, empty task table

**Step 5: Commit**

```bash
git add public/js/build-queue.js
git commit -m "feat: add build queue frontend JavaScript"
```

---

## Task 10: Google Sheets Initial Setup Guide

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\docs\GOOGLE_SHEETS_SETUP.md`

**Step 1: Create setup guide**

Create `docs/GOOGLE_SHEETS_SETUP.md`:
```markdown
# Google Sheets Setup Guide

## Step 1: Create Google Cloud Project

1. Go to: https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: "Build Queue"
4. Click "Create"

## Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it → Click "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Name: "build-queue-bot"
4. Service account ID: "build-queue-bot"
5. Click "Create and Continue"
6. Role: "Editor"
7. Click "Continue" → "Done"

## Step 4: Generate Service Account Key

1. On the Credentials page, click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON"
5. Click "Create"
6. Save the downloaded JSON file as `google-credentials.json` in the bryan-finance-app folder

## Step 5: Extract Credentials to .env

Open the `google-credentials.json` file and copy:
- `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL in .env
- `private_key` → GOOGLE_PRIVATE_KEY in .env (keep the quotes and \\n)

## Step 6: Create Google Sheet

1. Go to: https://sheets.google.com
2. Create a new spreadsheet
3. Name it: "Prince Build Queue"
4. Copy the Sheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy `SHEET_ID_HERE` → GOOGLE_SHEET_ID in .env

## Step 7: Create Sheet Tabs

Create 5 tabs in your spreadsheet:

### Tab 1: "Build Queue"
Header row:
```
Task ID | Task | Priority | Client | System | Status | Assigned To | Date Added | Date Completed | Notes | Timestamp | Created By
```

### Tab 2: "Team Members"
Header row:
```
Name | Role | Specialties | Client Assignments | Active | Schedule
```

Sample data:
```
Vee | Builder | GHL, n8n, Web Apps | Prince | Yes | 1pm-9pm
Lee | Builder + QA | All | Kyle | Yes | 8am-4pm
JOHN | Night Builder | GHL, n8n | Prince (night) | Yes | 8pm-2am
Adam | GHL Specialist | GHL | Juan | Yes | 8pm+
Jameel | On-Demand | Web Apps, n8n | New Clients | Yes | Flexible
```

### Tab 3: "Clients"
Header row:
```
Client Name | Primary Assignee | Backup Assignee | Active | Priority Level
```

Sample data:
```
Prince | Vee | JOHN | Yes | High
Kyle | Lee | | Yes | High
Juan | Adam | | Yes | Medium
```

### Tab 4: "Assignment Rules"
Header row:
```
Rule Type | Condition | Assignee | Priority
```

Sample data:
```
Client | Prince | Vee | 1
Client | Kyle | Lee | 1
Client | Juan | Adam | 1
System | GHL | Adam | 2
System | n8n | Vee | 2
System | Web App | Jameel | 2
System | Voice Agent | Lee | 2
Time | Prince + after 9pm | JOHN | 1
Default | New Client | Jameel | 3
```

### Tab 5: "Systems"
Header row:
```
System Name | Default Assignee | Active
```

Sample data:
```
GHL | Adam | Yes
n8n | Vee | Yes
Web App | Jameel | Yes
Voice Agent | Lee | Yes
Cold Email | Lee | Yes
```

## Step 8: Share Sheet with Service Account

1. In your Google Sheet, click "Share"
2. Paste the service account email (from GOOGLE_SERVICE_ACCOUNT_EMAIL)
3. Set permission to "Editor"
4. Uncheck "Notify people"
5. Click "Share"

## Step 9: Test Connection

Run the test script:
```bash
cd "c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app"
node test-sheets.js
```

Expected output: "Connected! Rows: X"

## Done!

Your Google Sheets integration is now ready. The Build Queue system will read/write to this spreadsheet.
```

**Step 2: Commit**

```bash
git add docs/GOOGLE_SHEETS_SETUP.md
git commit -m "docs: add Google Sheets setup guide"
```

---

## Task 11: End-to-End Testing

**Files:**
- Create: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\TEST_CHECKLIST.md`

**Step 1: Create test checklist**

Create `TEST_CHECKLIST.md`:
```markdown
# Build Queue System - Test Checklist

## Prerequisites
- [ ] Google Sheets set up with 5 tabs and sample data
- [ ] Service account credentials in .env
- [ ] n8n workflow imported and activated
- [ ] Server running on http://localhost:3000

## Test 1: Load Dashboard
- [ ] Open http://localhost:3000/build-queue.html
- [ ] Client dropdown populated (Prince, Kyle, Juan visible)
- [ ] Filters show team members (Vee, Lee, JOHN, Adam, Jameel)
- [ ] Task table shows "No tasks found" or existing tasks

## Test 2: Process Transcript with AI
- [ ] Select "Kyle" from client dropdown
- [ ] Paste sample transcript (from design doc)
- [ ] Click "Process with AI"
- [ ] Spinner shows "Processing..."
- [ ] AI output appears with formatted task document
- [ ] Parsed tasks table shows extracted tasks
- [ ] Assignees auto-suggested correctly (Kyle tasks → Lee)

## Test 3: Create Tasks
- [ ] Click "Confirm & Create Tasks"
- [ ] Success message: "Successfully created X tasks!"
- [ ] Tasks appear in task table
- [ ] Check Google Sheet - tasks visible in "Build Queue" tab
- [ ] Check Telegram - notification received in group

## Test 4: Update Task Status
- [ ] Click "Edit" on a task
- [ ] Modal opens with task details
- [ ] Change status to "In Progress"
- [ ] Click "Save Changes"
- [ ] Modal closes
- [ ] Task table updates
- [ ] Google Sheet updates
- [ ] Telegram notification received

## Test 5: Complete Task
- [ ] Click "Edit" on a task
- [ ] Change status to "Done"
- [ ] Save
- [ ] Date Completed populates in Google Sheet
- [ ] Telegram notification: "Task Completed" with celebration

## Test 6: Filters
- [ ] Filter by Client: "Prince" → Only Prince tasks shown
- [ ] Filter by Status: "In Progress" → Only in-progress tasks
- [ ] Filter by Assignee: "Vee" → Only Vee's tasks
- [ ] Filter by Priority: "Critical" → Only critical tasks
- [ ] Clear all filters → All tasks shown

## Test 7: AI Fallback
- [ ] Temporarily set CLAUDE_API_KEY to invalid value in .env
- [ ] Restart server
- [ ] Process a transcript
- [ ] Should see: "Claude failed, falling back to OpenAI"
- [ ] OpenAI should succeed
- [ ] Restore valid CLAUDE_API_KEY

## Test 8: Assignment Rules
- [ ] Process transcript for "Prince" client
- [ ] Tasks should auto-assign to "Vee"
- [ ] Add a task manually mentioning "GHL"
- [ ] Should auto-suggest "Adam"

## Test 9: Config Changes (Future-Proofing)
- [ ] Add new client to "Clients" sheet: "Thomas | Lee | | Yes | Medium"
- [ ] Wait 5 min or refresh dashboard
- [ ] "Thomas" appears in client dropdown
- [ ] Add new team member to "Team Members" sheet
- [ ] New member appears in assignee dropdowns

## Test 10: Error Handling
- [ ] Try processing empty transcript → Should show error
- [ ] Try processing without selecting client → Should show error
- [ ] Try updating non-existent task → Should show 404 error

## All Tests Passed?
- [ ] YES → System is ready for production use!
- [ ] NO → Debug failing tests, check console logs
```

**Step 2: Run through test checklist**

Work through each test systematically.

**Step 3: Commit**

```bash
git add TEST_CHECKLIST.md
git commit -m "test: add end-to-end test checklist"
```

---

## Task 12: Production Deployment Prep

**Files:**
- Modify: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\.env`
- Modify: `c:\Users\User\Downloads\BRYAN CLAUDE X\bryan-finance-app\server.js`

**Step 1: Update server.js for production**

Add error handling middleware to `server.js`:
```javascript
// Add after all routes

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

**Step 2: Update .env for production**

Change:
```env
NODE_ENV=production
```

**Step 3: Test production mode**

```bash
node server.js
```

Expected: Server starts without errors

**Step 4: Commit**

```bash
git add server.js .env
git commit -m "chore: prepare for production deployment"
```

**Step 5: Final commit and tag**

```bash
git tag -a v1.0.0 -m "Release: Prince Build Queue System v1.0.0"
git push origin main --tags
```

---

## Completion Checklist

- [ ] All 12 tasks completed
- [ ] All tests passing
- [ ] Google Sheets configured and accessible
- [ ] n8n workflow activated
- [ ] Telegram notifications working
- [ ] AI agent working (Claude + OpenAI fallback)
- [ ] Frontend dashboard functional
- [ ] Assignment rules working correctly
- [ ] Team can access dashboard
- [ ] Bryan can process transcripts end-to-end

---

## Post-Launch Tasks (Future)

**Week 1:**
- Monitor AI output quality (Claude vs OpenAI)
- Gather team feedback on dashboard UX
- Adjust assignment rules based on real usage

**Week 2:**
- Add email notifications (optional)
- Add dark mode to dashboard (optional)
- Create mobile-optimized view

**Week 3:**
- Build admin settings page
- Add task search functionality
- Add bulk task operations

**Future Enhancements:**
- Task dependencies (task X blocks task Y)
- Time tracking per task
- Automatic task prioritization based on deadlines
- Integration with calendar for meeting auto-import

---

**Total Estimated Time:** 50-60 minutes
**Completion Target:** Sunday, March 2, 2026 (today)
