const { supabaseAdmin } = require('../config/supabase');

// Get all notifications for current user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications_zyntra')
      .select(`
        id,
        recipient_id,
        sender_id,
        notification_type,
        post_id,
        is_read,
        created_at,
        sender:sender_id(id, username, full_name, profile_image),
        post:post_id(id, image_url, caption)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      notifications: notifications || [],
      page,
      limit
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabaseAdmin
      .from('notifications_zyntra')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      unread_count: count || 0
    });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Mark notifications as read (either single notification by ID or all)
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.body;

    let query = supabaseAdmin
      .from('notifications_zyntra')
      .update({ is_read: true })
      .eq('recipient_id', userId);

    if (notificationId) {
      query = query.eq('id', notificationId);
    } else {
      query = query.eq('is_read', false);
    }

    const { error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Notifications marked as read.'
    });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead
};
