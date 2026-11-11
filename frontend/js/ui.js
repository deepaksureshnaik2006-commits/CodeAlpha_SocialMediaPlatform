/**
 * ZYNTRA - UI Helpers & Interactions
 * Toast, Time formatting, Lucide icons, Modals, Heart animations.
 */

// Ensure toast container exists
function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// Show Toast notification
function showToast(message, type = 'info', duration = 3500) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="flex-shrink: 0; width: 18px; height: 18px;"></i>
    <div class="toast-message">${message}</div>
    <button style="color: var(--text-muted); padding: 2px;" onclick="this.parentElement.remove()">
      <i data-lucide="x" style="width: 14px; height: 14px;"></i>
    </button>
  `;

  container.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(80px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Format relative time (e.g. 5m, 2h, 3d)
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;

  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Default sleek user avatar silhouette (instant SVG data URI, no external network delay or block letter stamps)
const DEFAULT_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23312e81'/%3E%3Cstop offset='100%25' stop-color='%231e1b4b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23c7d2fe'/%3E%3Cpath d='M20 86c0-16.5 13.5-30 30-30s30 13.5 30 30z' fill='%23c7d2fe'/%3E%3C/svg%3E";

// Get avatar URL or sleek default avatar
function getAvatarUrl(user) {
  if (user?.profile_image && user.profile_image.trim()) {
    return user.profile_image;
  }
  return DEFAULT_AVATAR_DATA_URI;
}

// Render Lucide icons safely
function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Modal management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Heart burst animation on double click
function triggerHeartBurst(container) {
  let burst = container.querySelector('.heart-burst');
  if (!burst) {
    burst = document.createElement('div');
    burst.className = 'heart-burst';
    burst.innerHTML = `<i data-lucide="heart" style="width: 72px; height: 72px; fill: #ec4899; color: #ffffff;"></i>`;
    container.appendChild(burst);
    renderIcons();
  }

  burst.classList.remove('animate');
  void burst.offsetWidth; // force reflow
  burst.classList.add('animate');

  setTimeout(() => {
    burst.classList.remove('animate');
  }, 700);
}

// Check if media URL is a video/reel
function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url) || url.includes('/video/');
}

// Show UI-based Confirmation Dialog (Returns Promise<boolean>)
function confirmModal(options = {}) {
  return new Promise((resolve) => {
    const config = typeof options === 'string' ? { message: options } : options;
    const isDelete = config.message && config.message.toLowerCase().includes('delete');
    const isLogout = config.message && (config.message.toLowerCase().includes('sign out') || config.message.toLowerCase().includes('log out'));
    const isUnfollow = config.message && config.message.toLowerCase().includes('unfollow');

    const defaultTitle = isDelete ? 'Confirm Deletion' : (isLogout ? 'Log Out Everywhere?' : (isUnfollow ? 'Unfollow Creator?' : 'Are you sure?'));
    const defaultIcon = isDelete ? 'trash-2' : (isLogout ? 'shield-off' : (isUnfollow ? 'user-minus' : (config.danger ? 'alert-triangle' : 'help-circle')));
    const defaultConfirmText = isDelete ? 'Delete' : (isLogout ? 'Log Out' : (isUnfollow ? 'Unfollow' : 'Confirm'));

    const {
      title = defaultTitle,
      message = 'This action cannot be undone.',
      confirmText = defaultConfirmText,
      cancelText = 'Cancel',
      danger = (isDelete || isLogout || isUnfollow) ? true : Boolean(config.danger),
      icon = defaultIcon
    } = config;

    // Remove any existing confirm modal
    const existing = document.getElementById('zyntra-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'zyntra-confirm-modal';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '99999';

    const iconColor = danger ? 'var(--danger)' : 'var(--primary)';
    const iconBg = danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)';
    const confirmBtnClass = danger ? 'btn btn-danger' : 'btn btn-primary';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 420px; text-align: center; padding: 28px 24px; animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <i data-lucide="${icon}" style="width: 28px; height: 28px;"></i>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">${title}</h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button type="button" class="btn btn-secondary" id="confirm-cancel-btn" style="flex: 1; padding: 11px;">${cancelText}</button>
          <button type="button" class="${confirmBtnClass}" id="confirm-ok-btn" style="flex: 1; padding: 11px;">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderIcons();

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    const cleanup = (result) => {
      overlay.classList.remove('active');
      document.removeEventListener('keydown', handleKeyDown);
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    document.addEventListener('keydown', handleKeyDown);

    overlay.querySelector('#confirm-ok-btn').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#confirm-cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

// Show UI-based Prompt Dialog (Returns Promise<string | null>)
function promptModal(options = {}) {
  return new Promise((resolve) => {
    const config = typeof options === 'string' ? { message: options } : options;
    const isDelete = config.message && config.message.toLowerCase().includes('delete');
    const {
      title = isDelete ? 'Verification Required' : 'Input Required',
      message = '',
      placeholder = isDelete ? 'Type DELETE to confirm' : '',
      defaultValue = '',
      confirmText = isDelete ? 'Confirm' : 'Submit',
      cancelText = 'Cancel',
      danger = isDelete,
      inputType = 'text'
    } = config;

    const existing = document.getElementById('zyntra-prompt-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'zyntra-prompt-modal';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '99999';

    const confirmBtnClass = danger ? 'btn btn-danger' : 'btn btn-primary';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 440px; padding: 24px; animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${title}</h3>
        ${message ? `<p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">${message}</p>` : ''}
        <div style="margin-bottom: 20px;">
          <input type="${inputType}" class="form-input" id="prompt-input" placeholder="${placeholder}" value="${defaultValue}" style="width: 100%;" autocomplete="off">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="prompt-cancel-btn" style="min-width: 90px;">${cancelText}</button>
          <button type="button" class="${confirmBtnClass}" id="prompt-ok-btn" style="min-width: 100px;">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderIcons();

    const input = overlay.querySelector('#prompt-input');
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      if (input) {
        input.focus();
        input.select();
      }
    });

    const cleanup = (val) => {
      overlay.classList.remove('active');
      document.removeEventListener('keydown', handleKeyDown);
      setTimeout(() => overlay.remove(), 200);
      resolve(val);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(null);
      if (e.key === 'Enter') cleanup(input ? input.value : '');
    };

    document.addEventListener('keydown', handleKeyDown);

    overlay.querySelector('#prompt-ok-btn').addEventListener('click', () => cleanup(input ? input.value : ''));
    overlay.querySelector('#prompt-cancel-btn').addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });
  });
}

window.UI = {
  showToast,
  formatTimeAgo,
  getAvatarUrl,
  renderIcons,
  openModal,
  closeModal,
  confirm: confirmModal,
  prompt: promptModal,
  triggerHeartBurst,
  isVideoUrl
};

// Global overrides to completely intercept any native browser popups ("localhost:5000 says") with custom UI modals
window.alert = function(msg) {
  window.UI.showToast(msg || '', 'info');
};

window.confirm = function(msg) {
  return window.UI.confirm(msg);
};

window.prompt = function(msg, defaultVal) {
  return window.UI.prompt({ message: msg, defaultValue: defaultVal || '' });
};

