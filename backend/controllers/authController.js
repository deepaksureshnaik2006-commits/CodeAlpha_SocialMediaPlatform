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

// Direct Registration with Auto-Confirm (No email confirmation required!)
const register = async (req, res) => {
  try {
    const { email, password, username, full_name, bio } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and username are required.'
      });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '_');
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if username is already taken in users_zyntra
    const { data: existingUsername } = await supabaseAdmin
      .from('users_zyntra')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: `The username "@${cleanUsername}" is already taken. Please choose a different one.`
      });
    }

    // 2. Create user directly via admin API with email_confirm: true (AUTO-CONFIRMED, no listUsers delay)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        full_name: full_name?.trim() || cleanUsername,
        bio: bio?.trim() || ''
      }
    });

    if (createErr) {
      const errMsg = createErr.message || '';
      if (
        errMsg.toLowerCase().includes('already') ||
        errMsg.toLowerCase().includes('exists') ||
        createErr.status === 422 ||
        createErr.code === 'email_exists'
      ) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists. Please log in instead.'
        });
      }
      return res.status(400).json({
        success: false,
        message: errMsg || 'Failed to create user account.'
      });
    }

    const targetUser = created.user;

    // 4. Upsert user into users_zyntra table
    const { error: profileErr } = await supabaseAdmin
      .from('users_zyntra')
      .upsert({
        id: targetUser.id,
        username: cleanUsername,
        full_name: full_name?.trim() || cleanUsername,
        bio: bio?.trim() || '',
        updated_at: new Date().toISOString()
      });

    if (profileErr) {
      console.warn('Profile sync warning:', profileErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: targetUser.id,
        email: cleanEmail,
        username: cleanUsername
      }
    });
  } catch (err) {
    console.error('register controller error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Registration failed.' });
  }
};

// Auto-confirm any pending unconfirmed user on login
const autoConfirm = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const cleanEmail = email.trim().toLowerCase();
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const target = users ? users.find(u => u.email?.toLowerCase() === cleanEmail) : null;

    if (target && !target.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(target.id, {
        email_confirm: true
      });
      return res.json({ success: true, message: 'Email auto-confirmed' });
    }

    return res.json({ success: true, message: 'Already confirmed' });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
};

module.exports = {
  getConfig,
  checkUsername,
  syncProfile,
  register,
  autoConfirm
};

