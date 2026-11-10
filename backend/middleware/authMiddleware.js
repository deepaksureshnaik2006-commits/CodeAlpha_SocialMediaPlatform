const { supabaseAdmin, getClientWithAuth } = require('../config/supabase');

// Middleware to require authenticated user
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing.'
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.',
        error: error?.message
      });
    }

    // Attach user and scoped client to request
    req.token = token;
    req.authUser = user;
    req.supabase = getClientWithAuth(token);

    // Fetch user profile from users_zyntra
    let { data: profile, error: profileErr } = await supabaseAdmin
      .from('users_zyntra')
      .select('*')
      .eq('id', user.id)
      .single();

    // If profile row doesn't exist yet, auto-provision it
    if (!profile) {
      const defaultUsername = (
        user.user_metadata?.username ||
        user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + user.id.slice(0, 4)
      ).toLowerCase();

      const fullName = user.user_metadata?.full_name || defaultUsername;
      const avatarUrl = user.user_metadata?.profile_image || '';

      const { data: newProfile, error: createErr } = await supabaseAdmin
        .from('users_zyntra')
        .insert({
          id: user.id,
          username: defaultUsername,
          full_name: fullName,
          bio: 'Hey there! I am using ZYNTRA.',
          profile_image: avatarUrl
        })
        .select()
        .single();

      if (!createErr && newProfile) {
        profile = newProfile;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      ...profile
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Authentication verification failure',
      error: err.message
    });
  }
}

// Optional auth middleware for routes that show personalized info when logged in
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          req.token = token;
          req.authUser = user;
          req.supabase = getClientWithAuth(token);

          const { data: profile } = await supabaseAdmin
            .from('users_zyntra')
            .select('*')
            .eq('id', user.id)
            .single();

          req.user = {
            id: user.id,
            email: user.email,
            ...profile
          };
        }
      }
    }
  } catch (err) {
    // Silently continue without user
    req.user = null;
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};

