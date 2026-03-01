// ═══════════════════════════════════════
// TEAM HUB — INTERACTIVITY
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSopAccordion();
  initCopyButtons();
  initMobileMenu();
});

// ═══════════════════════════════════════
// SIDEBAR NAVIGATION
// ═══════════════════════════════════════
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[data-section]');
  const sections = document.querySelectorAll('.content-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.section;

      // Update active nav
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show target section
      sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.add('active');
      }

      // Close mobile sidebar
      closeMobileSidebar();

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Handle hash on load
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const link = document.querySelector(`.nav-link[data-section="${hash}"]`);
    if (link) link.click();
  }
}

// ═══════════════════════════════════════
// SOP ACCORDION
// ═══════════════════════════════════════
function initSopAccordion() {
  const sopHeaders = document.querySelectorAll('.sop-header');

  sopHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sopItem = header.parentElement;
      const isOpen = sopItem.classList.contains('open');

      // Close all others
      document.querySelectorAll('.sop-item').forEach(item => {
        item.classList.remove('open');
      });

      // Toggle current
      if (!isOpen) {
        sopItem.classList.add('open');
      }
    });
  });
}

// ═══════════════════════════════════════
// COPY BUTTONS
// ═══════════════════════════════════════
function initCopyButtons() {
  // Main handoff copy button
  const copyHandoff = document.getElementById('copy-handoff');
  if (copyHandoff) {
    copyHandoff.addEventListener('click', () => {
      const template = document.getElementById('handoff-template');
      copyToClipboard(template.textContent, copyHandoff);
    });
  }

  // SOP template copy buttons
  const copyBtns = document.querySelectorAll('.copy-btn-sm[data-copy]');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pre = btn.previousElementSibling;
      if (pre) {
        copyToClipboard(pre.textContent, btn);
      }
    });
  });
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// ═══════════════════════════════════════
// MOBILE MENU
// ═══════════════════════════════════════
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }

  overlay.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape closes mobile sidebar
  if (e.key === 'Escape') {
    closeMobileSidebar();
    // Close any open SOPs
    document.querySelectorAll('.sop-item.open').forEach(item => {
      item.classList.remove('open');
    });
  }

  // Number keys for quick nav (1-6)
  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    const sectionMap = {
      '1': 'assignments',
      '2': 'task-flow',
      '3': 'build-queue-guide',
      '4': 'communication',
      '5': 'roles',
      '6': 'sops',
    };

    // Only if not typing in an input
    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      const section = sectionMap[e.key];
      if (section) {
        const link = document.querySelector(`.nav-link[data-section="${section}"]`);
        if (link) link.click();
      }
    }
  }
});
