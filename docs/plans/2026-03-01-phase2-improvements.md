# Build Queue System — Phase 2 Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical gaps and add high-impact features to the Build Queue System to improve productivity, reliability, and user experience.

**Architecture:** Vanilla JS frontend with Express.js backend, Google Sheets as database, AI transcript processing (Claude/OpenAI fallback), rule-based auto-assignment, n8n webhook notifications. All improvements maintain this stack — no framework migrations.

**Tech Stack:** Node.js, Express 5, Google Sheets API, Anthropic SDK, OpenAI SDK, Vanilla JS, CSS3 (Sumait AI brand system)

---

## GAP ANALYSIS

### CRITICAL GAPS (Bugs / Data Integrity Issues)

| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| G1 | **Delete breaks task IDs** — Deleting a row from Google Sheets shifts all rows below it. `taskId + 2` math for row lookups becomes wrong after any delete. Tasks get updated/deleted at the wrong row. | Data corruption | 🔴 Critical |
| G2 | **No input validation on server** — PATCH/DELETE endpoints trust `taskId` without sanitizing. No check for negative numbers, non-numeric strings, or out-of-range values. | Security risk | 🔴 Critical |
| G3 | **No error boundaries in frontend** — If `loadClients()` or `loadTeamMembers()` fails, the entire `init()` fails silently. User sees blank page with no feedback. | UX breakage | 🔴 Critical |
| G4 | **n8n webhook broken** — `N8N_WEBHOOK_URL` is commented out/invalid. Every task create/update triggers a failed notification request (30s timeout), slowing operations. | Performance | 🟡 High |
| G5 | **XSS in delete button** — `escapeHtml(task.task).substring(0, 30)` is passed into `onclick="deleteTask('...', '...')"`. If the escaped string contains a single quote, it breaks the handler. | Security | 🔴 Critical |
| G6 | **Race condition on task creation** — `nextId = existingTasks.length` is not atomic. Two simultaneous requests can generate the same ID. | Data integrity | 🟡 High |
| G7 | **Hardcoded `createdBy: 'Bryan'`** in frontend JS — No way to change who created a task. | Functionality gap | 🟡 Medium |

### FUNCTIONAL GAPS (Missing Features)

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| F1 | **No search** — Can't search tasks by keyword. With 50+ tasks, finding a specific one requires scrolling. | Productivity | 🔴 High |
| F2 | **No bulk operations** — Can't select/delete/update multiple tasks at once. Must click each one individually. | Productivity | 🔴 High |
| F3 | **No keyboard shortcuts** — Every action requires mouse clicks. Power users can't navigate efficiently. | Productivity | 🟡 Medium |
| F4 | **No task count / stats summary** — No visibility into how many tasks are open, blocked, by client, etc. | Visibility | 🟡 Medium |
| F5 | **No export** — Can't generate reports for clients. Must manually go to Google Sheets. | Business need | 🟡 Medium |
| F6 | **No manual task creation** — "Add Task" button exists in HTML but has no handler. Can only create tasks via AI transcript processing. | Functionality | 🔴 High |
| F7 | **No sorting** — Table columns are not sortable. Can't sort by date, priority, client, etc. | UX | 🟡 Medium |
| F8 | **No pagination** — All tasks load at once. Will slow down as task count grows. | Performance | 🟡 Medium |
| F9 | **Filter state not persisted** — Refreshing page resets all filters. | UX | 🟢 Low |

### UX / DESIGN GAPS

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| U1 | **`btn-secondary` uses undefined CSS vars** — References `--text-secondary` and `--text-primary` which don't exist. Buttons render with broken gradients. | Visual bug | 🔴 High |
| U2 | **No loading states** — API calls show no feedback. User doesn't know if action is processing. | UX | 🟡 Medium |
| U3 | **`alert()` for all feedback** — Native browser alerts block the thread and look unprofessional. Need toast notifications. | UX | 🟡 Medium |
| U4 | **Modal form layout broken** — `.modal-actions` is `display: flex` but contains stacked form groups. They render horizontally instead of vertically. | Visual bug | 🔴 High |
| U5 | **Mobile table unusable** — 9-column table overflows on mobile. Only basic `font-size` reduction applied. | Responsiveness | 🟡 Medium |
| U6 | **No empty state design** — "No tasks found" is plain text in a `<td>`. No visual guidance. | UX | 🟢 Low |
| U7 | **`filter-control` options missing dark styling** — Filter dropdowns `<option>` elements don't have explicit dark background like `select.form-control option`. | Visual bug | 🟡 Medium |

