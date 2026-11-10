const { supabaseAdmin, uploadToStorage, POSTS_BUCKET } = require('../config/supabase');
const { getUserIsPrivate } = require('./userController');
const path = require('path');

// Helper to retrieve list of user IDs with private accounts
async function getPrivateUserIds() {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, is_private')
      .eq('is_private', true);
    if (!error && users && users.length > 0) {
      return users.map(u => u.id);
    }
  } catch (e) {}

  try {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (!authErr && authData && authData.users) {
      return authData.users
        .filter(u => u.user_metadata && u.user_metadata.is_private === true)
        .map(u => u.id);
    }
  } catch (e) {}

  return [];
}

// Helper to format post object with author, counts and user status
function formatPost(post, currentUserId) {
  const isLiked = post.likes_zyntra && post.likes_zyntra.some(l => l.user_id === currentUserId);
  const likesCount = post.likes_zyntra ? post.likes_zyntra.length : 0;
  const commentsCount = post.comments_zyntra ? post.comments_zyntra.length : 0;

  return {
    id: post.id,
    image_url: post.image_url,
    caption: post.caption,
    created_at: post.created_at,
    updated_at: post.updated_at,
    author: post.users_zyntra ? {
      id: post.users_zyntra.id,
      username: post.users_zyntra.username,
      full_name: post.users_zyntra.full_name,
      profile_image: post.users_zyntra.profile_image
    } : null,
    likes_count: likesCount,
    comments_count: commentsCount,
    is_liked: !!isLiked,
    is_owner: currentUserId ? post.user_id === currentUserId : false
  };
}

// Create a new post
const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image to share.'
      });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `${userId}_post_${Date.now()}${ext}`;

    const imageUrl = await uploadToStorage(
      POSTS_BUCKET,
      fileName,
      req.file.buffer,
      req.file.mimetype
    );

    const { data: newPost, error } = await supabaseAdmin
      .from('posts_zyntra')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        caption: caption ? caption.trim() : ''
      })
      .select(`
        id,
        image_url,
        caption,
        created_at,
        updated_at,
        user_id,
        users_zyntra:user_id(id, username, full_name, profile_image)
      `)
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Post published successfully!',
      post: {
        id: newPost.id,
        image_url: newPost.image_url,
        caption: newPost.caption,
        created_at: newPost.created_at,
        updated_at: newPost.updated_at,
        author: newPost.users_zyntra,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        is_owner: true
      }
    });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get Feed posts (from followed users + current user, chronological newest first)
