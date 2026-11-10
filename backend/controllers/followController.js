const { supabaseAdmin } = require('../config/supabase');

// Follow a user
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

    // Insert follow record
    const { error: insertErr } = await supabaseAdmin
      .from('follows_zyntra')
      .insert({
        follower_id: currentUserId,
        following_id: targetUserId
      });

    if (insertErr) {
      return res.status(500).json({ success: false, message: insertErr.message });
    }

    // Create notification
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
      followers_count: followersCount || 0
    });
  } catch (err) {
    console.error('followUser error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Unfollow a user
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

    const { error: deleteErr } = await supabaseAdmin
      .from('follows_zyntra')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId);

    if (deleteErr) {
      return res.status(500).json({ success: false, message: deleteErr.message });
    }

    // Remove follow notification
    await supabaseAdmin
      .from('notifications_zyntra')
      .delete()
      .eq('recipient_id', targetUserId)
      .eq('sender_id', currentUserId)
      .eq('notification_type', 'follow');

    // Get updated follower count for target
    const { count: followersCount } = await supabaseAdmin
      .from('follows_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    return res.json({
      success: true,
      message: 'Unfollowed successfully.',
      is_following: false,
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

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
};

