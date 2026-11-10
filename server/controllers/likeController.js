const { supabaseAdmin } = require('../config/supabase');

// Toggle like / unlike on a post
const toggleLike = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts_zyntra')
      .select('id, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (postErr || !post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Check if user already liked the post
    const { data: existingLike } = await supabaseAdmin
      .from('likes_zyntra')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    let liked = false;

    if (existingLike) {
      // Unlike
      await supabaseAdmin
        .from('likes_zyntra')
        .delete()
        .eq('id', existingLike.id);

      // Remove notification if exists
      await supabaseAdmin
        .from('notifications_zyntra')
        .delete()
        .eq('post_id', postId)
        .eq('sender_id', userId)
        .eq('notification_type', 'like');

      liked = false;
    } else {
      // Like
      const { error: insertErr } = await supabaseAdmin
        .from('likes_zyntra')
        .insert({
          post_id: postId,
          user_id: userId
        });

      if (insertErr) {
        return res.status(500).json({ success: false, message: insertErr.message });
      }

      liked = true;

      // Trigger notification if liker is not the post author
      if (post.user_id !== userId) {
        await supabaseAdmin
          .from('notifications_zyntra')
          .insert({
            recipient_id: post.user_id,
            sender_id: userId,
            notification_type: 'like',
            post_id: postId,
            is_read: false
          });
      }
    }

    // Fetch updated likes count
    const { count: likesCount } = await supabaseAdmin
      .from('likes_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    return res.json({
      success: true,
      liked,
      likes_count: likesCount || 0
    });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get list of users who liked a post
const getPostLikes = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.user?.id;

    const { data: likes, error } = await supabaseAdmin
      .from('likes_zyntra')
      .select(`
        created_at,
        users_zyntra:user_id(id, username, full_name, profile_image)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // If current user is logged in, find which of these users they follow
    let followingIds = new Set();
    if (currentUserId && likes.length > 0) {
      const { data: follows } = await supabaseAdmin
        .from('follows_zyntra')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (follows) {
        followingIds = new Set(follows.map(f => f.following_id));
      }
    }

    const formattedLikes = (likes || []).map(l => ({
      ...l.users_zyntra,
      liked_at: l.created_at,
      is_following: l.users_zyntra ? followingIds.has(l.users_zyntra.id) : false,
      is_me: currentUserId && l.users_zyntra ? l.users_zyntra.id === currentUserId : false
    }));

    return res.json({
      success: true,
      likes: formattedLikes,
      total: formattedLikes.length
    });
  } catch (err) {
    console.error('getPostLikes error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  toggleLike,
  getPostLikes
};
