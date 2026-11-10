const { supabaseAdmin } = require('../config/supabase');

// Get all comments for a post
const getComments = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.user?.id;

    const { data: comments, error } = await supabaseAdmin
      .from('comments_zyntra')
      .select(`
        id,
        post_id,
        user_id,
        comment_text,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const formattedComments = (comments || []).map(c => ({
      id: c.id,
      post_id: c.post_id,
      comment_text: c.comment_text,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author: c.users_zyntra,
      is_owner: currentUserId ? c.user_id === currentUserId : false
    }));

    return res.json({
      success: true,
      comments: formattedComments,
      total: formattedComments.length
    });
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Add a comment to a post
const addComment = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { comment_text } = req.body;
    const userId = req.user.id;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text cannot be empty.'
      });
    }

    // Check if post exists
    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts_zyntra')
      .select('id, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (postErr || !post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Insert comment
    const { data: newComment, error: commentErr } = await supabaseAdmin
      .from('comments_zyntra')
      .insert({
        post_id: postId,
        user_id: userId,
        comment_text: comment_text.trim()
      })
      .select(`
        id,
        post_id,
        user_id,
        comment_text,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image)
      `)
      .single();

    if (commentErr) {
      return res.status(500).json({ success: false, message: commentErr.message });
    }

    // Notify post owner if commenter is not author
    if (post.user_id !== userId) {
      await supabaseAdmin
        .from('notifications_zyntra')
        .insert({
          recipient_id: post.user_id,
          sender_id: userId,
          notification_type: 'comment',
          post_id: postId,
          is_read: false
        });
    }

    return res.status(201).json({
      success: true,
      message: 'Comment posted successfully.',
      comment: {
        id: newComment.id,
        post_id: newComment.post_id,
        comment_text: newComment.comment_text,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
        author: newComment.users_zyntra,
        is_owner: true
      }
    });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update own comment
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment_text } = req.body;
    const userId = req.user.id;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be blank.'
      });
    }

    // Verify ownership
    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('comments_zyntra')
      .select('id, user_id')
      .eq('id', commentId)
      .maybeSingle();

    if (fetchErr || !comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    if (comment.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only edit your own comments.' });
    }

    const { data: updatedComment, error } = await supabaseAdmin
      .from('comments_zyntra')
      .update({
        comment_text: comment_text.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select(`
        id,
        post_id,
        user_id,
        comment_text,
        created_at,
        updated_at,
        users_zyntra:user_id(id, username, full_name, profile_image)
      `)
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Comment updated successfully.',
      comment: {
        id: updatedComment.id,
        post_id: updatedComment.post_id,
        comment_text: updatedComment.comment_text,
        created_at: updatedComment.created_at,
        updated_at: updatedComment.updated_at,
        author: updatedComment.users_zyntra,
        is_owner: true
      }
    });
  } catch (err) {
    console.error('updateComment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete comment (author or post owner)
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Fetch comment and associated post owner
    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('comments_zyntra')
      .select(`
        id,
        user_id,
        post_id,
        posts_zyntra:post_id(user_id)
      `)
      .eq('id', commentId)
      .maybeSingle();

    if (fetchErr || !comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const isCommentAuthor = (comment.user_id === userId);
    const isPostOwner = (comment.posts_zyntra && comment.posts_zyntra.user_id === userId);

    if (!isCommentAuthor && !isPostOwner) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You cannot delete this comment.'
      });
    }

    const { error } = await supabaseAdmin
      .from('comments_zyntra')
      .delete()
      .eq('id', commentId);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getComments,
  addComment,
  updateComment,
  deleteComment
};

