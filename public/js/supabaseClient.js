/**
 * ZYNTRA - Supabase Client Initialization
 * Connect. Share. Discover.
 */

let supabaseInstance = null;
let supabaseConfig = null;

// Initialize Supabase from backend config
async function initSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    supabaseConfig = data;

    if (!data.supabaseUrl || !data.supabaseAnonKey || data.supabaseUrl.includes('placeholder-project')) {
      console.warn('⚠️ Supabase credentials are placeholder. Provide credentials in .env');
    }

    // Official Supabase JS is loaded from CDN on page
    if (window.supabase && data.supabaseUrl && data.supabaseAnonKey) {
      supabaseInstance = window.supabase.createClient(data.supabaseUrl, data.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } else {
      console.error('Supabase library not available on window or missing config');
    }

    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

function getSupabase() {
  return supabaseInstance;
}

async function getSession() {
  const sb = await initSupabaseClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function getToken() {
  const session = await getSession();
  return session ? session.access_token : null;
}

// Attach to window
window.ZyntraSupabase = {
  init: initSupabaseClient,
  get: getSupabase,
  getSession,
  getToken
};
