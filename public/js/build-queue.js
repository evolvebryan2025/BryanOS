// Global state
let allTasks = [];
let clients = [];
let teamMembers = [];
let currentParsedTasks = null;
let selectedTaskIds = new Set();
let sortColumn = null;
let sortDirection = 'asc';
let currentView = 'table';
let draggedTaskId = null;

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

// Kanban elements
const kanbanContainer = document.getElementById('kanban-container');
const tasksTableContainer = document.getElementById('tasks-table-container');
const viewTableBtn = document.getElementById('view-table-btn');
const viewKanbanBtn = document.getElementById('view-kanban-btn');

// Filter elements
const filterClient = document.getElementById('filter-client');
const filterStatus = document.getElementById('filter-status');
const filterAssignee = document.getElementById('filter-assignee');
const filterPriority = document.getElementById('filter-priority');

// Toast notification system
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

  // Add special options after API clients
  const potentialOpt = document.createElement('option');
  potentialOpt.value = 'Potential Client';
  potentialOpt.textContent = 'Potential Client';
  clientSelect.appendChild(potentialOpt);

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Add New Client';
  clientSelect.appendChild(customOpt);
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
  renderCurrentView();
}

function updateStats() {
  document.getElementById('stat-total').textContent = allTasks.length;
  document.getElementById('stat-not-started').textContent = allTasks.filter(t => t.status === 'Not Started').length;
  document.getElementById('stat-in-progress').textContent = allTasks.filter(t => t.status === 'In Progress').length;
  document.getElementById('stat-done').textContent = allTasks.filter(t => t.status === 'Done').length;
  document.getElementById('stat-blocked').textContent = allTasks.filter(t => t.status === 'Blocked').length;
  document.getElementById('stat-critical').textContent = allTasks.filter(t => t.priority === 'Critical').length;
}

async function processTranscript() {
  const transcript = transcriptInput.value.trim();
  let client = clientSelect.value;

  // Check if custom client was selected
  if (client === '__custom__') {
    const customClient = document.getElementById('custom-client').value.trim();
    if (!customClient) {
      showToast('Please enter a client name', 'error');
      return;
    }
    client = customClient;
  }

  if (!transcript) {
    showToast('Please paste a meeting transcript', 'error');
    return;
  }

  if (!client || client === '__custom__') {
    showToast('Please select or enter a client name', 'error');
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
    showToast('Error processing transcript: ' + error.message, 'error');
  }
}

async function createTasks() {
  if (!currentParsedTasks || currentParsedTasks.length === 0) {
    showToast('No tasks to create', 'error');
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

    showToast(`Successfully created ${currentParsedTasks.length} tasks!`, 'success');

    // Reset form
    transcriptInput.value = '';
    clientSelect.value = '';
    aiOutput.classList.add('hidden');
    currentParsedTasks = null;

    // Reload tasks
    await loadTasks();
  } catch (error) {
    showToast('Error creating tasks: ' + error.message, 'error');
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

    showToast('Task updated successfully!', 'success');
    taskModal.classList.add('hidden');
    await loadTasks();
  } catch (error) {
    showToast('Error updating task: ' + error.message, 'error');
  }
}

// Shared filter logic for table and kanban
function getFilteredTasks() {
  let filtered = allTasks;
  const searchInput = document.getElementById('search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (query) {
    filtered = filtered.filter(task =>
      (task.task || '').toLowerCase().includes(query) ||
      (task.client || '').toLowerCase().includes(query) ||
      (task.assignedTo || '').toLowerCase().includes(query) ||
      (task.system || '').toLowerCase().includes(query) ||
      (task.notes || '').toLowerCase().includes(query)
    );
  }

  return filtered;
}

