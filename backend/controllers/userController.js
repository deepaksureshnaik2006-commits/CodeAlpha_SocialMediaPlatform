const { supabaseAdmin, uploadToStorage, AVATARS_BUCKET } = require('../config/supabase');
const path = require('path');

// Helper to calculate user stats (posts, followers, following)
async function getUserStats(userId) {
  const [postsRes, followersRes, followingRes] = await Promise.all([
    supabaseAdmin
      .from('posts_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId)
  ]);

  return {
    posts_count: postsRes.count || 0,
    followers_count: followersRes.count || 0,
    following_count: followingRes.count || 0
  };
}

// Helper to determine if an account is private (checks Auth user_metadata AND users_zyntra)
async function getUserIsPrivate(userId, profileData = null) {
  if (profileData && profileData.is_private !== undefined && profileData.is_private !== null) {
    return Boolean(profileData.is_private);
  }
  try {
    const { data: authData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && authData && authData.user && authData.user.user_metadata) {
      return Boolean(authData.user.user_metadata.is_private);
    }
  } catch (e) {}
  return false;
}

// Get logged-in user profile with stats
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: profile, error } = await supabaseAdmin
      .from('users_zyntra')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    const [stats, isPrivate] = await Promise.all([
      getUserStats(userId),
      getUserIsPrivate(userId, profile)
    ]);

    return res.json({
      success: true,
      user: {
        ...profile,
        is_private: isPrivate,
        email: req.authUser?.email || req.user.email,
        ...stats
      }
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update logged-in user's profile details
const updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, full_name, bio, is_private } = req.body;

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (bio !== undefined) updates.bio = bio.trim();

    let isPrivateValue = undefined;
    if (is_private !== undefined) {
      isPrivateValue = Boolean(is_private);

      // Always persist to Supabase Auth user_metadata so it is 100% saved even if SQL table lacks column
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authData && authData.user) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(authData.user.user_metadata || {}),
              is_private: isPrivateValue
            }
          });
        }
      } catch (authErr) {
        console.warn('Could not update user_metadata is_private:', authErr.message);
      }
    }

    if (username) {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '_');
      if (cleanUsername.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long.'
        });
      }

      // Check if username taken by another user
      const { data: existing } = await supabaseAdmin
        .from('users_zyntra')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken by another account.'
        });
      }
      updates.username = cleanUsername;
    }

    // Never pass is_private directly in tableUpdates to avoid PGRST204 if column is not yet in users_zyntra
    const tableUpdates = { ...updates };
    delete tableUpdates.is_private;

    let updatedProfile = null;
    let { data: profileData, error } = await supabaseAdmin
      .from('users_zyntra')
      .update(tableUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
    updatedProfile = profileData;

    // Optional sync to SQL table if column exists in the future
    if (isPrivateValue !== undefined) {
      try {
        await supabaseAdmin
          .from('users_zyntra')
          .update({ is_private: isPrivateValue })
          .eq('id', userId);
      } catch (e) {}
    }

    const [stats, savedIsPrivate] = await Promise.all([
      getUserStats(userId),
      isPrivateValue !== undefined ? Promise.resolve(isPrivateValue) : getUserIsPrivate(userId, updatedProfile)
    ]);

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        ...updatedProfile,
        is_private: savedIsPrivate,
        email: req.authUser?.email || req.user.email,
        ...stats
      }
    });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Upload or change user avatar
