# Prince Build Queue System — Design Document

**Date:** March 2, 2026
**Author:** Claude (with Bryan)
**Status:** Approved
**Timeline:** 50-60 min build target

---

## Overview

Build an automated task management system that replaces manual Google Sheet tracking with:
- AI-powered transcript processing (paste meeting transcript → auto-generate formatted tasks)
- Smart auto-assignment with confirmation workflow
- Real-time Telegram notifications
- Google Sheets backend (future-proof with config sheets)
- Web dashboard for task management

**Goal:** Bryan pastes transcript → AI generates tasks → team gets notified → work begins. Zero manual task entry.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BRYAN (Browser)                          │
│  Dashboard UI (HTML/CSS/JS) - Paste Transcript, View Tasks  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP Requests
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              EXPRESS SERVER (server.js)                      │
│  • /api/process-transcript → AI Agent                       │
│  • /api/tasks → CRUD operations                             │
│  • /api/assign → Auto-suggest logic                         │
│  • Static files (HTML/CSS/JS)                                │
└──────┬──────────────────┬──────────────────────────────────┘
       │                  │
       ↓                  ↓
┌──────────────┐   ┌─────────────────────────────────────────┐
│ CLAUDE API   │   │      GOOGLE SHEETS API                   │
│ (primary)    │   │  • Build Queue (tasks)                   │
│      +       │   │  • Team Members (config)                 │
│ OPENAI API   │   │  • Clients (config)                      │
│ (fallback)   │   │  • Assignment Rules (config)             │
└──────────────┘   └──────────────────┬──────────────────────┘
                                      │ Webhook triggers
                                      ↓
                            ┌─────────────────────┐
                            │   N8N WORKFLOWS     │
                            │  • Telegram Bot     │
                            │  • Email (optional) │
                            └─────────────────────┘
```

**Key Design Decisions:**
1. **Single server** — Extend existing bryan-finance-app/server.js
2. **Google Sheets as database** — Fast setup, team can view/edit directly
3. **Dual AI fallback** — Claude API → OpenAI API for reliability
4. **n8n for notifications** — Already in Bryan's stack
5. **Config-driven** — Future-proof with Google Sheets config tabs

---

## Frontend Components

### Main Dashboard (`/build-queue`)

**1. Process Transcript Section** (top of page)
- Large textarea: "Paste meeting transcript here"
- Client dropdown: Prince, Kyle, Juan, etc. (loaded from Clients config sheet)
- "Process with AI" button → Loading spinner
- **AI Output Preview:** Shows formatted task document
- **Parsed Tasks Table:** Preview of extracted tasks before confirming
- "Confirm & Create Tasks" button
- "Edit & Retry" button

**2. Task List View** (main section)
- Table columns: Task, Priority (🔴🟡🟢), Client, System, Status, Assigned To, Date Added
- Filters: Client, Status, Assignee, Priority
- Sortable columns
- Click row → expand details panel

**3. Task Details Panel** (slide-out)
- Full description ("What You Must Deliver")
- Timestamp from meeting (if available)
- Word-for-word quotes (if available)
- Edit fields: Status dropdown, Reassign dropdown, Add notes
- "Save Changes" button → Updates Sheets → Triggers Telegram notification

**4. Quick Actions**
- "+ Add Task Manually" (for non-transcript tasks)
- "Refresh" (pull latest from Sheets)
- "Settings" (access config sheets)

**UI Style:**
- Plain HTML/CSS/JavaScript (no frameworks)
- Mobile-responsive
- Color-coded priorities (Red/Yellow/Green backgrounds)
- Clean, minimal design

---

## Backend API

### Endpoints

**POST /api/process-transcript**
- Input: `{ transcript: "...", client: "Prince" }`
- Process:
  1. Send to Claude API (Sonnet 3.5) with prompt
  2. If fails → Fall back to OpenAI API (GPT-4)
  3. Parse formatted output into tasks array
- Output: `{ formatted: "📄 Bryan Task Document...", tasks: [...] }`

**POST /api/tasks/create**
- Input: Array of tasks from AI
- Process:
  1. Load assignment rules from "Assignment Rules" sheet
  2. Auto-suggest assignee for each task
  3. Append to "Build Queue" sheet
  4. POST to n8n webhook (Telegram notification)
- Output: `{ success: true, tasksCreated: 5 }`

**GET /api/tasks**
- Input: Query params `?client=Prince&status=In Progress`
- Process: Read "Build Queue" sheet, filter, return
- Output: Array of tasks

**PATCH /api/tasks/:taskId**
- Input: `{ status: "Done", notes: "..." }`
- Process:
  1. Update row in "Build Queue" sheet
  2. POST to n8n webhook (status change notification)
- Output: `{ success: true }`

**GET /api/config/team-members**
- Reads "Team Members" sheet
- Returns: Array of team members

**GET /api/config/clients**
- Reads "Clients" sheet
- Returns: Array of clients

**GET /api/config/rules**
- Reads "Assignment Rules" sheet
- Returns: Assignment rules sorted by priority

---

## AI Agent

### Dual API Strategy

```javascript
async function processTranscript(transcript, client) {
  try {
    return await callClaudeAPI(transcript, client);
  } catch (claudeError) {
    console.log('Claude failed, falling back to OpenAI');
    return await callOpenAIAPI(transcript, client);
  }
}
```

### Prompt Template

```
You are Bryan's meeting task extractor. Analyze this meeting transcript and generate a formatted task document.

