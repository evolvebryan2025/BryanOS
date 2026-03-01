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
