require('dotenv').config();
const { supabaseAdmin } = require('../backend/config/supabase');

async function checkDatabase() {
  console.log('🔍 Testing connection to Supabase Project:');
  console.log(`URL: ${process.env.SUPABASE_URL}\n`);

  const tables = [
    'users_zyntra',
    'posts_zyntra',
    'comments_zyntra',
    'likes_zyntra',
    'follows_zyntra',
    'notifications_zyntra'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('id').limit(1);
      if (error) {
        if (error.code === '42P01') {
          console.log(`  ⏳ Table '${table}' does not exist yet. (Needs supabase-schema.sql executed in SQL Editor)`);
        } else {
          console.log(`  ⚠️ Table '${table}' error: ${error.message} (code: ${error.code})`);
        }
      } else {
        console.log(`  ✅ Table '${table}' is active and accessible!`);
      }
    } catch (e) {
      console.log(`  ❌ Table '${table}' connection failed: ${e.message}`);
    }
  }

  // Check Storage buckets
  try {
    const { data: buckets, error: bucketErr } = await supabaseAdmin.storage.listBuckets();
    if (bucketErr) {
      console.log(`  ⚠️ Storage buckets check: ${bucketErr.message}`);
    } else {
      const bucketNames = (buckets || []).map(b => b.name);
      console.log(`\n📦 Storage Buckets found:`, bucketNames.length > 0 ? bucketNames.join(', ') : 'None yet');
      console.log(`  - 'zyntra-avatars': ${bucketNames.includes('zyntra-avatars') ? '✅ Present' : '⏳ Missing (run SQL)'}`);
      console.log(`  - 'zyntra-posts': ${bucketNames.includes('zyntra-posts') ? '✅ Present' : '⏳ Missing (run SQL)'}`);
    }
  } catch (e) {
    console.log(`  ❌ Storage check exception: ${e.message}`);
  }
}

checkDatabase().catch(console.error);
