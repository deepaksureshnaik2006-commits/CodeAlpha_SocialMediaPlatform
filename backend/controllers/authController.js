const { supabaseAdmin, SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } = require('../config/supabase');

// Provide public Supabase config to frontend safely
const getConfig = (req, res) => {
  res.json({
    success: true,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    isConfigured
  });
};

// Check username availability
const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check if taken
    const { data, error } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ success: false, message: error.message });
    }

    const isAvailable = !data || (req.user && data.id === req.user.id);

    return res.json({
      success: true,
      available: isAvailable,
      username: cleanUsername
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Complete or sync profile right after Supabase Auth registration
const syncProfile = async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { username, full_name, bio, profile_image } = req.body;

    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A unique username of at least 3 characters is required.'
      });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '_');

    // Check if username is already taken by another user
    const { data: existingUser } = await supabaseAdmin
      .from('users_zyntra')
      .select('id')
      .eq('username', cleanUsername)
      .neq('id', userId)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'This username is already taken. Please choose another one.'
      });
    }

    // Upsert into users_zyntra
    const profilePayload = {
      id: userId,
      username: cleanUsername,
      full_name: full_name?.trim() || cleanUsername,
      bio: bio?.trim() || '',
      updated_at: new Date().toISOString()
    };

    if (profile_image) {
      profilePayload.profile_image = profile_image;
    }

    const { data: profile, error } = await supabaseAdmin
      .from('users_zyntra')
      .upsert(profilePayload)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile: ' + error.message
      });
    }

    return res.json({
      success: true,
      message: 'Profile synchronized successfully!',
      profile
    });
  } catch (err) {
    console.error('syncProfile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getConfig,
  checkUsername,
  syncProfile
};

