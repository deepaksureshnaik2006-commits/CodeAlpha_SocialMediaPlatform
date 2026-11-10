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

// Get fallback avatar if no image set
function getAvatarUrl(user) {
  if (user?.profile_image && user.profile_image.trim()) {
    return user.profile_image;
  }
  const name = user?.full_name || user?.username || 'Zyntra User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=ffffff&bold=true`;
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

window.UI = {
  showToast,
  formatTimeAgo,
  getAvatarUrl,
  renderIcons,
  openModal,
  closeModal,
  triggerHeartBurst
};

