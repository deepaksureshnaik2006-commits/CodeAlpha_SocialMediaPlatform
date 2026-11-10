const express = require('express');
const router = express.Router();

// Middlewares
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const likeController = require('../controllers/likeController');
const commentController = require('../controllers/commentController');
const followController = require('../controllers/followController');
const notificationController = require('../controllers/notificationController');

// 1. Health check & Config
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'ZYNTRA',
    tagline: 'Connect. Share. Discover.',
    timestamp: new Date().toISOString()
  });
});
router.get('/config', authController.getConfig);

// 2. Auth & Onboarding
router.get('/auth/check-username', authController.checkUsername);
router.post('/auth/sync-profile', requireAuth, authController.syncProfile);

// 3. User Profiles & Discovery
router.get('/users/me', requireAuth, userController.getMe);
router.put('/users/me', requireAuth, userController.updateMe);
router.post('/users/me/avatar', requireAuth, upload.single('avatar'), userController.updateAvatar);
router.get('/users/explore', optionalAuth, userController.exploreUsers);
router.get('/users/:username', optionalAuth, userController.getUserByUsername);
router.get('/users/:username/posts', optionalAuth, userController.getUserPosts);

// 4. Follows & Connections
router.post('/users/:targetUserId/follow', requireAuth, followController.followUser);
router.delete('/users/:targetUserId/follow', requireAuth, followController.unfollowUser);
router.get('/users/:username/followers', optionalAuth, followController.getFollowers);
router.get('/users/:username/following', optionalAuth, followController.getFollowing);

// 5. Posts & Feed
router.post('/posts', requireAuth, upload.single('image'), postController.createPost);
router.get('/posts/feed', requireAuth, postController.getFeed);
router.get('/posts/explore', optionalAuth, postController.getExplorePosts);
router.get('/posts/:id', optionalAuth, postController.getPostById);
router.put('/posts/:id', requireAuth, postController.updatePost);
router.delete('/posts/:id', requireAuth, postController.deletePost);

// 6. Likes
router.post('/posts/:id/like', requireAuth, likeController.toggleLike);
router.get('/posts/:id/likes', optionalAuth, likeController.getPostLikes);

// 7. Comments
router.get('/posts/:id/comments', optionalAuth, commentController.getComments);
router.post('/posts/:id/comments', requireAuth, commentController.addComment);
router.put('/comments/:commentId', requireAuth, commentController.updateComment);
router.delete('/comments/:commentId', requireAuth, commentController.deleteComment);

// 8. Notifications
router.get('/notifications', requireAuth, notificationController.getNotifications);
router.get('/notifications/unread-count', requireAuth, notificationController.getUnreadCount);
router.put('/notifications/mark-read', requireAuth, notificationController.markAsRead);

module.exports = router;

