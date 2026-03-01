// State
let contacts = [];
let generatedMessages = [];
let copiedSet = new Set();
let currentPitch = '';
let currentOffer = '';
let currentSender = '';

// DOM elements
const pitchInput = document.getElementById('pitch-input');
const offerInput = document.getElementById('offer-input');
const senderInput = document.getElementById('sender-input');
const contactsTbody = document.getElementById('contacts-tbody');
const contactCount = document.getElementById('contact-count');
const addContactBtn = document.getElementById('add-contact-btn');
const generateBtn = document.getElementById('generate-btn');
const processingSpinner = document.getElementById('processing-spinner');
const messagesSection = document.getElementById('messages-section');
const messagesContainer = document.getElementById('messages-container');
const progressBadge = document.getElementById('progress-badge');
const progressBar = document.getElementById('progress-bar');

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

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add a contact row
function addContact(name = '', relationship = 'Past Client', platform = 'WhatsApp') {
  if (contacts.length >= 10) {
    showToast('Maximum 10 contacts', 'error');
    return;
  }

  const id = Date.now() + Math.random();
  contacts.push({ id, name, relationship, platform });
  renderContacts();
}

// Remove a contact
function removeContact(id) {
  contacts = contacts.filter(c => c.id !== id);
  renderContacts();
}