function renderCurrentView() {
  if (currentView === 'kanban') {
    renderKanban();
  } else {
    renderTasks();
  }
  updateStats();
}

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
  const filtered = getFilteredTasks();

  if (filtered.length === 0) {
    tasksTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;">No tasks found</td></tr>';
    return;
  }

  filtered.forEach(task => {
    const row = document.createElement('tr');
    row.dataset.taskId = task.id;

    row.innerHTML = `
      <td><input type="checkbox" class="task-checkbox" data-task-id="${task.id}" title="Select task ${task.id}" ${selectedTaskIds.has(task.id) ? 'checked' : ''}></td>
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

    // Add data-label attributes for mobile card layout
    const labels = ['', 'ID', 'Task', 'Priority', 'Client', 'System', 'Status', 'Assigned', 'Date', 'Actions'];
    row.querySelectorAll('td').forEach((td, i) => {
      if (labels[i]) td.setAttribute('data-label', labels[i]);
    });

    tasksTableBody.appendChild(row);
  });
}

function openTaskModal(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('modal-task-title').textContent = task.task;

  let detailsHtml = `
    <p><strong>Client:</strong> ${escapeHtml(task.client)}</p>
    <p><strong>System:</strong> ${escapeHtml(task.system)}</p>
    <p><strong>Priority:</strong> <span class="priority-badge priority-${escapeHtml(task.priority.toLowerCase())}">${escapeHtml(task.priority)}</span></p>
    <p><strong>Current Status:</strong> ${escapeHtml(task.status)}</p>
    <p><strong>Currently Assigned To:</strong> ${escapeHtml(task.assignedTo)}</p>
    <p><strong>Date Added:</strong> ${escapeHtml(task.dateAdded)}</p>
  `;

  if (task.timestamp) {
    detailsHtml += `<p><strong>Meeting Timestamp:</strong> ${escapeHtml(task.timestamp)}</p>`;
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

async function deleteTask(taskId, taskPreview) {
  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete this task?\n\n"${taskPreview}"\n\nThis action cannot be undone.`);

  if (!confirmed) return;

  try {
    await apiCall(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });

    // Remove from local array
    allTasks = allTasks.filter(t => t.id !== taskId);

    // Re-render current view
    renderCurrentView();

    showToast('Task deleted successfully', 'success');
  } catch (error) {
    showToast('Failed to delete task: ' + error.message, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Column sorting
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

  renderCurrentView();

  document.querySelectorAll('.tasks-table th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === column) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

document.querySelector('.tasks-table thead').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]');
  if (th) sortTasks(th.dataset.sort);
});

// Event delegation for task table buttons
document.getElementById('tasks-tbody').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');

  if (editBtn) {
    openTaskModal(editBtn.dataset.taskId);
  } else if (deleteBtn) {
    deleteTask(deleteBtn.dataset.taskId, deleteBtn.dataset.taskPreview);
  }
});

// Event listeners
// Handle custom client input
clientSelect.addEventListener('change', function() {
  const customClientInput = document.getElementById('custom-client-input');
  const customClientField = document.getElementById('custom-client');

  if (this.value === '__custom__') {
    customClientInput.classList.remove('hidden');
    customClientField.focus();
  } else {
    customClientInput.classList.add('hidden');
    customClientField.value = '';
  }
});

processBtn.addEventListener('click', processTranscript);
confirmTasksBtn.addEventListener('click', createTasks);
retryBtn.addEventListener('click', () => {
  aiOutput.classList.add('hidden');
  currentParsedTasks = null;
});

refreshBtn.addEventListener('click', loadTasks);
document.getElementById('search-input').addEventListener('input', renderCurrentView);

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

// Bulk operations
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

document.getElementById('bulk-deselect-btn').addEventListener('click', () => {
  selectedTaskIds.clear();
  document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('select-all-checkbox').checked = false;
  updateBulkBar();
});

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
    document.getElementById('select-all-checkbox').checked = false;
    updateBulkBar();
    await loadTasks();
  } catch (error) {
    showToast('Bulk delete failed: ' + error.message, 'error');
  }
});

document.getElementById('bulk-status-btn').addEventListener('click', async () => {
  if (selectedTaskIds.size === 0) return;
  const newStatus = prompt('Enter new status (Not Started, In Progress, Done, QA, Blocked):');
  if (!newStatus) return;

  const valid = ['Not Started', 'In Progress', 'Done', 'QA', 'Blocked'];
  if (!valid.includes(newStatus)) {
    showToast('Invalid status. Use: ' + valid.join(', '), 'error');
    return;
  }

  try {
    for (const taskId of selectedTaskIds) {
      await apiCall(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    }
    showToast(`${selectedTaskIds.size} task(s) updated to "${newStatus}"`, 'success');
    selectedTaskIds.clear();
    document.getElementById('select-all-checkbox').checked = false;
    updateBulkBar();
    await loadTasks();
  } catch (error) {
    showToast('Bulk status update failed: ' + error.message, 'error');
  }
});

document.getElementById('bulk-assign-btn').addEventListener('click', async () => {
  if (selectedTaskIds.size === 0) return;
  const names = teamMembers.map(m => m.name).join(', ');
  const assignee = prompt(`Reassign to (${names}):`);
  if (!assignee) return;

  try {
    for (const taskId of selectedTaskIds) {
      await apiCall(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedTo: assignee }),
      });
    }
    showToast(`${selectedTaskIds.size} task(s) reassigned to "${assignee}"`, 'success');
    selectedTaskIds.clear();
    document.getElementById('select-all-checkbox').checked = false;
    updateBulkBar();
    await loadTasks();
  } catch (error) {
    showToast('Bulk reassign failed: ' + error.message, 'error');
  }
});