### ARCHITECTURE / CODE QUALITY GAPS

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| A1 | **No tests** — `"test": "echo \"Error: no test specified\""` — Zero test coverage. Any change can break things silently. | Reliability | 🔴 High |
| A2 | **Google Sheets as database** — No indexes, no transactions, no joins. Row-based lookups are O(n). Will degrade as data grows. | Scalability | 🟡 Medium |
| A3 | **No request rate limiting** — API endpoints are unprotected. A bot could spam requests. | Security | 🟡 Medium |
| A4 | **AI model hardcoded** — `claude-3-5-sonnet-20241022` is pinned. Should use latest model. | Maintenance | 🟢 Low |
| A5 | **No logging beyond console.log** — No structured logging, no log levels, no persistence. | Operations | 🟡 Medium |
| A6 | **`init()` calls are sequential** — `loadClients`, `loadTeamMembers`, `loadTasks` run one after another. Could run in parallel with `Promise.all`. | Performance | 🟢 Low |

---

## IMPLEMENTATION PLAN

### Phase 2A: Critical Bug Fixes (Do First)

---

### Task 1: Fix Task ID Lookup (G1 — Critical)

**Problem:** Current system uses `taskId + 2` to find Google Sheets rows. After a delete shifts rows, this math becomes wrong, corrupting data on updates/deletes.

**Solution:** Look up tasks by scanning column A for the matching ID, not by calculating row position.

**Files:**
- Modify: `services/googleSheets.js:108-127` (getTaskById)
- Modify: `services/googleSheets.js` (add `findRowByTaskId` method)
- Modify: `server.js:175-228` (PATCH endpoint)
- Modify: `server.js:230-252` (DELETE endpoint)

**Step 1: Add `findRowByTaskId` method to GoogleSheetsService**

Add this method to `services/googleSheets.js` before `getTaskById`:

```javascript
async findRowByTaskId(taskId) {
  const rows = await this.readSheet('Build Queue');
  for (let i = 1; i < rows.length; i++) { // skip header
    if (rows[i][0] === String(taskId)) {
      return { rowIndex: i + 1, data: rows[i] }; // +1 because Sheets is 1-indexed
    }
  }
  return null;
}
```

**Step 2: Update `getTaskById` to use `findRowByTaskId`**

Replace the existing `getTaskById` method:

```javascript
async getTaskById(taskId) {
  const result = await this.findRowByTaskId(taskId);
  if (!result) return null;

  const row = result.data;
  return {
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
    _rowIndex: result.rowIndex, // internal: actual row position
  };
}
```

**Step 3: Update PATCH endpoint in server.js**

Replace the hardcoded `parseInt(taskId) + 2` calculation:

```javascript
app.patch('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, assignedTo, notes, updatedBy = 'Bryan' } = req.body;

    const task = await sheets.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const rowIndex = task._rowIndex; // Use actual row position

    // ... rest stays the same, but use rowIndex from task
```

**Step 4: Update DELETE endpoint in server.js**

Same fix for the delete endpoint:

```javascript
app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await sheets.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const rowIndex = task._rowIndex; // Use actual row position
    await sheets.deleteRow('Build Queue', rowIndex);
    // ...
```

**Step 5: Commit**

```bash
git add services/googleSheets.js server.js
git commit -m "fix: use row scan instead of ID math for task lookups

Prevents data corruption after row deletions shift IDs."
```

---

### Task 2: Fix XSS in Delete Button (G5 — Critical)

**Problem:** Task titles with quotes break the `onclick` handler and can inject script.

**Files:**
- Modify: `public/js/build-queue.js:223-236` (renderTasks)

**Step 1: Use data attributes instead of inline onclick**

Replace the row rendering in `renderTasks()`:

```javascript
row.innerHTML = `
  <td>${task.id}</td>
  <td>${escapeHtml(task.task)}</td>
  <td><span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span></td>
  <td>${escapeHtml(task.client)}</td>
  <td>${escapeHtml(task.system)}</td>
  <td><span class="status-badge status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
  <td>${escapeHtml(task.assignedTo)}</td>
  <td>${task.dateAdded}</td>
  <td>
    <button class="btn btn-secondary btn-sm edit-btn" data-task-id="${task.id}">Edit</button>
    <button class="btn btn-danger btn-sm delete-btn" data-task-id="${task.id}" data-task-preview="${escapeHtml(task.task).substring(0, 30)}">Delete</button>
  </td>
