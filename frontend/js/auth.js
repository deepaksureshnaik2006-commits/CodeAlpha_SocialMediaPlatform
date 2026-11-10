/**
 * ZYNTRA - Authentication Controller
 * Handles Supabase Auth sessions, login, signup, password resets, and route guards.
 */

const Auth = {
  // Sign Up with Email & Password (AUTO-CONFIRMED, IMMEDIATE SIGN-IN)
  async signUp({ email, password, username, full_name, bio = '', profile_image = '' }) {
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Register through backend with email_confirm: true (AUTO-CONFIRMED, NO EMAIL LINK NEEDED!)
    const registerRes = await window.API.post('/api/auth/register', {
      email: cleanEmail,
      password,
      username: cleanUsername,
      full_name: full_name?.trim() || cleanUsername,
      bio: bio?.trim() || ''
    });

    if (!registerRes.success) {
      throw new Error(registerRes.message || 'Registration failed.');
    }

    // 2. Automatically sign in immediately with Supabase client
    const signInResult = await this.signIn(cleanEmail, password);

    return {
      user: registerRes.user,
      session: signInResult.session
    };
  },

  // Sign In with Email & Password
  async signIn(email, password) {
    const sb = await window.ZyntraSupabase.init();
    if (!sb) throw new Error('Supabase client could not be initialized.');

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