// Manual task creation
document.getElementById('add-manual-btn').addEventListener('click', () => {
  const modal = document.getElementById('manual-task-modal');
  const manualClientSelect = document.getElementById('manual-task-client');

  manualClientSelect.innerHTML = '';
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    manualClientSelect.appendChild(opt);
  });

  // Add Potential Client option
  const potentialOpt = document.createElement('option');
  potentialOpt.value = 'Potential Client';
  potentialOpt.textContent = 'Potential Client';
  manualClientSelect.appendChild(potentialOpt);

  // Add custom client option
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Add New Client';
  manualClientSelect.appendChild(customOpt);

  modal.classList.remove('hidden');
});

document.querySelector('.manual-modal-close').addEventListener('click', () => {
  document.getElementById('manual-task-modal').classList.add('hidden');
});

// Toggle custom client input in manual task modal
document.getElementById('manual-task-client').addEventListener('change', function() {
  const customInput = document.getElementById('manual-custom-client-input');
  const customField = document.getElementById('manual-custom-client');
  if (this.value === '__custom__') {
    customInput.classList.remove('hidden');
    customField.focus();
  } else {
    customInput.classList.add('hidden');
    customField.value = '';
  }
});

document.getElementById('manual-task-submit').addEventListener('click', async () => {
  const title = document.getElementById('manual-task-title').value.trim();
  let client = document.getElementById('manual-task-client').value;

  // Handle custom client
  if (client === '__custom__') {
    const customClient = document.getElementById('manual-custom-client').value.trim();
    if (!customClient) {
      showToast('Please enter a client name', 'error');
      return;
    }
    client = customClient;
  }
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
    document.getElementById('manual-custom-client').value = '';
    document.getElementById('manual-custom-client-input').classList.add('hidden');
    await loadTasks();
  } catch (error) {
    showToast('Failed to create task: ' + error.message, 'error');
  }
});

document.getElementById('manual-task-modal').addEventListener('click', (e) => {
  if (e.target.id === 'manual-task-modal') {
    e.target.classList.add('hidden');
  }
});

// Close modal on outside click
taskModal.addEventListener('click', (e) => {
  if (e.target === taskModal) {
    taskModal.classList.add('hidden');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }

  switch (e.key) {
    case '/':
      e.preventDefault();
      document.getElementById('search-input').focus();
      break;
    case 'n':
      e.preventDefault();
      document.getElementById('add-manual-btn').click();
      break;
    case 'r':
      e.preventDefault();
      loadTasks();
      showToast('Tasks refreshed', 'success');
      break;
    case 'k':
      e.preventDefault();
      switchView(currentView === 'table' ? 'kanban' : 'table');
      showToast(`Switched to ${currentView} view`, 'info');
      break;
    case 'Escape':
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      break;
    case '?':
      e.preventDefault();
      showToast('Shortcuts: / Search | N New | R Refresh | K Toggle view | Esc Close', 'info', 5000);
      break;
  }
});

// ========== KANBAN BOARD ==========

const KANBAN_STATUSES = [
  { key: 'Not Started', label: 'Not Started' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'QA', label: 'QA' },
  { key: 'Done', label: 'Done' },
  { key: 'Blocked', label: 'Blocked' },
];

function switchView(view) {
  currentView = view;

  if (view === 'table') {
    tasksTableContainer.classList.remove('hidden');
    kanbanContainer.classList.add('hidden');
    viewTableBtn.classList.add('active');
    viewKanbanBtn.classList.remove('active');
  } else {
    tasksTableContainer.classList.add('hidden');
    kanbanContainer.classList.remove('hidden');
    viewTableBtn.classList.remove('active');
    viewKanbanBtn.classList.add('active');
    document.getElementById('bulk-actions').classList.add('hidden');
    renderKanban();
  }

  localStorage.setItem('buildQueueView', view);
}