`;
```

**Step 2: Use event delegation instead of inline handlers**

Add after `renderTasks()` function or inside init:

```javascript
document.getElementById('tasks-tbody').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');

  if (editBtn) {
    openTaskModal(editBtn.dataset.taskId);
  } else if (deleteBtn) {
    deleteTask(deleteBtn.dataset.taskId, deleteBtn.dataset.taskPreview);
  }
});
```

**Step 3: Commit**

```bash
git add public/js/build-queue.js
git commit -m "fix: remove inline onclick handlers to prevent XSS"
```

---

### Task 3: Fix Input Validation (G2 — Critical)

**Problem:** Server endpoints accept any `taskId` without validation.

**Files:**
- Modify: `server.js` (add validation middleware)

**Step 1: Add validation helper at top of server.js**

```javascript
function validateTaskId(taskId) {
  const id = parseInt(taskId, 10);
  return !isNaN(id) && id >= 0 && String(id) === String(taskId);
}
```

**Step 2: Add validation to PATCH and DELETE endpoints**

Add at the start of each handler, after `const { taskId } = req.params;`:

```javascript
if (!validateTaskId(taskId)) {
  return res.status(400).json({ error: 'Invalid task ID' });
}
```

**Step 3: Validate task creation input**

Add to POST `/api/tasks/create`, after checking `tasks` is an array:

```javascript
for (const task of tasks) {
  if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
    return res.status(400).json({ error: 'Each task must have a non-empty title' });
  }
}
```

**Step 4: Commit**

```bash
git add server.js
git commit -m "fix: add input validation to API endpoints"
```

---

### Task 4: Fix CSS Bugs (U1, U4, U7)

**Files:**
- Modify: `public/css/build-queue.css`

**Step 1: Fix `btn-secondary` broken gradient (U1)**

Replace the broken `.btn-secondary` rules:

```css
.btn-secondary {
  background: var(--white-5);
  border: 1px solid var(--white-10);
  color: var(--white-100);
}

.btn-secondary:hover {
  background: var(--white-10);
  border-color: var(--white-30);
}
```

**Step 2: Fix modal-actions layout (U4)**

Change from horizontal flex to vertical:

```css
.modal-actions {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

**Step 3: Fix filter dropdown option styling (U7)**

Add:

```css
.filter-control option {
  background: var(--black);
  color: var(--white-100);
  padding: 10px;
}
```

**Step 4: Commit**

```bash
git add public/css/build-queue.css
git commit -m "fix: repair broken CSS for buttons, modal layout, and filter options"
```

---

### Task 5: Fix Notification Service Guard (G4)

**Problem:** When `N8N_WEBHOOK_URL` is empty/commented out, every task operation waits 30s for a failed HTTP request.

**Files:**
- Modify: `services/notifications.js`

**Step 1: Add early return when webhook URL is not configured**

```javascript
async sendTaskNotification(event, task, updatedBy = null) {
  if (!this.webhookUrl) {
    console.log(`Notification skipped (${event}): No webhook URL configured`);
    return { success: false, error: 'No webhook URL configured' };
  }

  try {
    // ... existing code
```

**Step 2: Commit**

```bash
git add services/notifications.js
git commit -m "fix: skip notifications when webhook URL is not configured"
```

---

### Task 6: Fix Frontend Error Handling (G3)

**Files:**
- Modify: `public/js/build-queue.js:367-378` (init function)

**Step 1: Make init calls parallel and independent**

```javascript
async function init() {
  const results = await Promise.allSettled([
    loadClients(),
    loadTeamMembers(),
    loadTasks(),
  ]);

  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason.message);

  if (errors.length > 0) {
    console.error('Init errors:', errors);
    showToast(`Some data failed to load: ${errors.join(', ')}`, 'error');
  }
}
```

**Step 2: Commit**

```bash
git add public/js/build-queue.js
git commit -m "fix: make init parallel and handle partial failures gracefully"
```

---

### Phase 2B: High-Impact Features

---

### Task 7: Add Toast Notifications (U3)

**Problem:** Native `alert()` blocks the thread and looks unprofessional.

**Files:**
- Modify: `public/css/build-queue.css` (add toast styles)
- Modify: `public/js/build-queue.js` (add toast function, replace all `alert()` calls)

**Step 1: Add toast container to HTML**

Add before `</body>` in `build-queue.html`:

```html
<div id="toast-container"></div>
```

**Step 2: Add toast CSS**

```css
#toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--white-100);
  background: var(--white-10);
  border: 1px solid var(--white-10);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-subtle);
  animation: slideIn 0.3s ease;
  max-width: 400px;
}

