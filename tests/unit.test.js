const express = require('express');
const path = require('path');
const fs = require('fs');

async function runUnitTests() {
  console.log('🧪 Running In-Memory ZYNTRA Application Verification...\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${extraInfo}`);
      failed++;
    }
  }

  // 1. Verify all 15 required HTML pages exist on disk and have proper structure
  const requiredPages = [
    'index.html',
    'register.html',
    'login.html',
    'forgot-password.html',
    'feed.html',
    'explore.html',
    'create-post.html',
    'post.html',
    'profile.html',
    'edit-profile.html',
    'user.html',
    'followers.html',
    'following.html',
    'notifications.html',
    'settings.html'
  ];

  const frontendDir = path.join(__dirname, '..', 'frontend');

  for (const page of requiredPages) {
    const filePath = path.join(frontendDir, page);
    const exists = fs.existsSync(filePath);
    let validContent = false;
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      validContent = content.includes('<!DOCTYPE html>') && 
                     content.includes('ZYNTRA') &&
                     content.includes('style.css');
    }
    assert(`Page [${page}] exists and contains valid HTML & assets`, exists && validContent);
  }

  // 2. Verify all CSS & JS files
  const stylePath = path.join(frontendDir, 'css', 'style.css');
  const styleExists = fs.existsSync(stylePath);
  const styleContent = styleExists ? fs.readFileSync(stylePath, 'utf8') : '';
  assert('CSS style.css defines --bg-app and design variables', styleExists && styleContent.includes('--bg-app') && styleContent.includes('--accent-gradient'));

  const jsFiles = ['supabaseClient.js', 'api.js', 'ui.js', 'auth.js', 'components.js'];
  for (const js of jsFiles) {
    const jsPath = path.join(frontendDir, 'js', js);
    assert(`JS library [${js}] exists and is populated`, fs.existsSync(jsPath) && fs.statSync(jsPath).size > 200);
  }

  // 3. Verify SQL Schema has all 6 _zyntra tables and RLS
  const sqlPath = path.join(__dirname, '..', 'supabase-schema.sql');
  const sqlExists = fs.existsSync(sqlPath);
  const sqlContent = sqlExists ? fs.readFileSync(sqlPath, 'utf8') : '';

  const requiredTables = [
    'users_zyntra',
    'posts_zyntra',
    'comments_zyntra',
    'likes_zyntra',
    'follows_zyntra',
    'notifications_zyntra'
  ];

  for (const table of requiredTables) {
    assert(`SQL schema defines table [${table}]`, sqlContent.includes(`TABLE IF NOT EXISTS public.${table}`) || sqlContent.includes(`TABLE public.${table}`));
    assert(`SQL schema enables RLS on [${table}]`, sqlContent.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
  }

  assert('SQL schema enforces no-self-follow check', sqlContent.includes('check_no_self_follow_zyntra'));
  assert('SQL schema enforces unique likes constraint', sqlContent.includes('unique_post_user_like_zyntra'));
  assert('SQL schema enforces unique follow constraint', sqlContent.includes('unique_follower_following_zyntra'));
  assert('SQL schema provisions storage buckets zyntra-avatars & zyntra-posts', sqlContent.includes('zyntra-avatars') && sqlContent.includes('zyntra-posts'));

  // 4. Test Controller logic and module exports
  const authController = require('../backend/controllers/authController');
  const userController = require('../backend/controllers/userController');
  const postController = require('../backend/controllers/postController');
  const likeController = require('../backend/controllers/likeController');
  const commentController = require('../backend/controllers/commentController');
  const followController = require('../backend/controllers/followController');
  const notificationController = require('../backend/controllers/notificationController');

  assert('authController exports getConfig, checkUsername, syncProfile', 
    typeof authController.getConfig === 'function' &&
    typeof authController.checkUsername === 'function' &&
    typeof authController.syncProfile === 'function');

  assert('userController exports getMe, updateMe, updateAvatar, getUserByUsername, getUserPosts, exploreUsers',
    typeof userController.getMe === 'function' &&
    typeof userController.updateMe === 'function' &&
    typeof userController.updateAvatar === 'function' &&
    typeof userController.getUserByUsername === 'function' &&
    typeof userController.getUserPosts === 'function' &&
    typeof userController.exploreUsers === 'function');

  assert('postController exports createPost, getFeed, getExplorePosts, getPostById, updatePost, deletePost',
    typeof postController.createPost === 'function' &&
    typeof postController.getFeed === 'function' &&
    typeof postController.getExplorePosts === 'function' &&
    typeof postController.getPostById === 'function' &&
    typeof postController.updatePost === 'function' &&
    typeof postController.deletePost === 'function');

  assert('likeController exports toggleLike, getPostLikes',
    typeof likeController.toggleLike === 'function' &&
    typeof likeController.getPostLikes === 'function');

  assert('commentController exports getComments, addComment, updateComment, deleteComment',
    typeof commentController.getComments === 'function' &&
    typeof commentController.addComment === 'function' &&
    typeof commentController.updateComment === 'function' &&
    typeof commentController.deleteComment === 'function');

  assert('followController exports followUser, unfollowUser, getFollowers, getFollowing',
    typeof followController.followUser === 'function' &&
    typeof followController.unfollowUser === 'function' &&
    typeof followController.getFollowers === 'function' &&
    typeof followController.getFollowing === 'function');

  assert('notificationController exports getNotifications, getUnreadCount, markAsRead',
    typeof notificationController.getNotifications === 'function' &&
    typeof notificationController.getUnreadCount === 'function' &&
    typeof notificationController.markAsRead === 'function');

  // 5. Test authMiddleware rejection of unauthenticated requests
  const { requireAuth } = require('../backend/middleware/authMiddleware');
  let mockResStatus = null;
  let mockResJson = null;
  const mockRes = {
    status: (s) => { mockResStatus = s; return mockRes; },
    json: (j) => { mockResJson = j; return mockRes; }
  };
  await requireAuth({ headers: {} }, mockRes, () => {});
  assert('authMiddleware rejects missing Authorization header with 401', mockResStatus === 401 && mockResJson.success === false);

  // 6. Test getConfig response
  let configData = null;
  const mockConfigRes = {
    json: (data) => { configData = data; }
  };
  authController.getConfig({}, mockConfigRes);
  assert('getConfig returns success and metadata safely', configData && configData.success === true && typeof configData.isConfigured === 'boolean');

  console.log(`\n=======================================================`);
  console.log(`📊 In-Memory Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`=======================================================`);

  if (failed > 0) process.exit(1);
}

runUnitTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