// Render contact rows
function renderContacts() {
  contactsTbody.innerHTML = '';

  contacts.forEach((contact, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="#">${index + 1}</td>
      <td data-label="Name">
        <input type="text" value="${escapeHtml(contact.name)}" placeholder="Contact name" data-id="${contact.id}" data-field="name">
      </td>
      <td data-label="Relationship">
        <select data-id="${contact.id}" data-field="relationship">
          <option value="Past Client" ${contact.relationship === 'Past Client' ? 'selected' : ''}>Past Client</option>
          <option value="Partner" ${contact.relationship === 'Partner' ? 'selected' : ''}>Partner</option>
          <option value="Colleague" ${contact.relationship === 'Colleague' ? 'selected' : ''}>Colleague</option>
          <option value="Friend" ${contact.relationship === 'Friend' ? 'selected' : ''}>Friend</option>
          <option value="Industry Contact" ${contact.relationship === 'Industry Contact' ? 'selected' : ''}>Industry Contact</option>
          <option value="Mentor" ${contact.relationship === 'Mentor' ? 'selected' : ''}>Mentor</option>
        </select>
      </td>
      <td data-label="Platform">
        <select data-id="${contact.id}" data-field="platform">
          <option value="WhatsApp" ${contact.platform === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
          <option value="Email" ${contact.platform === 'Email' ? 'selected' : ''}>Email</option>
          <option value="LinkedIn" ${contact.platform === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
          <option value="SMS" ${contact.platform === 'SMS' ? 'selected' : ''}>SMS</option>
          <option value="Instagram DM" ${contact.platform === 'Instagram DM' ? 'selected' : ''}>Instagram DM</option>
        </select>
      </td>
      <td>
        <button class="btn btn-danger btn-sm remove-contact-btn" data-id="${contact.id}" title="Remove">&times;</button>
      </td>
    `;
    contactsTbody.appendChild(row);
  });

  contactCount.textContent = `${contacts.length} / 10`;
  addContactBtn.disabled = contacts.length >= 10;
}

// Sync contact data from table inputs
function syncContact(id, field, value) {
  const contact = contacts.find(c => c.id === id);
  if (contact) {
    contact[field] = value;
  }
}

// Event delegation for contact table
contactsTbody.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.id && el.dataset.field) {
    syncContact(parseFloat(el.dataset.id), el.dataset.field, el.value);
  }
});

contactsTbody.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.id && el.dataset.field) {
    syncContact(parseFloat(el.dataset.id), el.dataset.field, el.value);
  }
});

contactsTbody.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.remove-contact-btn');
  if (removeBtn) {
    removeContact(parseFloat(removeBtn.dataset.id));
  }
});

// Add contact button
addContactBtn.addEventListener('click', () => addContact());

// Generate messages
generateBtn.addEventListener('click', async () => {
  // Sync all inputs first
  const inputs = contactsTbody.querySelectorAll('input, select');
  inputs.forEach(el => {
    if (el.dataset.id && el.dataset.field) {
      syncContact(parseFloat(el.dataset.id), el.dataset.field, el.value);
    }
  });

  const pitch = pitchInput.value.trim();
  const offer = offerInput.value.trim();
  const senderName = senderInput.value.trim() || 'Bryan';

  if (!pitch) {
    showToast('Please describe what service you\'re pitching', 'error');
    pitchInput.focus();
    return;
  }

  // Validate contacts
  const validContacts = contacts.filter(c => c.name.trim());
  if (validContacts.length === 0) {
    showToast('Add at least one contact with a name', 'error');
    return;
  }

  // Store for regeneration
  currentPitch = pitch;
  currentOffer = offer;
  currentSender = senderName;

  // Show spinner
  processingSpinner.classList.remove('hidden');
  messagesSection.classList.add('hidden');
  generateBtn.disabled = true;

  try {
    const response = await fetch('/api/generate-referral-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: validContacts.map(c => ({
          name: c.name.trim(),
          relationship: c.relationship,
          platform: c.platform,
        })),
        pitch,
        offer,
        senderName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate messages');
    }

    generatedMessages = data.messages;
    copiedSet.clear();
    renderMessages();

    processingSpinner.classList.add('hidden');
    messagesSection.classList.remove('hidden');

    showToast(`Generated ${generatedMessages.length} messages!`, 'success');
  } catch (error) {
    processingSpinner.classList.add('hidden');
    showToast('Error: ' + error.message, 'error', 5000);
  } finally {
    generateBtn.disabled = false;
  }
});

// Render message cards
function renderMessages() {
  messagesContainer.innerHTML = '';

  generatedMessages.forEach((msg, index) => {
    const isCopied = copiedSet.has(index);
    const card = document.createElement('div');
    card.className = `message-card${isCopied ? ' copied' : ''}`;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="message-card-header">
        <div class="message-card-info">
          <span class="message-card-name">${escapeHtml(msg.name)}</span>
          <span class="message-card-platform">${escapeHtml(msg.platform)}</span>
        </div>
        <span class="message-card-status${isCopied ? ' copied' : ''}">${isCopied ? 'Copied' : 'Pending'}</span>
      </div>
      <div class="message-card-body">
        <div class="message-text">${escapeHtml(msg.message)}</div>
      </div>
      <div class="message-card-actions">
        <button class="btn btn-copy btn-sm${isCopied ? ' copied' : ''}" data-index="${index}">
          ${isCopied ? 'Copied' : 'Copy Message'}
        </button>
        <button class="btn btn-regen btn-sm" data-index="${index}">Regenerate</button>
      </div>
    `;

    messagesContainer.appendChild(card);
  });

  updateProgress();
}

// Update progress bar
function updateProgress() {
  const total = generatedMessages.length;
  const copied = copiedSet.size;
  const percent = total > 0 ? (copied / total) * 100 : 0;

  progressBadge.textContent = `${copied} / ${total} copied`;
  progressBar.style.width = `${percent}%`;

  if (copied === total && total > 0) {
    progressBadge.classList.add('all-copied');
    progressBar.classList.add('complete');
  } else {
    progressBadge.classList.remove('all-copied');
    progressBar.classList.remove('complete');
  }
}

// Copy message to clipboard
async function copyMessage(index) {
  const msg = generatedMessages[index];
  if (!msg) return;

  try {
    await navigator.clipboard.writeText(msg.message);
    copiedSet.add(index);
    renderMessages();
    showToast(`Copied message for ${msg.name}!`, 'success');
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = msg.message;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    copiedSet.add(index);
    renderMessages();
    showToast(`Copied message for ${msg.name}!`, 'success');
  }
}

// Regenerate a single message
async function regenerateMessage(index) {
  const msg = generatedMessages[index];
  if (!msg) return;

  const contact = contacts.find(c => c.name.trim() === msg.name);
  if (!contact) {
    showToast('Contact not found for regeneration', 'error');
    return;
  }

  // Show loading state on the card
  const card = messagesContainer.querySelector(`[data-index="${index}"]`);
  const regenBtn = card.querySelector('.btn-regen');
  regenBtn.disabled = true;
  regenBtn.textContent = 'Generating...';

  try {
    const response = await fetch('/api/regenerate-referral-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact: {
          name: contact.name.trim(),
          relationship: contact.relationship,
          platform: contact.platform,
        },
        pitch: currentPitch,
        offer: currentOffer,
        senderName: currentSender,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to regenerate message');
    }

    generatedMessages[index] = data.message;
    copiedSet.delete(index);
    renderMessages();

    showToast(`New message generated for ${msg.name}`, 'success');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
    regenBtn.disabled = false;
    regenBtn.textContent = 'Regenerate';
  }
}

// Event delegation for message actions
messagesContainer.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.btn-copy');
  const regenBtn = e.target.closest('.btn-regen');

  if (copyBtn) {
    copyMessage(parseInt(copyBtn.dataset.index));
  } else if (regenBtn) {
    regenerateMessage(parseInt(regenBtn.dataset.index));
  }
});

// Initialize with 3 empty contact rows
function init() {
  for (let i = 0; i < 3; i++) {
    addContact();
  }
}

init();