.toast.success {
  border-color: var(--red-100);
  box-shadow: var(--glow-red);
}

.toast.error {
  background: var(--red-25);
  border-color: var(--red-100);
}

.toast.fade-out {
  animation: slideOut 0.3s ease forwards;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
```

**Step 3: Add toast JS function**

```javascript
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
```

**Step 4: Replace all `alert()` calls with `showToast()`**

- `alert('Please paste a meeting transcript')` → `showToast('Please paste a meeting transcript', 'error')`
- `alert('Task updated successfully!')` → `showToast('Task updated successfully!', 'success')`
- `alert('Task deleted successfully')` → `showToast('Task deleted successfully', 'success')`
- `alert('Error creating tasks: ...')` → `showToast('Error creating tasks: ' + error.message, 'error')`
- ...replace all remaining `alert()` calls

**Step 5: Commit**

```bash
git add public/build-queue.html public/css/build-queue.css public/js/build-queue.js
git commit -m "feat: replace alert() with toast notification system"
```

---

### Task 8: Add Manual Task Creation (F6)

**Problem:** "Add Task" button exists but does nothing. Users can only create tasks via AI processing.

**Files:**
- Modify: `public/build-queue.html` (add manual task modal)
- Modify: `public/js/build-queue.js` (add manual task handler)

**Step 1: Add manual task modal to HTML**

Add before the closing `</div>` of `.container`:

```html
<!-- Manual Task Modal -->
<div id="manual-task-modal" class="modal hidden">
  <div class="modal-content">
    <span class="modal-close" onclick="document.getElementById('manual-task-modal').classList.add('hidden')">&times;</span>
    <h2>Add New Task</h2>
    <div class="modal-actions">
      <div class="form-group">
        <label>Task Title:</label>
        <input type="text" id="manual-task-title" class="form-control" placeholder="Enter task description...">
      </div>
      <div class="form-group">
        <label>Client:</label>
        <select id="manual-task-client" class="form-control"></select>
      </div>
      <div class="form-group">
        <label>Priority:</label>
        <select id="manual-task-priority" class="form-control">
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium" selected>Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <div class="form-group">
        <label>System:</label>
        <select id="manual-task-system" class="form-control">
          <option value="GHL">GHL</option>
          <option value="n8n">n8n</option>
          <option value="Web App">Web App</option>
          <option value="Voice Agent">Voice Agent</option>
          <option value="Cold Email">Cold Email</option>
          <option value="Other" selected>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes:</label>
        <textarea id="manual-task-notes" class="form-control" rows="3" placeholder="Optional notes..."></textarea>
      </div>
      <button id="manual-task-submit" class="btn btn-primary">Create Task</button>
    </div>
  </div>
</div>
```

**Step 2: Add JS handler for manual task creation**

```javascript
document.getElementById('add-manual-btn').addEventListener('click', () => {
  const modal = document.getElementById('manual-task-modal');
  const clientSelect = document.getElementById('manual-task-client');

  // Populate clients
  clientSelect.innerHTML = '';
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    clientSelect.appendChild(opt);
  });

  modal.classList.remove('hidden');
});

document.getElementById('manual-task-submit').addEventListener('click', async () => {
  const title = document.getElementById('manual-task-title').value.trim();
  const client = document.getElementById('manual-task-client').value;
  const priority = document.getElementById('manual-task-priority').value;
  const system = document.getElementById('manual-task-system').value;
  const notes = document.getElementById('manual-task-notes').value.trim();

  if (!title) {
    showToast('Please enter a task title', 'error');
    return;
  }

  try {
    await apiCall('/api/tasks/create', {
      method: 'POST',
      body: JSON.stringify({
        tasks: [{ title, client, priority, system, notes }],
      }),
    });

    showToast('Task created successfully!', 'success');
    document.getElementById('manual-task-modal').classList.add('hidden');
    document.getElementById('manual-task-title').value = '';
    document.getElementById('manual-task-notes').value = '';
    await loadTasks();
  } catch (error) {
    showToast('Failed to create task: ' + error.message, 'error');
  }
});
```

**Step 3: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js
git commit -m "feat: add manual task creation modal"
```

---

### Task 9: Add Real-Time Search (F1)