const getFeed = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 1. Fetch user IDs followed by current user
    const { data: follows, error: followErr } = await supabaseAdmin
      .from('follows_zyntra')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followErr) {
      return res.status(500).json({ success: false, message: followErr.message });
    }

    // Include followed IDs + current user's own ID
    const targetUserIds = [currentUserId, ...(follows || []).map(f => f.following_id)];

    // 2. Fetch posts from these users
    let query = supabaseAdmin
      .from('posts_zyntra')
      .select(`
        id,
        user_id,
        image_url,
        caption,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image),
        likes_zyntra(user_id),
        comments_zyntra(id)
      `)
      .in('user_id', targetUserIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    let { data: posts, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // If followed feed is empty or user is brand new with few posts, show discovery posts from public creators
    let isDiscovery = false;
    if ((!posts || posts.length === 0) && page === 1) {
      const privateIds = await getPrivateUserIds();

      let fallbackQuery = supabaseAdmin
        .from('posts_zyntra')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          updated_at,
          users_zyntra:user_id(id, username, full_name, profile_image),
          likes_zyntra(user_id),
          comments_zyntra(id)
        `)
        .order('created_at', { ascending: false });

      if (privateIds.length > 0) {
        fallbackQuery = fallbackQuery.not('user_id', 'in', `(${privateIds.join(',')})`);
      }

      const { data: fallbackPosts } = await fallbackQuery.limit(limit);

      if (fallbackPosts && fallbackPosts.length > 0) {
        posts = fallbackPosts;
        isDiscovery = true;
      }
    }

    const formattedPosts = (posts || []).map(post => formatPost(post, currentUserId));

    return res.json({
      success: true,
      posts: formattedPosts,
      page,
      limit,
      hasMore: formattedPosts.length === limit,
      isDiscovery
    });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Explore posts grid (Only show public accounts)
const getExplorePosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    // Filter out posts from private accounts
    const privateIds = await getPrivateUserIds();

    let query = supabaseAdmin
      .from('posts_zyntra')
      .select(`
        id,
        user_id,
        image_url,
        caption,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image),
        likes_zyntra(user_id),
        comments_zyntra(id)
      `)
      .order('created_at', { ascending: false });

    if (privateIds.length > 0) {
      query = query.not('user_id', 'in', `(${privateIds.join(',')})`);
    }

    const { data: posts, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const formattedPosts = (posts || []).map(post => formatPost(post, currentUserId));

    return res.json({
      success: true,
      posts: formattedPosts,
      page,
      limit,
      hasMore: formattedPosts.length === limit
    });
  } catch (err) {
    console.error('getExplorePosts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get single post details with full comments
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    const { data: post, error } = await supabaseAdmin
      .from('posts_zyntra')
      .select(`
        id,
        user_id,
        image_url,
        caption,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image),
        likes_zyntra(user_id),
        comments_zyntra(
          id,
          comment_text,
          created_at,
          updated_at,
          user_id,
          users_zyntra:user_id(id, username, full_name, profile_image)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Privacy check: If author has a private account, viewer must be author or approved follower
    const authorId = post.user_id;
    const isOwner = currentUserId && (currentUserId === authorId);

    if (!isOwner) {
      const isAuthorPrivate = await getUserIsPrivate(authorId, post.users_zyntra);

      if (isAuthorPrivate) {
        let isFollowing = false;
        if (currentUserId) {
          const { data: followRecord } = await supabaseAdmin
            .from('follows_zyntra')
            .select('id')
            .eq('follower_id', currentUserId)
            .eq('following_id', authorId)
            .maybeSingle();
          isFollowing = !!followRecord;
        }

        if (!isFollowing) {
          return res.status(403).json({
            success: false,
            is_private: true,
            message: 'This account is private. Follow this account to see their photos and reels.'
          });
        }
      }
    }

    const isLiked = post.likes_zyntra && post.likes_zyntra.some(l => l.user_id === currentUserId);
    const formattedComments = (post.comments_zyntra || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(c => ({
        id: c.id,
        comment_text: c.comment_text,
        created_at: c.created_at,
        updated_at: c.updated_at,
        author: c.users_zyntra,
        is_owner: currentUserId ? c.user_id === currentUserId : false
      }));

    return res.json({
      success: true,
      post: {
        id: post.id,
        image_url: post.image_url,
        caption: post.caption,
        created_at: post.created_at,
        updated_at: post.updated_at,
        author: post.users_zyntra,
        likes_count: post.likes_zyntra ? post.likes_zyntra.length : 0,
        comments_count: formattedComments.length,
        comments: formattedComments,
        is_liked: !!isLiked,
        is_owner: currentUserId ? post.user_id === currentUserId : false
      }
    });
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Edit post caption
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;
    const userId = req.user.id;

    // Check post ownership
    const { data: existingPost, error: fetchErr } = await supabaseAdmin
      .from('posts_zyntra')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingPost) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (existingPost.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only edit your own posts.' });
    }

    const { data: updatedPost, error } = await supabaseAdmin
      .from('posts_zyntra')
      .update({
        caption: caption ? caption.trim() : '',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Post caption updated successfully!',
      post: updatedPost
    });
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: existingPost, error: fetchErr } = await supabaseAdmin
      .from('posts_zyntra')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingPost) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (existingPost.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only delete your own posts.' });
    }

    const { error } = await supabaseAdmin
      .from('posts_zyntra')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Post deleted successfully.'
    });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPost,
  getFeed,
  getExplorePosts,
  getPostById,
  updatePost,
  deletePost
};

