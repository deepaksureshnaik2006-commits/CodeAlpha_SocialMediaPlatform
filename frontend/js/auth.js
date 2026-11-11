/**
 * ZYNTRA - Authentication Controller
 * Handles Supabase Auth sessions, login, signup, password resets, and route guards.
 */

const Auth = {
  // Sign Up with Email & Password — tries backend first, falls back to Supabase direct
  async signUp({ email, password, username, full_name, bio = '', profile_image = '' }) {
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Try backend registration (auto-confirmed, no email link needed)
    let backendOk = false;
    try {
      const registerRes = await window.API.post('/api/auth/register', {
        email: cleanEmail,
        password,
        username: cleanUsername,
        full_name: full_name?.trim() || cleanUsername,
        bio: bio?.trim() || ''
      });

      if (registerRes && registerRes.success) {
        backendOk = true;
      } else if (registerRes && registerRes.message) {
        // Backend responded with a business error (e.g. username taken)
        throw new Error(registerRes.message);
      }
    } catch (backendErr) {
      // If the error is a business error (username taken, email taken) re-throw it
      if (backendErr.message && (
        backendErr.message.toLowerCase().includes('taken') ||
        backendErr.message.toLowerCase().includes('already') ||
        backendErr.message.toLowerCase().includes('exists') ||
        backendErr.message.toLowerCase().includes('required')
      )) {
        throw backendErr;
      }
      // Otherwise server is not reachable — fall through to Supabase direct path
      console.warn('Backend register unavailable, falling back to Supabase direct:', backendErr.message);
    }

    // 2. Fallback: register directly via Supabase client (requires email confirm in Supabase dashboard disabled)
    if (!backendOk) {
      const sb = await window.ZyntraSupabase.init();
      if (!sb) throw new Error('Could not connect to authentication service. Please ensure the server is running.');

      const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { username: cleanUsername, full_name: full_name?.trim() || cleanUsername, bio: bio?.trim() || '' }
        }
      });

      if (signUpErr) throw new Error(signUpErr.message);

      // Sync profile via backend if reachable
      try {
        await window.API.post('/api/auth/sync-profile', {
          username: cleanUsername,
          full_name: full_name?.trim() || cleanUsername,
          bio: bio?.trim() || ''
        });
      } catch (e) { /* ignore sync failure */ }
    }

    // 3. Sign in immediately with pre-cached profile to save round-trip
    const initialProfile = {
      email: cleanEmail,
      username: cleanUsername,
      full_name: full_name?.trim() || cleanUsername,
      bio: bio?.trim() || '',
      posts_count: 0,
      followers_count: 0,
      following_count: 0,
      is_private: false
    };

    const signInResult = await this.signIn(cleanEmail, password, initialProfile);
    return { session: signInResult.session };
  },

  // Sign In with Email & Password
  async signIn(email, password, preCachedProfile = null) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Unable to connect to authentication service. Please try again.');

    const cleanEmail = email.toLowerCase().trim();

    let { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    // If Supabase reports email not confirmed, auto-confirm via backend and retry
    if (error && error.message && error.message.toLowerCase().includes('not confirmed')) {
      try {
        await window.API.post('/api/auth/auto-confirm', { email: cleanEmail });
        const retry = await sb.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (retry.data && retry.data.session) {
          data = retry.data;
          error = null;
        } else if (retry.error) {
          error = retry.error;
        }
      } catch (confirmErr) {
        console.warn('Auto-confirm retry error:', confirmErr);
      }
    }

    if (error) throw error;

    // Cache user profile
    if (preCachedProfile) {
      const cached = { ...preCachedProfile, id: data.user?.id || '' };
      localStorage.setItem('zyntra_user_cached', JSON.stringify(cached));
    } else {
      try {
        const userRes = await window.API.get('/api/users/me');
        if (userRes.success) {
          localStorage.setItem('zyntra_user_cached', JSON.stringify(userRes.user));
        }
      } catch (e) {
        console.warn('Could not cache user profile:', e);
      }
    }

    return data;
  },

  // Sign Out (local or global across all devices)
  async signOut(scope = 'local') {
    try {
      const sb = await window.ZyntraSupabase.init();
      if (sb) {
        await sb.auth.signOut({ scope });
      }
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      localStorage.removeItem('zyntra_user_cached');
      window.location.href = '/login';
    }
  },

  // Request Password Reset Link
  async resetPassword(email) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Unable to connect to authentication service. Please try again.');

    const redirectUrl = `${window.location.origin}/forgot-password`;
    const { data, error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) throw error;
    return data;
  },

  // Update password (used on password reset callback)
  async updatePassword(newPassword) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Unable to connect to authentication service. Please try again.');

    const { data, error } = await sb.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  },

  // Get currently logged-in user profile
  async getCurrentUser(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem('zyntra_user_cached');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }

    try {
      const res = await window.API.get('/api/users/me');
      if (res.success && res.user) {
        localStorage.setItem('zyntra_user_cached', JSON.stringify(res.user));
        return res.user;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  // Guard for protected pages (feed, profile, create post, etc.)
  async requireAuth() {
    const session = await window.ZyntraSupabase.getSession();
    if (!session) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }
    const user = await this.getCurrentUser();
    return user;
  },

  // Guard for public pages (login, register) - redirect to feed if already logged in
  async redirectIfAuthenticated() {
    const session = await window.ZyntraSupabase.getSession();
    if (session) {
      window.location.href = '/feed';
    }
  }
};

window.Auth = Auth;