CLIENT: {client}
TRANSCRIPT:
{transcript}

OUTPUT FORMAT (follow EXACTLY):
📄 Bryan Task Document
Bryan x {client} – {date}
Recording Length: {duration if available}

🚨 PRIORITY #1 — {CATEGORY}
1️⃣ {Task Title} ({ASSIGNEE})
⏱ {timestamp}
🗣 Word-for-Word:
{quotes}

📌 What You Must Deliver:
- {checklist}

🔴 Priority Level: {Critical/High/Medium/Low}

[Repeat for all tasks]

🔴 FINAL PRIORITY ORDER
DO FIRST (URGENT)
- {task}

ASSIGNMENT RULES:
- Prince → Vee (or JOHN after 9pm)
- Kyle → Lee
- Juan → Adam
- GHL → Adam
- n8n → Vee
- Web Apps → Jameel

Extract all action items, assign based on rules, include timestamps and quotes.
```

### Parsing Logic

- Extract tasks using regex: `/\d️⃣\s+(.+?)\s+\((\w+)\)/g`
- Map priority emojis: 🔴=Critical, 🟡=Medium, 🟢=Low
- Parse assignees from parentheses
- Extract timestamps: `/⏱\s+(.+)/g`
- Extract deliverables: lines after "What You Must Deliver:"
- Infer system type from keywords (GHL, n8n, etc.)

### API Configuration

- **Claude:** `claude-3-5-sonnet-20241022`, max tokens 4000
- **OpenAI:** `gpt-4-turbo`, max tokens 4000
- Timeout: 30 seconds per call
- 1 retry per provider before fallback

---

## n8n Automation

### Workflow: Build Queue Notifications

**File:** `bryan-finance-app/n8n-build-queue-workflow.json`

**Flow:**
1. Webhook Trigger (`/webhook/bryanOS`)
2. Switch on `event` field (task_created, task_updated, task_completed)
3. Format Telegram message based on event type
4. Send to Telegram group (chat ID: 8670891353)
5. Respond success to Express server

**Telegram Message Templates:**

**Task Created:**
```
🆕 *New Task Created*

📋 {task.title}
👤 Assigned: {task.assignee}
🔴 Priority: {task.priority}
🎯 Client: {task.client}
🔧 System: {task.system}

📝 {task.notes.substring(0,100)}...
```

**Task Updated:**
```
🔄 *Task Updated*

📋 {task.title}
📊 Status: {task.status}
👤 Assigned: {task.assignee}

Updated by: {updatedBy}
```

**Task Completed:**
```
✅ *Task Completed*

