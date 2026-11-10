const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const AVATARS_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'zyntra-avatars';
const POSTS_BUCKET = process.env.SUPABASE_POSTS_BUCKET || 'zyntra-posts';

// Check if credentials are placeholders or set
const isConfigured = 
  SUPABASE_URL && 
  !SUPABASE_URL.includes('placeholder-project') && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_ANON_KEY.includes('placeholder-anon-key');

if (!isConfigured) {
  console.warn('---------------------------------------------------------');
  console.warn('⚠️  ZYNTRA NOTICE: Supabase credentials are not fully set.');
  console.warn('Please update .env with your real SUPABASE_URL and KEYS.');
  console.warn('Run supabase-schema.sql in your Supabase SQL Editor.');
  console.warn('---------------------------------------------------------');
}

// Service role client for backend operations
const supabaseAdmin = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Client-scoped client factory that respects user RLS via JWT
function getClientWithAuth(token) {
  if (!token) return supabaseAdmin;
  return createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'placeholder',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

// Upload file to Supabase Storage with local fallback
async function uploadToStorage(bucketName, fileName, buffer, mimeType) {
  try {
    if (isConfigured) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(fileName);
        return publicUrlData.publicUrl;
      }
      console.warn(`Storage upload error on bucket ${bucketName}:`, error?.message);
    }
  } catch (err) {
    console.warn(`Storage upload exception on bucket ${bucketName}:`, err.message);
  }

  // Graceful fallback to local uploads directory if Supabase Storage is not yet configured or fails
  const localDir = path.join(__dirname, '..', '..', 'public', 'uploads', bucketName);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const localFilePath = path.join(localDir, fileName);
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/${bucketName}/${fileName}`;
}

module.exports = {
  supabaseAdmin,
  getClientWithAuth,
  uploadToStorage,
  isConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  AVATARS_BUCKET,
  POSTS_BUCKET
};