**Files:**
- Modify: `public/build-queue.html` (add search input)
- Modify: `public/js/build-queue.js` (add search logic)
- Modify: `public/css/build-queue.css` (search styling)

**Step 1: Add search input to filters section in HTML**

Add inside `.filters` div, before the filter dropdowns:

```html
<input type="text" id="search-input" class="filter-control" placeholder="Search tasks..." style="flex: 2;">
```

**Step 2: Add search logic in JS**

```javascript
const searchInput = document.getElementById('search-input');

searchInput.addEventListener('input', () => {
  renderTasks();
});

// Update renderTasks to respect search
function renderTasks() {
  tasksTableBody.innerHTML = '';

  let filtered = allTasks;
  const query = searchInput.value.toLowerCase().trim();

  if (query) {
    filtered = filtered.filter(task =>
      task.task.toLowerCase().includes(query) ||
      task.client.toLowerCase().includes(query) ||
      task.assignedTo.toLowerCase().includes(query) ||
      task.system.toLowerCase().includes(query) ||
      (task.notes && task.notes.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    tasksTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No tasks found</td></tr>';
    return;
  }

  filtered.forEach(task => {
    // ... existing row rendering code
  });
}
```

**Step 3: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js
git commit -m "feat: add real-time task search across all fields"
```

---

### Task 10: Add Bulk Operations (F2)

**Files:**
- Modify: `public/build-queue.html` (add checkboxes and bulk action bar)
- Modify: `public/js/build-queue.js` (add selection and bulk logic)
- Modify: `public/css/build-queue.css` (bulk action bar styles)
- Modify: `server.js` (add bulk endpoints)

**Step 1: Add bulk action bar to HTML**

Add inside tasks section, before the table:

```html
<div id="bulk-actions" class="bulk-actions hidden">
  <span id="selected-count">0 selected</span>
  <button class="btn btn-secondary btn-sm" id="bulk-status-btn">Change Status</button>
  <button class="btn btn-secondary btn-sm" id="bulk-assign-btn">Reassign</button>
  <button class="btn btn-danger btn-sm" id="bulk-delete-btn">Delete Selected</button>
  <button class="btn btn-secondary btn-sm" id="bulk-deselect-btn">Deselect All</button>
</div>
```

**Step 2: Add "select all" checkbox to table header**

Replace the first `<th>ID</th>` with:

```html
<th><input type="checkbox" id="select-all-checkbox"></th>
<th>ID</th>
```

**Step 3: Add checkbox column to each row in renderTasks**

Prepend to each row:

```javascript
<td><input type="checkbox" class="task-checkbox" data-task-id="${task.id}"></td>
```

Update colspan from 9 to 10 for empty state.

**Step 4: Add bulk selection logic in JS**

```javascript
let selectedTaskIds = new Set();