📋 {task.title}
👤 Completed by: {task.assignee}
🎉 Great work!
```

**Credentials:**
- Webhook URL: `https://madeeas.app.n8n.cloud/webhook/bryanOS`
- Telegram Bot Token: `8670891353:AAFBbj5JygHGimHC1qt6E_yqZ4p14CJYwtE`
- Telegram Chat ID: `8670891353`

---

## Data Schema

### Google Sheets Structure

**Sheet 1: "Build Queue"** (main task list)

| Column | Type | Description |
|--------|------|-------------|
| Task ID | Auto-increment | 1, 2, 3... |
| Task | Text | Task title |
| Priority | Text | Critical, High, Medium, Low |
| Client | Text | Prince, Kyle, Juan, etc. |
| System | Text | GHL, n8n, Web App, etc. |
| Status | Text | Not Started, In Progress, Done, QA, Blocked |
| Assigned To | Text | Vee, Lee, JOHN, Adam, Jameel |
| Date Added | Date | YYYY-MM-DD |
| Date Completed | Date | YYYY-MM-DD |
| Notes | Text | Details, links, context |
| Timestamp | Text | Meeting timestamp (0:12 - 3:33) |
| Created By | Text | Bryan |

**Sheet 2: "Team Members"** (config)

| Name | Role | Specialties | Client Assignments | Active | Schedule |
|------|------|-------------|-------------------|--------|----------|
| Vee | Builder | GHL, n8n, Web Apps | Prince | Yes | 1pm-9pm |
| Lee | Builder + QA | All | Kyle | Yes | 8am-4pm |
| JOHN | Night Builder | GHL, n8n | Prince (night) | Yes | 8pm-2am |
| Adam | GHL Specialist | GHL | Juan | Yes | 8pm+ |
| Jameel | On-Demand | Web Apps, n8n | New Clients | Yes | Flexible |

**Sheet 3: "Clients"** (config)

| Client Name | Primary Assignee | Backup | Active | Priority Level |
|-------------|------------------|--------|--------|----------------|
| Prince | Vee | JOHN | Yes | High |
| Kyle | Lee | - | Yes | High |
| Juan | Adam | - | Yes | Medium |

**Sheet 4: "Assignment Rules"** (config)

| Rule Type | Condition | Assignee | Priority |
|-----------|-----------|----------|----------|
| Client | Prince | Vee | 1 |
| Client | Kyle | Lee | 1 |
| System | GHL | Adam | 2 |
| System | n8n | Vee | 2 |
| Time | Prince + after 9pm | JOHN | 1 |
| Default | New Client | Jameel | 3 |

**Sheet 5: "Systems"** (config)

| System Name | Default Assignee | Active |
|-------------|------------------|--------|
| GHL | Adam | Yes |
| n8n | Vee | Yes |
| Web App | Jameel | Yes |
| Voice Agent | Lee | Yes |

---

## Dynamic Assignment Logic

```javascript
async function suggestAssignee(task) {
  const config = await loadConfigFromSheets();

  // Priority 1: Client-based rules
  const clientRule = config.rules.find(r =>
    r.type === 'Client' && r.condition === task.client
  );
  if (clientRule) return clientRule.assignee;

  // Priority 2: System-based rules
  const systemRule = config.rules.find(r =>
    r.type === 'System' && r.condition === task.system
  );
  if (systemRule) return systemRule.assignee;

  // Priority 3: Time-based rules
  const hour = new Date().getHours();
  if (task.client === 'Prince' && hour >= 21) {
    return 'JOHN'; // Night shift
  }

  // Priority 4: Default fallback
  return config.rules.find(r => r.type === 'Default').assignee;
}
```

**Future-Proof Benefits:**
- Add new clients → just add row to "Clients" sheet
- Add new team members → add row to "Team Members" sheet
- Change assignment rules → edit "Assignment Rules" sheet
- No code deployment needed

---

## Security & Configuration

### Environment Variables (`.env`)

```env
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Google Sheets
GOOGLE_SHEET_ID=<sheet-id-from-url>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>
GOOGLE_PRIVATE_KEY=<private-key-from-json>

# n8n
N8N_WEBHOOK_URL=https://madeeas.app.n8n.cloud/webhook/bryanOS

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Server
PORT=3000
NODE_ENV=production
```

