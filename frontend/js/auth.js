/**
 * ZYNTRA - Authentication Controller
 * Handles Supabase Auth sessions, login, signup, password resets, and route guards.
 */

const Auth = {
  // Sign Up with Email & Password
  async signUp({ email, password, username, full_name, bio = '', profile_image = '' }) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Supabase client could not be initialized.');

    // 1. Supabase Auth Sign Up
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase().trim(),
          full_name: full_name.trim(),
          bio: bio.trim(),
          profile_image
        }
      }
    });

    if (error) throw error;

    // 2. If session established immediately, sync profile with users_zyntra table
    if (data.session) {
      try {
        await window.API.post('/api/auth/sync-profile', {
          username,
          full_name,
          bio,
          profile_image
        });
      } catch (syncErr) {
        console.warn('Initial profile sync warning:', syncErr.message);
      }
    }

    return data;
  },

  // Sign In with Email & Password
  async signIn(email, password) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Supabase client could not be initialized.');

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Cache user profile
    try {
      const userRes = await window.API.get('/api/users/me');
      if (userRes.success) {
        localStorage.setItem('zyntra_user_cached', JSON.stringify(userRes.user));
      }
    } catch (e) {
      console.warn('Could not cache user profile:', e);
    }

    return data;
  },

  // Sign Out
  async signOut() {
    try {
      const sb = await window.ZyntraSupabase.init();
      if (sb) {
        await sb.auth.signOut();
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
    if (!sb) throw new Error('Supabase client could not be initialized.');

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
    if (!sb) throw new Error('Supabase client could not be initialized.');

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