function updateBulkBar() {
  const bar = document.getElementById('bulk-actions');
  const count = document.getElementById('selected-count');

  if (selectedTaskIds.size > 0) {
    bar.classList.remove('hidden');
    count.textContent = `${selectedTaskIds.size} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

// Delegate checkbox events
document.getElementById('tasks-tbody').addEventListener('change', (e) => {
  if (e.target.classList.contains('task-checkbox')) {
    const id = e.target.dataset.taskId;
    if (e.target.checked) {
      selectedTaskIds.add(id);
    } else {
      selectedTaskIds.delete(id);
    }
    updateBulkBar();
  }
});

document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
  const checkboxes = document.querySelectorAll('.task-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
    if (e.target.checked) {
      selectedTaskIds.add(cb.dataset.taskId);
    } else {
      selectedTaskIds.delete(cb.dataset.taskId);
    }
  });
  updateBulkBar();
});
```

**Step 5: Add bulk delete handler**

```javascript
document.getElementById('bulk-delete-btn').addEventListener('click', async () => {
  if (selectedTaskIds.size === 0) return;

  const confirmed = confirm(`Delete ${selectedTaskIds.size} task(s)? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await apiCall('/api/tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds: Array.from(selectedTaskIds) }),
    });

    showToast(`${selectedTaskIds.size} task(s) deleted`, 'success');
    selectedTaskIds.clear();
    updateBulkBar();
    await loadTasks();
  } catch (error) {
    showToast('Bulk delete failed: ' + error.message, 'error');
  }
});
```

**Step 6: Add bulk endpoint in server.js**

```javascript
app.post('/api/tasks/bulk-delete', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Missing taskIds array' });
    }

    // Delete in reverse order to avoid row shift issues
    const rowsToDelete = [];
    for (const taskId of taskIds) {
      const task = await sheets.getTaskById(taskId);
      if (task) {
        rowsToDelete.push(task._rowIndex);
      }
    }

    // Sort descending so we delete from bottom up
    rowsToDelete.sort((a, b) => b - a);

    for (const rowIndex of rowsToDelete) {
      await sheets.deleteRow('Build Queue', rowIndex);
    }

    res.json({ success: true, deleted: rowsToDelete.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Step 7: Add bulk action bar CSS**

```css
.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--red-8);
  border: 1px solid var(--red-35);
  border-radius: 12px;
  margin-bottom: 12px;
}

.bulk-actions span {
  font-weight: 700;
  color: var(--red-100);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}
```

**Step 8: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js public/css/build-queue.css server.js
git commit -m "feat: add bulk select, delete, and action bar for tasks"
```

---

### Task 11: Add Column Sorting (F7)

**Files:**
- Modify: `public/js/build-queue.js` (sorting logic)
- Modify: `public/css/build-queue.css` (sort indicator styles)

**Step 1: Add sort state and function**

```javascript
let sortColumn = null;
let sortDirection = 'asc';

function sortTasks(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }

  const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  allTasks.sort((a, b) => {
    let valA = a[column] || '';
    let valB = b[column] || '';

    if (column === 'priority') {
      valA = priorityOrder[valA] ?? 99;
      valB = priorityOrder[valB] ?? 99;
    } else if (column === 'id') {
      valA = parseInt(valA);
      valB = parseInt(valB);
    } else {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  renderTasks();

  // Update sort indicators
  document.querySelectorAll('.tasks-table th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === column) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}
```

**Step 2: Make table headers clickable**

Update the `<th>` elements in HTML to include `data-sort` attributes:

```html
<th data-sort="id" style="cursor:pointer">ID</th>
<th data-sort="task" style="cursor:pointer">Task</th>
<th data-sort="priority" style="cursor:pointer">Priority</th>
<th data-sort="client" style="cursor:pointer">Client</th>
<th data-sort="system" style="cursor:pointer">System</th>
<th data-sort="status" style="cursor:pointer">Status</th>
<th data-sort="assignedTo" style="cursor:pointer">Assigned To</th>
<th data-sort="dateAdded" style="cursor:pointer">Date Added</th>
<th>Actions</th>
```

**Step 3: Add click handler for sorting**

```javascript
document.querySelector('.tasks-table thead').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]');
  if (th) sortTasks(th.dataset.sort);
});
```

**Step 4: Add sort indicator CSS**

```css
.tasks-table th[data-sort] {
  cursor: pointer;
  user-select: none;
  position: relative;
  padding-right: 20px;
}

.tasks-table th[data-sort]:hover {
  color: var(--red-100);
}

.tasks-table th[data-sort]::after {
  content: '⇅';
  position: absolute;
  right: 4px;
  opacity: 0.3;
  font-size: 10px;
}

.tasks-table th.sort-asc::after {
  content: '↑';
  opacity: 1;
  color: var(--red-100);
}

.tasks-table th.sort-desc::after {
  content: '↓';
  opacity: 1;
  color: var(--red-100);
}
```

**Step 5: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js public/css/build-queue.css
git commit -m "feat: add clickable column sorting with direction indicators"
```

---

### Task 12: Add Stats Summary Bar (F4)

**Files:**
- Modify: `public/build-queue.html` (add stats section)
- Modify: `public/js/build-queue.js` (calculate and render stats)
- Modify: `public/css/build-queue.css` (stats styles)

**Step 1: Add stats bar to HTML**

Add after the filters section, before tasks section:

```html
<section class="stats-section">
  <div class="stats-grid" id="stats-grid">
    <div class="stat-card">
      <span class="stat-value" id="stat-total">0</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="stat-not-started">0</span>
      <span class="stat-label">Not Started</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="stat-in-progress">0</span>
      <span class="stat-label">In Progress</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="stat-done">0</span>
      <span class="stat-label">Done</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="stat-blocked">0</span>
      <span class="stat-label">Blocked</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="stat-critical">0</span>
      <span class="stat-label">Critical</span>
    </div>
  </div>
</section>
```

**Step 2: Add stats rendering function**

```javascript
function updateStats() {
  document.getElementById('stat-total').textContent = allTasks.length;
  document.getElementById('stat-not-started').textContent = allTasks.filter(t => t.status === 'Not Started').length;
  document.getElementById('stat-in-progress').textContent = allTasks.filter(t => t.status === 'In Progress').length;
  document.getElementById('stat-done').textContent = allTasks.filter(t => t.status === 'Done').length;
  document.getElementById('stat-blocked').textContent = allTasks.filter(t => t.status === 'Blocked').length;
  document.getElementById('stat-critical').textContent = allTasks.filter(t => t.priority === 'Critical').length;
}
```

Call `updateStats()` at the end of `loadTasks()` after `renderTasks()`.

**Step 3: Add stats CSS**

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--white-5);
  border: 1px solid var(--white-10);
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.stat-card:hover {
  border-color: var(--red-35);
  box-shadow: 0 0 20px var(--red-8);
}

.stat-value {
  display: block;
  font-family: 'Syne', sans-serif;
  font-size: 32px;
  font-weight: 800;
  color: var(--white-100);
}

.stat-label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--white-50);
  margin-top: 4px;
}
```

**Step 4: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js public/css/build-queue.css
git commit -m "feat: add stats summary bar with task counts by status"
```

