const { supabaseAdmin } = require('../config/supabase');
const { getUserIsPrivate } = require('./userController');

// Follow a user or send a follow request if account is private
const followUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Prevent self-following
    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself.'
      });
    }

    // Verify target user exists
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return res.status(404).json({ success: false, message: 'Target user does not exist.' });
    }

    const isPrivate = await getUserIsPrivate(targetUserId, targetUser);

    // Check if already following
    const { data: existingFollow } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'You are already following this user.'
      });
    }

    // If target user is PRIVATE, send or toggle Follow Request (Instagram style)
    if (isPrivate) {
      const { data: existingReq } = await supabaseAdmin
        .from('notifications_zyntra')
        .select('id')
        .eq('recipient_id', targetUserId)
        .eq('sender_id', currentUserId)
        .eq('notification_type', 'follow_request')
        .maybeSingle();

      if (existingReq) {
        // Cancel pending follow request
        await supabaseAdmin
          .from('notifications_zyntra')
          .delete()
          .eq('id', existingReq.id);

        const { count: followersCount } = await supabaseAdmin
          .from('follows_zyntra')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', targetUserId);

        return res.json({
          success: true,
          message: 'Follow request cancelled.',
          is_following: false,
          is_requested: false,
          followers_count: followersCount || 0
        });
      }

      // Create new follow request notification
      await supabaseAdmin
        .from('notifications_zyntra')
        .insert({
          recipient_id: targetUserId,
          sender_id: currentUserId,
          notification_type: 'follow_request',
          is_read: false
        });

      const { count: followersCount } = await supabaseAdmin
        .from('follows_zyntra')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

      return res.json({
        success: true,
        message: `Follow request sent to @${targetUser.username}`,
        is_following: false,
        is_requested: true,
        followers_count: followersCount || 0
      });
    }

    // Public account: Direct follow
    const { error: insertErr } = await supabaseAdmin
      .from('follows_zyntra')
      .insert({
        follower_id: currentUserId,
        following_id: targetUserId
      });

    if (insertErr) {
      return res.status(500).json({ success: false, message: insertErr.message });
    }

    // Create follow notification
    await supabaseAdmin
      .from('notifications_zyntra')
      .insert({
        recipient_id: targetUserId,
        sender_id: currentUserId,
        notification_type: 'follow',
        is_read: false
      });

    // Get updated follower count for target
    const { count: followersCount } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    return res.json({
      success: true,
      message: `Now following @${targetUser.username}`,
      is_following: true,
      is_requested: false,
      followers_count: followersCount || 0
    });
  } catch (err) {
    console.error('followUser error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Unfollow a user or cancel pending request
const unfollowUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot unfollow yourself.'
      });
    }

    // Delete active follow
    await supabaseAdmin
      .from('follows_zyntra')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId);

    // Delete follow notifications or pending follow request
    await supabaseAdmin
      .from('notifications_zyntra')
      .delete()
      .eq('recipient_id', targetUserId)
      .eq('sender_id', currentUserId)
      .in('notification_type', ['follow', 'follow_request']);

    // Get updated follower count for target
    const { count: followersCount } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    return res.json({
      success: true,
      message: 'Unfollowed successfully.',
      is_following: false,
      is_requested: false,
      followers_count: followersCount || 0
    });
  } catch (err) {
    console.error('unfollowUser error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get list of followers for a user
const getFollowers = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    // Get target user
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();

    if (userErr || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get followers
    const { data: followers, error } = await supabaseAdmin
      .from('follows_zyntra')
      .select(`
        created_at,
        users_zyntra:follower_id(id, username, full_name, bio, profile_image)
      `)
      .eq('following_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check which ones current viewer is following
    let myFollowingIds = new Set();
    if (currentUserId && followers.length > 0) {
      const { data: myFollows } = await supabaseAdmin
        .from('follows_zyntra')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (myFollows) {
        myFollowingIds = new Set(myFollows.map(f => f.following_id));
      }
    }

    const formattedList = (followers || []).map(f => ({
      ...f.users_zyntra,
      followed_at: f.created_at,
      is_following: f.users_zyntra ? myFollowingIds.has(f.users_zyntra.id) : false,
      is_me: currentUserId && f.users_zyntra ? f.users_zyntra.id === currentUserId : false
    }));

    return res.json({
      success: true,
      targetUser: user,
      users: formattedList,
      total: formattedList.length
    });
  } catch (err) {
    console.error('getFollowers error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get list of users followed by a user
const getFollowing = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    // Get target user
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();

    if (userErr || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get following
    const { data: following, error } = await supabaseAdmin
      .from('follows_zyntra')
      .select(`
        created_at,
        users_zyntra:following_id(id, username, full_name, bio, profile_image)
      `)
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    let myFollowingIds = new Set();
    if (currentUserId && following.length > 0) {
      const { data: myFollows } = await supabaseAdmin
        .from('follows_zyntra')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (myFollows) {
        myFollowingIds = new Set(myFollows.map(f => f.following_id));
      }
    }

    const formattedList = (following || []).map(f => ({
      ...f.users_zyntra,
      followed_at: f.created_at,
      is_following: f.users_zyntra ? myFollowingIds.has(f.users_zyntra.id) : false,
      is_me: currentUserId && f.users_zyntra ? f.users_zyntra.id === currentUserId : false
    }));

    return res.json({
      success: true,
      targetUser: user,
      users: formattedList,
      total: formattedList.length
    });
  } catch (err) {
    console.error('getFollowing error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Accept follow request (for private accounts)
const acceptFollowRequest = async (req, res) => {
  try {
    const { requesterId } = req.params;
    const currentUserId = req.user.id;

    // 1. Remove the follow_request notification
    await supabaseAdmin
      .from('notifications_zyntra')
      .delete()
      .eq('recipient_id', currentUserId)
      .eq('sender_id', requesterId)
      .eq('notification_type', 'follow_request');

    // 2. Insert into follows_zyntra if not already present
    const { data: existingFollow } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id')
      .eq('follower_id', requesterId)
      .eq('following_id', currentUserId)
      .maybeSingle();

    if (!existingFollow) {
      await supabaseAdmin
        .from('follows_zyntra')
        .insert({
          follower_id: requesterId,
          following_id: currentUserId
        });
    }

    // 3. Notify the requester that their follow request was accepted
    await supabaseAdmin
      .from('notifications_zyntra')
      .insert({
        recipient_id: requesterId,
        sender_id: currentUserId,
        notification_type: 'follow_accept',
        is_read: false
      });

    // 4. Return updated follower count
    const { count: followersCount } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', currentUserId);

    return res.json({
      success: true,
      message: 'Follow request accepted.',
      followers_count: followersCount || 0
    });
  } catch (err) {
    console.error('acceptFollowRequest error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Decline follow request (for private accounts)
const declineFollowRequest = async (req, res) => {
  try {
    const { requesterId } = req.params;
    const currentUserId = req.user.id;

    await supabaseAdmin
      .from('notifications_zyntra')
      .delete()
      .eq('recipient_id', currentUserId)
      .eq('sender_id', requesterId)
      .eq('notification_type', 'follow_request');

    return res.json({
      success: true,
      message: 'Follow request declined.'
    });
  } catch (err) {
    console.error('declineFollowRequest error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  acceptFollowRequest,
  declineFollowRequest
};