viewTableBtn.addEventListener('click', () => switchView('table'));
viewKanbanBtn.addEventListener('click', () => switchView('kanban'));

function renderKanban() {
  const filtered = getFilteredTasks();

  // Group tasks by status
  const grouped = {};
  KANBAN_STATUSES.forEach(s => { grouped[s.key] = []; });
  filtered.forEach(task => {
    const status = task.status || 'Not Started';
    if (grouped[status]) {
      grouped[status].push(task);
    } else {
      grouped['Not Started'].push(task);
    }
  });

  let html = '<div class="kanban-board">';

  KANBAN_STATUSES.forEach(statusDef => {
    const tasks = grouped[statusDef.key];
    const statusClass = statusDef.key.toLowerCase().replace(/\s+/g, '-');

    html += `
      <div class="kanban-column" data-status="${statusDef.key}">
        <div class="kanban-column-header kanban-header-${statusClass}">
          <span class="kanban-column-title">${statusDef.label}</span>
          <span class="kanban-column-count">${tasks.length}</span>
        </div>
        <div class="kanban-column-body" data-status="${statusDef.key}">`;

    tasks.forEach(task => {
      const priorityClass = (task.priority || 'medium').toLowerCase();
      html += `
          <div class="kanban-card" draggable="true" data-task-id="${task.id}">
            <div class="kanban-card-priority-bar priority-${priorityClass}"></div>
            <div class="kanban-card-content">
              <div class="kanban-card-title">${escapeHtml(task.task)}</div>
              <div class="kanban-card-meta">
                <span class="kanban-card-badge">${escapeHtml(task.client)}</span>
                <span class="kanban-card-badge">${escapeHtml(task.system)}</span>
              </div>
              <div class="kanban-card-footer">
                <span class="kanban-card-assignee">${escapeHtml(task.assignedTo)}</span>
                <span class="priority-badge priority-${priorityClass}">${task.priority}</span>
              </div>
            </div>
          </div>`;
    });

    if (tasks.length === 0) {
      html += '<div class="kanban-empty">No tasks</div>';
    }

    html += `
        </div>
      </div>`;
  });

  html += '</div>';
  kanbanContainer.innerHTML = html;

  initKanbanDragDrop();
}

// Drag-and-Drop
function initKanbanDragDrop() {
  const cards = kanbanContainer.querySelectorAll('.kanban-card');
  const columnBodies = kanbanContainer.querySelectorAll('.kanban-column-body');

  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });

  columnBodies.forEach(col => {
    col.addEventListener('dragover', handleDragOver);
    col.addEventListener('dragenter', handleDragEnter);
    col.addEventListener('dragleave', handleDragLeave);
    col.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  draggedTaskId = this.dataset.taskId;
  this.classList.add('kanban-card--dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedTaskId);

  requestAnimationFrame(() => {
    this.style.opacity = '0.4';
  });
}

function handleDragEnd() {
  this.classList.remove('kanban-card--dragging');
  this.style.opacity = '';

  kanbanContainer.querySelectorAll('.kanban-column-body').forEach(col => {
    col.classList.remove('kanban-column-body--drag-over');
  });

  draggedTaskId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('kanban-column-body--drag-over');
}

function handleDragLeave(e) {
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('kanban-column-body--drag-over');
  }
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('kanban-column-body--drag-over');

  const newStatus = this.dataset.status;
  const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;

  if (!taskId || !newStatus) return;

  const task = allTasks.find(t => String(t.id) === String(taskId));
  if (!task || task.status === newStatus) return;

  const oldStatus = task.status;

  // Optimistic UI update
  task.status = newStatus;
  renderKanban();
  updateStats();

  try {
    await apiCall(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, updatedBy: 'Bryan' }),
    });
    showToast(`Moved to "${newStatus}"`, 'success');
  } catch (error) {
    // Rollback on failure
    task.status = oldStatus;
    renderKanban();
    updateStats();
    showToast('Failed to update: ' + error.message, 'error');
  }
}

// Kanban card click → open edit modal
kanbanContainer.addEventListener('click', (e) => {
  const card = e.target.closest('.kanban-card');
  if (card) {
    openTaskModal(card.dataset.taskId);
  }
});

// CSV Export
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

// Initialize on page load
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
    showToast(`Some data failed to load: ${errors.join(', ')}`, 'error', 5000);
  }

  // Restore saved view preference
  const savedView = localStorage.getItem('buildQueueView');
  if (savedView === 'kanban') {
    switchView('kanban');
  }
}

init();