const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded.'
      });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `${userId}_avatar_${Date.now()}${ext}`;

    const publicUrl = await uploadToStorage(
      AVATARS_BUCKET,
      fileName,
      req.file.buffer,
      req.file.mimetype
    );

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('users_zyntra')
      .update({
        profile_image: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Profile picture updated successfully!',
      profile_image: publicUrl,
      user: updatedProfile
    });
  } catch (err) {
    console.error('updateAvatar error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get other user's profile by username
const getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();

    // Select profile fields from users_zyntra
    const { data: profile, error } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username, full_name, bio, profile_image, created_at')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const [stats, isPrivate] = await Promise.all([
      getUserStats(profile.id),
      getUserIsPrivate(profile.id, profile)
    ]);

    // Check if the current authenticated user follows this user
    let is_following = false;
    let is_requested = false;
    let is_me = false;

    if (req.user) {
      is_me = (req.user.id === profile.id);
      if (!is_me) {
        const { data: followRecord } = await supabaseAdmin
          .from('follows_zyntra')
          .select('id')
          .eq('follower_id', req.user.id)
          .eq('following_id', profile.id)
          .maybeSingle();

        is_following = !!followRecord;

        if (!is_following && isPrivate) {
          const { data: requestRecord } = await supabaseAdmin
            .from('notifications_zyntra')
            .select('id')
            .eq('recipient_id', profile.id)
            .eq('sender_id', req.user.id)
            .eq('notification_type', 'follow_request')
            .maybeSingle();

          is_requested = !!requestRecord;
        }
      }
    }

    return res.json({
      success: true,
      user: {
        ...profile,
        is_private: isPrivate,
        ...stats,
        is_following,
        is_requested,
        is_me
      }
    });
  } catch (err) {
    console.error('getUserByUsername error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get posts for a specific user (profile grid view with privacy gate)
const getUserPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();
    const currentUserId = req.user?.id;

    // Find user
    const { data: userData, error: userErr } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (userErr || !userData) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isPrivate = await getUserIsPrivate(userData.id, userData);

    // Privacy check: If account is private, viewer must be follower or owner
    const isOwner = currentUserId && (currentUserId === userData.id);
    let isFollowing = false;

    if (isPrivate && !isOwner) {
      if (currentUserId) {
        const { data: follow } = await supabaseAdmin
          .from('follows_zyntra')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', userData.id)
          .maybeSingle();
        isFollowing = !!follow;
      }

      if (!isFollowing) {
        return res.json({
          success: true,
          is_private: true,
          posts: [],
          message: 'This account is private. Follow to view their posts and reels.'
        });
      }
    }

    // Get posts ordered by newest first
    const { data: posts, error } = await supabaseAdmin
      .from('posts_zyntra')
      .select(`
        id,
        image_url,
        caption,
        created_at,
        updated_at,
        likes:likes_zyntra(id),
        comments:comments_zyntra(id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const formattedPosts = (posts || []).map(post => ({
      id: post.id,
      image_url: post.image_url,
      caption: post.caption,
      created_at: post.created_at,
      updated_at: post.updated_at,
      likes_count: post.likes ? post.likes.length : 0,
      comments_count: post.comments ? post.comments.length : 0
    }));

    return res.json({
      success: true,
      is_private: false,
      posts: formattedPosts
    });
  } catch (err) {
    console.error('getUserPosts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Explore / Discover users to follow
const exploreUsers = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const currentUserId = req.user?.id;

    let query = supabaseAdmin
      .from('users_zyntra')
      .select('id, username, full_name, bio, profile_image, created_at')
      .limit(parseInt(limit));

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      query = query.or(`username.ilike.${searchTerm},full_name.ilike.${searchTerm}`);
    }

    const { data: users, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // If current user is logged in, attach is_following and is_requested flags
    let followingIds = new Set();
    let requestedIds = new Set();
    if (currentUserId && users.length > 0) {
      const [{ data: follows }, { data: requests }] = await Promise.all([
        supabaseAdmin
          .from('follows_zyntra')
          .select('following_id')
          .eq('follower_id', currentUserId),
        supabaseAdmin
          .from('notifications_zyntra')
          .select('recipient_id')
          .eq('sender_id', currentUserId)
          .eq('notification_type', 'follow_request')
      ]);

      if (follows) {
        followingIds = new Set(follows.map(f => f.following_id));
      }
      if (requests) {
        requestedIds = new Set(requests.map(r => r.recipient_id));
      }
    }

    // Attach follower count, is_following, and is_requested
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const { count: followersCount } = await supabaseAdmin
          .from('follows_zyntra')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', u.id);

        return {
          ...u,
          followers_count: followersCount || 0,
          is_following: followingIds.has(u.id),
          is_requested: requestedIds.has(u.id)
        };
      })
    );

    return res.json({
      success: true,
      users: enrichedUsers
    });
  } catch (err) {
    console.error('exploreUsers error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Permanently delete user account and associated content
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Delete notifications
    await supabaseAdmin.from('notifications_zyntra').delete().or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);

    // 2. Delete likes
    await supabaseAdmin.from('likes_zyntra').delete().eq('user_id', userId);

    // 3. Delete comments
    await supabaseAdmin.from('comments_zyntra').delete().eq('user_id', userId);

    // 4. Delete follow relationships
    await supabaseAdmin.from('follows_zyntra').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);

    // 5. Delete posts and post interactions
    const { data: userPosts } = await supabaseAdmin.from('posts_zyntra').select('id').eq('user_id', userId);
    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map(p => p.id);
      await supabaseAdmin.from('comments_zyntra').delete().in('post_id', postIds);
      await supabaseAdmin.from('likes_zyntra').delete().in('post_id', postIds);
      await supabaseAdmin.from('posts_zyntra').delete().eq('user_id', userId);
    }

    // 6. Delete profile from users_zyntra
    await supabaseAdmin.from('users_zyntra').delete().eq('id', userId);

    // 7. Delete auth user from Supabase Auth
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authErr) {
      console.warn('Auth user deletion warning:', authErr.message);
    }

    return res.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted.'
    });
  } catch (err) {
    console.error('deleteAccount error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete account.' });
  }
};

module.exports = {
  getUserIsPrivate,
  getMe,
  updateMe,
  updateAvatar,
  getUserByUsername,
  getUserPosts,
  exploreUsers,
  deleteAccount
};