### Google Service Account Setup (5 min)

1. Go to https://console.cloud.google.com
2. Create/select project
3. Enable Google Sheets API
4. Create Service Account → Download JSON credentials
5. Share Google Sheet with service account email (Editor access)

### Security Measures

- ✅ API keys in `.env` (never committed)
- ✅ `.gitignore` includes `.env` and credentials
- ✅ Service account minimal permissions
- ✅ Rate limiting on AI calls (10/min max)
- ✅ Input sanitization on transcripts

---

## User Workflow

### Bryan's Daily Flow

1. **After client meeting:**
   - Open Build Queue dashboard
   - Paste raw transcript into textarea
   - Select client from dropdown
   - Click "Process with AI"

2. **AI processes transcript:**
   - Shows formatted task document
   - Shows parsed tasks table
   - Bryan reviews accuracy

3. **Bryan confirms:**
   - Clicks "Confirm & Create Tasks"
   - Tasks created in Google Sheets
   - Telegram notification sent to team
   - Team members see notification and pull tasks

4. **Team updates tasks:**
   - Open dashboard or Google Sheets
   - Change status: "In Progress" → "Done"
   - Telegram notification sent
   - Bryan sees progress in next meeting

### Team Member Flow

1. Receive Telegram notification about new task
2. Open Build Queue dashboard (or Google Sheets)
3. Filter by "Assigned To: Me"
4. Pull task, change status to "In Progress"
5. Work on task
6. Change status to "Done" → Telegram notification sent
7. Pull next task

---

## Error Handling

### AI Failures
- Claude API timeout → Fall back to OpenAI
- Both APIs fail → Return error, prompt Bryan to retry
- Malformed transcript → AI does best effort, Bryan reviews before confirming

### Google Sheets Errors
- API quota exceeded → Queue requests, retry with exponential backoff
- Sheet not found → Clear error message with setup instructions
- Permission denied → Verify service account has Editor access

### n8n Webhook Failures
- Webhook timeout (30s) → Log error, continue (notification not critical)
- Telegram bot blocked → Log error, send email notification instead (fallback)

### Edge Cases
- Duplicate tasks → Check for exact title match in last 24 hours, prompt confirmation
- Invalid assignee → Fall back to default assignee from config
- Missing client → Prompt Bryan to select from dropdown

---

## Timeline & Milestones

**Total build time: 50-60 minutes**

### Phase 1: Setup (10 min)
- Create Google Sheet with 5 tabs
- Set up service account
- Import n8n workflow
- Update .env file

### Phase 2: Backend (20 min)
- Add Express routes to server.js
- Google Sheets API integration
- AI agent (Claude + OpenAI)
- Dynamic assignment logic

### Phase 3: Frontend (15 min)
- HTML dashboard layout
- Transcript processing UI
- Task list table
- Task details panel

### Phase 4: Integration (10 min)
- Connect frontend → backend → Sheets
- Test AI processing
- Test Telegram notifications
- Test task CRUD operations

### Phase 5: Testing & Polish (5 min)
- End-to-end test with sample transcript
- Fix any bugs
- Deploy to server

---

## Success Criteria

✅ Bryan pastes transcript → AI generates formatted tasks → Bryan confirms → Tasks in Sheets
✅ Team receives Telegram notification when tasks created
✅ Team can update task status in dashboard → Telegram notification sent
✅ Assignment rules work correctly (Prince → Vee, Kyle → Lee, etc.)
✅ System handles both Claude and OpenAI APIs
✅ Future-proof: New clients/employees added via config sheets
✅ Complete build in under 1 hour

---

## Next Steps

1. **Write implementation plan** (via writing-plans skill)
2. **Execute build** (50-60 min focused work)
3. **Test with real transcript** (use the Kyle sample provided)
4. **Deploy to production**
5. **Train team on dashboard usage**

---

**Design Status:** ✅ APPROVED
**Ready for implementation:** YES
**Estimated completion:** Sunday, March 2, 2026 (today + 1 hour)