---

### Task 13: Add Keyboard Shortcuts (F3)

**Files:**
- Modify: `public/js/build-queue.js`

**Step 1: Add keyboard shortcut handler**

```javascript
document.addEventListener('keydown', (e) => {
  // Don't trigger when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }

  switch (e.key) {
    case '/':
      e.preventDefault();
      searchInput.focus();
      break;
    case 'n':
      e.preventDefault();
      document.getElementById('add-manual-btn').click();
      break;
    case 'r':
      e.preventDefault();
      loadTasks();
      showToast('Tasks refreshed', 'info');
      break;
    case 'Escape':
      // Close any open modal
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      break;
    case '?':
      e.preventDefault();
      showToast('Shortcuts: / Search | N New task | R Refresh | Esc Close', 'info', 5000);
      break;
  }
});
```

**Step 2: Commit**

```bash
git add public/js/build-queue.js
git commit -m "feat: add keyboard shortcuts (/ search, N new, R refresh, Esc close)"
```

---

### Task 14: Add CSV Export (F5)

**Files:**
- Modify: `public/build-queue.html` (add export button)
- Modify: `public/js/build-queue.js` (add export function)

**Step 1: Add export button to header actions**

```html
<button id="export-btn" class="btn btn-secondary">📥 Export CSV</button>
```

**Step 2: Add export function in JS**

```javascript
document.getElementById('export-btn').addEventListener('click', () => {
  if (allTasks.length === 0) {
    showToast('No tasks to export', 'error');
    return;
  }

  const headers = ['ID', 'Task', 'Priority', 'Client', 'System', 'Status', 'Assigned To', 'Date Added', 'Notes'];
  const rows = allTasks.map(t => [
    t.id,
    `"${(t.task || '').replace(/"/g, '""')}"`,
    t.priority,
    t.client,
    t.system,
    t.status,
    t.assignedTo,
    t.dateAdded,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `build-queue-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Tasks exported to CSV', 'success');
});
```

**Step 3: Commit**

```bash
git add public/build-queue.html public/js/build-queue.js
git commit -m "feat: add CSV export for current task list"
```

---

### Phase 2C: Quality & Polish (Do Later)

---

### Task 15: Add Basic Tests (A1)

**Files:**
- Create: `tests/server.test.js`
- Create: `tests/googleSheets.test.js`
- Modify: `package.json` (add test script and jest dependency)

**Step 1: Install jest**

```bash
npm install --save-dev jest
```

**Step 2: Update package.json test script**

```json
"scripts": {
  "test": "jest --verbose"
}
```

**Step 3: Write server validation tests**

Create `tests/server.test.js`:

```javascript
const { validateTaskId } = require('../server');

describe('validateTaskId', () => {
  test('valid numeric ID returns true', () => {
    expect(validateTaskId('1')).toBe(true);
    expect(validateTaskId('42')).toBe(true);
    expect(validateTaskId('0')).toBe(true);
  });

  test('invalid IDs return false', () => {
    expect(validateTaskId('')).toBe(false);
    expect(validateTaskId('abc')).toBe(false);
    expect(validateTaskId('-1')).toBe(false);
    expect(validateTaskId('1.5')).toBe(false);
    expect(validateTaskId('1abc')).toBe(false);
  });
});
```

