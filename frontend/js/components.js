/**
 * ZYNTRA - Reusable UI Components
 * Navigation Sidebar, Mobile Nav, Post Cards, Likes Modal, Post Editing.
 */

const Components = {
  // Render Desktop & Mobile Navigation
  async renderNavigation(activePage = 'feed') {
    const user = await window.Auth.getCurrentUser();
    const avatarUrl = window.UI.getAvatarUrl(user);
    const username = user?.username || 'user';
    const fullName = user?.full_name || 'ZYNTRA User';

    // Get unread notification count
    let unreadCount = 0;
    try {
      const notifRes = await window.API.get('/api/notifications/unread-count');
      if (notifRes.success) unreadCount = notifRes.unread_count || 0;
    } catch (e) {}

    const unreadBadgeHtml = unreadCount > 0 ? `<span class="nav-badge">${unreadCount}</span>` : '';

    // 1. Desktop Sidebar HTML
    const sidebarHtml = `
      <aside class="app-sidebar">
        <a href="/feed" class="sidebar-logo">
          <div class="logo-icon">Z</div>
          <span class="logo-text">ZYNTRA</span>
        </a>

        <nav class="sidebar-nav">
          <a href="/feed" class="nav-link ${activePage === 'feed' ? 'active' : ''}">
            <i data-lucide="home"></i>
            <span>Feed</span>
          </a>
          <a href="/explore" class="nav-link ${activePage === 'explore' ? 'active' : ''}">
            <i data-lucide="compass"></i>
            <span>Explore</span>
          </a>
          <a href="/explore?tab=reels" class="nav-link ${activePage === 'reels' ? 'active' : ''}">
            <i data-lucide="clapperboard"></i>
            <span>Reels</span>
          </a>
          <a href="/create-post" class="nav-link ${activePage === 'create-post' ? 'active' : ''}">
            <i data-lucide="plus-square"></i>
            <span>Create</span>
          </a>
          <a href="/notifications" class="nav-link ${activePage === 'notifications' ? 'active' : ''}">
            <i data-lucide="bell"></i>
            <span>Notifications</span>
            ${unreadBadgeHtml}
          </a>
          <a href="/profile" class="nav-link ${activePage === 'profile' ? 'active' : ''}">
            <i data-lucide="user"></i>
            <span>Profile</span>
          </a>
          <a href="/settings" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
            <i data-lucide="settings"></i>
            <span>Settings</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <a href="/profile" class="user-mini-card">
            <img src="${avatarUrl}" alt="${username}" class="user-mini-avatar">
            <div class="user-mini-info">
              <div class="user-mini-name truncate">${fullName}</div>
              <div class="user-mini-handle truncate">@${username}</div>
            </div>
          </a>
          <button class="btn btn-secondary btn-sm" onclick="window.Auth.signOut()" style="width: 100%;">
            <i data-lucide="log-out" style="width: 15px; height: 15px;"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    `;

    // 2. Mobile Topbar HTML
    const topbarHtml = `
      <header class="mobile-topbar">
        <a href="/feed" class="sidebar-logo" style="padding: 0;">
          <div class="logo-icon" style="width: 32px; height: 32px; font-size: 1.1rem;">Z</div>
          <span class="logo-text" style="font-size: 1.3rem;">ZYNTRA</span>
        </a>
        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="/notifications" class="action-btn" style="position: relative;">
            <i data-lucide="bell"></i>
            ${unreadCount > 0 ? '<span style="position: absolute; top: 0; right: 0; width: 8px; height: 8px; background: var(--accent-pink); border-radius: 50%;"></span>' : ''}
          </a>
          <a href="/settings" class="action-btn">
            <i data-lucide="settings"></i>
          </a>
        </div>
      </header>
    `;

    // 3. Mobile Bottom Nav HTML
    const bottomNavHtml = `
      <nav class="mobile-bottom-nav">
        <a href="/feed" class="mobile-nav-link ${activePage === 'feed' ? 'active' : ''}">
          <i data-lucide="home"></i>
        </a>
        <a href="/explore" class="mobile-nav-link ${activePage === 'explore' ? 'active' : ''}">
          <i data-lucide="compass"></i>
        </a>
        <a href="/create-post" class="mobile-nav-link ${activePage === 'create-post' ? 'active' : ''}">
          <i data-lucide="plus-square"></i>
        </a>
        <a href="/notifications" class="mobile-nav-link ${activePage === 'notifications' ? 'active' : ''}">
          <i data-lucide="bell"></i>
          ${unreadCount > 0 ? '<span style="position: absolute; top: 4px; right: 18px; width: 6px; height: 6px; background: var(--accent-pink); border-radius: 50%;"></span>' : ''}
        </a>
        <a href="/profile" class="mobile-nav-link ${activePage === 'profile' ? 'active' : ''}">
          <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
        </a>
      </nav>
    `;

    let navContainer = document.getElementById('navigation-shell');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.id = 'navigation-shell';
      document.body.prepend(navContainer);
    }

    navContainer.innerHTML = sidebarHtml + topbarHtml + bottomNavHtml;
    window.UI.renderIcons();

    // Start background real-time notification sync
    this.startRealtimeNotifications();
  },

  startRealtimeNotifications() {
    if (window._zyntraNotifInterval) return;
    window._zyntraNotifInterval = setInterval(async () => {
      try {
        const notifRes = await window.API.get('/api/notifications/unread-count');
        if (notifRes && notifRes.success) {
          const count = notifRes.unread_count || 0;
          const badges = document.querySelectorAll('.nav-badge');
          badges.forEach(el => {
            if (count > 0) {
              el.textContent = count;
              el.style.display = 'inline-block';
            } else {
              el.style.display = 'none';
            }
          });
        }
      } catch (e) {}
    }, 12000);
  },

  // Render Single Post Card HTML
  renderPostCard(post) {
    const author = post.author || {};
    const authorAvatar = window.UI.getAvatarUrl(author);
    const timeFormatted = window.UI.formatTimeAgo(post.created_at);
    const isLikedClass = post.is_liked ? 'liked' : '';
    const likesCountText = post.likes_count === 1 ? '1 like' : `${post.likes_count} likes`;

    // Dropdown options if owner
    const optionsDropdown = post.is_owner ? `
      <div style="position: relative;" class="post-dropdown-container">
        <button class="post-options-btn" onclick="Components.togglePostMenu('${post.id}')">
          <i data-lucide="more-horizontal"></i>
        </button>
        <div id="post-menu-${post.id}" class="post-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; background: var(--bg-surface); border: 1px solid var(--border-medium); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 50; min-width: 140px; overflow: hidden;">
          <button class="post-dropdown-item" onclick="Components.openEditPostModal('${post.id}', '${encodeURIComponent(post.caption || '')}')" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; color: var(--text-primary); font-size: 0.85rem; text-align: left;">
            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Edit Caption
          </button>
          <button class="post-dropdown-item" onclick="Components.deletePost('${post.id}')" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; color: var(--danger); font-size: 0.85rem; text-align: left; border-top: 1px solid var(--border-subtle);">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete Post
          </button>
        </div>
      </div>
    ` : `
      <button class="post-options-btn" onclick="Components.copyPostLink('${post.id}')" title="Copy Link">
        <i data-lucide="share-2"></i>
      </button>
    `;

    const isVideo = Components.isVideoUrl(post.image_url);
    const mediaHtml = isVideo ? `
      <video src="${post.image_url}" autoplay loop muted playsinline controls style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;"></video>
    ` : `
      <img src="${post.image_url}" alt="Post image" loading="lazy">
    `;

    return `
      <article class="post-card" id="post-card-${post.id}" data-post-id="${post.id}">
        <header class="post-header">
          <a href="/user/${author.username}" class="post-author">
            <img src="${authorAvatar}" alt="${author.username}" class="post-avatar">
            <div>
              <div class="post-author-name">
                ${author.username || 'user'}
                ${isVideo ? '<span style="font-size: 0.7rem; background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">REEL</span>' : ''}
              </div>
              <div class="post-time">${timeFormatted}</div>
            </div>
          </a>
          ${optionsDropdown}
        </header>

        <div class="post-media" ondblclick="Components.handlePostDoubleTap('${post.id}')">
          ${mediaHtml}
          <div class="heart-burst">
            <i data-lucide="heart" style="width: 72px; height: 72px;"></i>
          </div>
        </div>

        <div class="post-actions">
          <div class="post-actions-left">
            <button class="action-btn like-btn ${isLikedClass}" id="like-btn-${post.id}" onclick="Components.toggleLike('${post.id}')">
              <i data-lucide="heart"></i>
            </button>
            <a href="/post/${post.id}" class="action-btn" title="Comment">
              <i data-lucide="message-circle"></i>
            </a>
            <button class="action-btn" onclick="Components.copyPostLink('${post.id}')" title="Share">
              <i data-lucide="send"></i>
            </button>
          </div>
        </div>

        <div class="post-body">
          <div class="post-likes-count" id="likes-count-${post.id}" onclick="Components.openLikesModal('${post.id}')">
            ${likesCountText}
          </div>

          ${post.caption ? `
            <div class="post-caption" id="caption-${post.id}">
              <a href="/user/${author.username}" class="caption-username">${author.username}</a>
              <span>${Components.escapeHtml(post.caption)}</span>
            </div>
          ` : ''}

          <a href="/post/${post.id}" class="post-comments-summary">
            ${post.comments_count > 0 ? `View all ${post.comments_count} comments` : 'Add the first comment...'}
          </a>

          <form class="post-comment-form" onsubmit="Components.handleCommentSubmit(event, '${post.id}')">
            <input type="text" class="comment-input" placeholder="Add a comment..." id="comment-input-${post.id}" autocomplete="off">
            <button type="submit" class="comment-submit-btn">Post</button>
          </form>
        </div>
      </article>
    `;
  },

  // Toggle Like Action
  async toggleLike(postId) {
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    const likesCountElem = document.getElementById(`likes-count-${postId}`);

    try {
      const res = await window.API.post(`/api/posts/${postId}/like`);
      if (res.success) {
        if (res.liked) {
          likeBtn.classList.add('liked');
        } else {
          likeBtn.classList.remove('liked');
        }
        likesCountElem.textContent = res.likes_count === 1 ? '1 like' : `${res.likes_count} likes`;
        window.UI.renderIcons();
      }
    } catch (err) {
      window.UI.showToast(err.message || 'Could not update like status', 'error');
    }
  },

  // Double tap to like with animation
  async handlePostDoubleTap(postId) {
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
      const media = card.querySelector('.post-media');
      window.UI.triggerHeartBurst(media);
    }
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    if (likeBtn && !likeBtn.classList.contains('liked')) {
      await this.toggleLike(postId);
    }
  },

  // Handle Quick Comment Submission
  async handleCommentSubmit(event, postId) {
    event.preventDefault();
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    window.UI.showToast('Comment posted!', 'success');

    // Optimistically update comments summary text
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
      const summaryLink = card.querySelector('.post-comments-summary');
      if (summaryLink) summaryLink.textContent = 'View comments';
    }

    try {
      await window.API.post(`/api/posts/${postId}/comments`, { comment_text: text });
    } catch (err) {
      window.UI.showToast(err.message || 'Failed to post comment', 'error');
      input.value = text;
    }
  },

  // Post Options Menu Toggle
  togglePostMenu(postId) {
    const menu = document.getElementById(`post-menu-${postId}`);
    if (menu) {
      const isVisible = menu.style.display === 'block';
      // Close all open menus first
      document.querySelectorAll('.post-dropdown-menu').forEach(m => m.style.display = 'none');
      menu.style.display = isVisible ? 'none' : 'block';
    }
  },

  // Copy Post Link
  copyPostLink(postId) {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      window.UI.showToast('Post link copied to clipboard!', 'success');
    }).catch(() => {
      window.UI.showToast('Could not copy link', 'error');
    });
  },

  // Delete Post
  async deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }

    try {
      const res = await window.API.delete(`/api/posts/${postId}`);
      if (res.success) {
        window.UI.showToast('Post deleted', 'success');
        const card = document.getElementById(`post-card-${postId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => card.remove(), 250);
        }
      }
    } catch (err) {
      window.UI.showToast(err.message || 'Failed to delete post', 'error');
    }
  },

  // Open Edit Post Caption Modal
  openEditPostModal(postId, encodedCaption) {
    const caption = decodeURIComponent(encodedCaption);
    let modal = document.getElementById('edit-post-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-post-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Edit Caption</h3>
            <button class="modal-close-btn" onclick="UI.closeModal('edit-post-modal')">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="edit-post-id">
            <div class="form-group">
              <label class="form-label">Caption</label>
              <textarea id="edit-post-caption-input" class="form-textarea" placeholder="Write a caption..."></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button class="btn btn-secondary" onclick="UI.closeModal('edit-post-modal')">Cancel</button>
              <button class="btn btn-primary" id="save-caption-btn" onclick="Components.savePostCaption()">Save Changes</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('edit-post-id').value = postId;
    document.getElementById('edit-post-caption-input').value = caption;
    window.UI.openModal('edit-post-modal');
  },

  // Save Post Caption
  async savePostCaption() {
    const postId = document.getElementById('edit-post-id').value;
    const caption = document.getElementById('edit-post-caption-input').value;
    const saveBtn = document.getElementById('save-caption-btn');

    try {
      saveBtn.disabled = true;
      const res = await window.API.put(`/api/posts/${postId}`, { caption });
      if (res.success) {
        window.UI.showToast('Caption updated!', 'success');
        window.UI.closeModal('edit-post-modal');

        const captionElem = document.getElementById(`caption-${postId}`);
        if (captionElem) {
          const userElem = captionElem.querySelector('.caption-username');
          const username = userElem ? userElem.textContent : '';
          captionElem.innerHTML = `<a href="/user/${username}" class="caption-username">${username}</a> <span>${Components.escapeHtml(caption)}</span>`;
        }
      }
    } catch (err) {
      window.UI.showToast(err.message || 'Failed to update caption', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  },

  // Open Likes List Modal
  async openLikesModal(postId) {
    let modal = document.getElementById('likes-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'likes-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Likes</h3>
            <button class="modal-close-btn" onclick="UI.closeModal('likes-modal')">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="modal-body" id="likes-modal-body" style="min-height: 200px;">
            <div style="text-align: center; color: var(--text-muted); padding: 30px;">Loading likes...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const modalBody = document.getElementById('likes-modal-body');
    modalBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Loading likes...</div>`;
    window.UI.openModal('likes-modal');

    try {
      const res = await window.API.get(`/api/posts/${postId}/likes`);
      if (res.success) {
        if (res.likes.length === 0) {
          modalBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">No likes yet. Be the first to like this post!</div>`;
          return;
        }

        modalBody.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${res.likes.map(user => `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <a href="/user/${user.username}" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                  <img src="${window.UI.getAvatarUrl(user)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
                  <div style="min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary);">${user.full_name || user.username}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">@${user.username}</div>
                  </div>
                </a>
                ${!user.is_me ? `
                  <button class="btn ${user.is_following ? 'btn-secondary' : 'btn-primary'} btn-sm" id="modal-follow-btn-${user.id}" onclick="Components.toggleFollow('${user.id}', 'modal-follow-btn-${user.id}')">
                    ${user.is_following ? 'Following' : 'Follow'}
                  </button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `;
        window.UI.renderIcons();
      }
    } catch (err) {
      modalBody.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 30px;">Failed to load likes: ${err.message}</div>`;
    }
  },

  // Toggle Follow / Unfollow User Helper
  async toggleFollow(targetUserId, buttonElementId) {
    const btn = document.getElementById(buttonElementId);
    if (!btn) return;

    const isFollowing = btn.classList.contains('btn-secondary');

    try {
      btn.disabled = true;
      if (isFollowing) {
        // Unfollow
        const res = await window.API.delete(`/api/users/${targetUserId}/follow`);
        if (res.success) {
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
          btn.textContent = 'Follow';
          window.UI.showToast(res.message || 'Unfollowed', 'info');
        }
      } else {
        // Follow
        const res = await window.API.post(`/api/users/${targetUserId}/follow`);
        if (res.success) {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
          btn.textContent = 'Following';
          window.UI.showToast(res.message || 'Now following!', 'success');
        }
      }
    } catch (err) {
      window.UI.showToast(err.message || 'Could not update follow status', 'error');
    } finally {
      btn.disabled = false;
    }
  },

  // Check if media URL is a video / reel
  isVideoUrl(url) {
    if (!url) return false;
    return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url) || url.includes('/video/');
  },

  // Utility to prevent XSS
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.Components = Components;

// Global click handler to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.post-dropdown-container')) {
    document.querySelectorAll('.post-dropdown-menu').forEach(m => m.style.display = 'none');
  }
});

