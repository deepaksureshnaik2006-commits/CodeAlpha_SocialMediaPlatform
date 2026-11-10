require('dotenv').config();
const { supabaseAdmin } = require('../backend/config/supabase');

async function autoCreateBuckets() {
  console.log('📦 Attempting to auto-provision Supabase Storage buckets...');
  try {
    const { data: b1, error: e1 } = await supabaseAdmin.storage.createBucket('zyntra-avatars', {
      public: true,
      fileSizeLimit: 10485760 // 10MB
    });
    if (e1) {
      console.log('  zyntra-avatars:', e1.message);
    } else {
      console.log('  ✅ Created bucket: zyntra-avatars');
    }

    const { data: b2, error: e2 } = await supabaseAdmin.storage.createBucket('zyntra-posts', {
      public: true,
      fileSizeLimit: 10485760 // 10MB
    });
    if (e2) {
      console.log('  zyntra-posts:', e2.message);
    } else {
      console.log('  ✅ Created bucket: zyntra-posts');
    }
  } catch (err) {
    console.error('Bucket creation error:', err.message);
  }
}

autoCreateBuckets();