**Step 4: Export validateTaskId from server.js**

At the bottom of server.js:

```javascript
module.exports = { validateTaskId };
```

**Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add tests/ package.json server.js
git commit -m "test: add validation unit tests with jest"
```

---

### Task 16: Add Rate Limiting (A3)

**Files:**
- Modify: `server.js`
- Modify: `package.json`

**Step 1: Install express-rate-limit**

```bash
npm install express-rate-limit
```

**Step 2: Add rate limiter to server.js**

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api/', limiter);
```

**Step 3: Commit**

```bash
git add server.js package.json package-lock.json
git commit -m "feat: add API rate limiting (100 req/15min)"
```

---

### Task 17: Improve Mobile Responsiveness (U5)

**Files:**
- Modify: `public/css/build-queue.css`

**Step 1: Add comprehensive mobile styles**

```css
@media (max-width: 768px) {
  .container {
    padding: 12px;
  }

  header {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
  }

  header h1 {
    font-size: 22px;
  }

  .header-actions {
    width: 100%;
    justify-content: center;
  }

  .filters {
    flex-direction: column;
  }

  .filter-control {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Card layout instead of table on mobile */
  .tasks-table thead {
    display: none;
  }

  .tasks-table,
  .tasks-table tbody,
  .tasks-table tr,
  .tasks-table td {
    display: block;
    width: 100%;
  }

  .tasks-table tr {
    margin-bottom: 12px;
    background: var(--white-5);
    border: 1px solid var(--white-10);
    border-radius: 12px;
    padding: 12px;
  }

  .tasks-table td {
    padding: 4px 0;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tasks-table td::before {
    content: attr(data-label);
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--white-50);
    font-family: 'JetBrains Mono', monospace;
  }

  .modal-content {
    width: 95%;
    margin: 12px;
    max-height: 90vh;
  }

  .bulk-actions {
    flex-wrap: wrap;
  }
}
```

**Step 2: Add `data-label` attributes to TD elements in renderTasks()**

```javascript
const labels = ['', 'ID', 'Task', 'Priority', 'Client', 'System', 'Status', 'Assigned', 'Date', 'Actions'];
row.querySelectorAll('td').forEach((td, i) => {
  if (labels[i]) td.setAttribute('data-label', labels[i]);
});
```

**Step 3: Commit**

```bash
git add public/css/build-queue.css public/js/build-queue.js
git commit -m "feat: add mobile card layout for task table"
```

---

## IMPLEMENTATION ORDER

| Order | Task | Type | Time Est. | Dependencies |
|-------|------|------|-----------|--------------|
| 1 | Task 1: Fix Task ID Lookup | Bug fix | — | None |
| 2 | Task 2: Fix XSS | Security | — | None |
| 3 | Task 3: Input Validation | Security | — | None |
| 4 | Task 4: Fix CSS Bugs | Bug fix | — | None |
| 5 | Task 5: Notification Guard | Bug fix | — | None |
| 6 | Task 6: Error Handling | Bug fix | — | None |
| 7 | Task 7: Toast Notifications | Feature | — | Before Task 8+ |
| 8 | Task 8: Manual Task Creation | Feature | — | Task 7 |
| 9 | Task 9: Real-Time Search | Feature | — | None |
| 10 | Task 10: Bulk Operations | Feature | — | Task 1, 7 |
| 11 | Task 11: Column Sorting | Feature | — | None |
| 12 | Task 12: Stats Summary | Feature | — | None |
| 13 | Task 13: Keyboard Shortcuts | Feature | — | Task 8, 9 |
| 14 | Task 14: CSV Export | Feature | — | None |
| 15 | Task 15: Basic Tests | Quality | — | Task 3 |
| 16 | Task 16: Rate Limiting | Security | — | None |
| 17 | Task 17: Mobile Responsive | UX | — | Task 10, 11, 12 |

---

## FUTURE CONSIDERATIONS (Phase 3)

Not included in this plan, but worth noting for later:

- **Database migration** — Move from Google Sheets to SQLite/PostgreSQL when task count exceeds ~500
- **WebSocket real-time updates** — Live task changes without refresh
- **Task dependencies** — Block/unblock chains between tasks
- **Time tracking** — Start/stop timers per task
- **Recurring tasks** — Auto-create on schedule
- **User authentication** — Login system with role-based access
- **Audit log** — Track all changes with timestamps and who made them
- **File attachments** — Upload screenshots/docs to tasks
