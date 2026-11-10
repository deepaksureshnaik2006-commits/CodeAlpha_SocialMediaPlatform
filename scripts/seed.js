/**
 * ZYNTRA - Database Seeder Script
 * Seeds sample creators, posts, comments, likes, and follows into Supabase.
 * Usage: node scripts/seed.js
 */

require('dotenv').config();
const { supabaseAdmin, isConfigured } = require('../backend/config/supabase');

const SAMPLE_USERS = [
  {
    email: 'elena.rostova@zyntra.demo',
    username: 'elenadesign',
    full_name: 'Elena Rostova',
    bio: 'Product Designer & 3D Artist based in Stockholm. Exploring light, textures, and brutalist forms.',
    profile_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  },
  {
    email: 'marcus.vance@zyntra.demo',
    username: 'marcusv',
    full_name: 'Marcus Vance',
    bio: 'Hardware engineer & urban photographer. Capturing the geometry of modern cities at night.',
    profile_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
  },
  {
    email: 'aria.chen@zyntra.demo',
    username: 'ariaphotos',
    full_name: 'Aria Chen',
    bio: 'Landscape & wildlife photographer. On a mission to document national parks worldwide 🌲',
    profile_image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
  },
  {
    email: 'devon.lane@zyntra.demo',
    username: 'devonlane',
    full_name: 'Devon Lane',
    bio: 'Coffee enthusiast, indie developer, and cyclist. Building things for the open web 🚀',
    profile_image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
  },
  {
    email: 'sarah.k@zyntra.demo',
    username: 'sarahcreates',
    full_name: 'Sarah Jenkins',
    bio: 'Ceramics maker & studio potter. Natural glazes and hand-built vessels.',
    profile_image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
  }
];

const SAMPLE_POSTS = [
  {
    user_index: 0, // Elena
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    caption: 'Exploring neo-minimalism aesthetics in 3D. Play of organic glass and deep violet refraction ✨ #Design #3D #ZYNTRA'
  },
  {
    user_index: 1, // Marcus
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    caption: 'Late night circuitry prototyping for our next drop. Clean routing and quiet focus 💻 #Engineering #Hardware'
  },
  {
    user_index: 2, // Aria
    image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    caption: 'Golden hour in Yosemite Valley. The stillness before sunset is something unforgettable 🌲 #Nature #Landscape'
  },
  {
    user_index: 3, // Devon
    image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    caption: 'Morning pour-over ritual before diving into deep work. Natural Ethiopian single origin ☕ #Coffee #Rituals'
  },
  {
    user_index: 4, // Sarah
    image_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80',
    caption: 'Fresh batch of stoneware mugs out of the kiln today. The iron-speckled glaze turned out better than imagined 🏺 #Ceramics'
  },
  {
    user_index: 0, // Elena
    image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Architectural shadows and clean lines from my studio visit this morning. Simplicity is difficult to master 🏛️'
  }
];

const SAMPLE_COMMENTS = [
  'Incredible composition and color palette!',
  'The details on this are truly stunning 🔥',
  'Loving the mood in this shot!',
  'Inspiring work as always.',
  'Need to visit this spot soon!'
];

async function seed() {
  console.log('🌱 Starting ZYNTRA Seed Script...\n');

  if (!isConfigured) {
    console.error('❌ Error: Supabase credentials are not configured in .env.');
    console.error('Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running seed.');
    process.exit(1);
  }

  try {
    const createdUsers = [];

    // 1. Create or Find Auth Users & Profiles in users_zyntra
    console.log('👤 Provisioning sample creators in users_zyntra...');
    for (const u of SAMPLE_USERS) {
      // Check if auth user exists or create
      let userId = null;

      // Try creating user in Supabase Auth
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: 'ZyntraDemoPassword123!',
        email_confirm: true,
        user_metadata: {
          username: u.username,
          full_name: u.full_name,
          profile_image: u.profile_image
        }
      });

      if (!authErr && authData?.user) {
        userId = authData.user.id;
      } else {
        // Find existing user in users_zyntra or auth
        const { data: existingUser } = await supabaseAdmin
          .from('users_zyntra')
          .select('id')
          .eq('username', u.username)
          .maybeSingle();

        if (existingUser) {
          userId = existingUser.id;
        }
      }

      if (userId) {
        // Upsert into users_zyntra
        const { data: profile } = await supabaseAdmin
          .from('users_zyntra')
          .upsert({
            id: userId,
            username: u.username,
            full_name: u.full_name,
            bio: u.bio,
            profile_image: u.profile_image,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        createdUsers.push(profile || { id: userId, username: u.username });
        console.log(`  ✓ Creator @${u.username} ready`);
      }
    }

    if (createdUsers.length < 2) {
      console.warn('⚠️ Could not provision enough sample users. Please check your Supabase Service Role Key.');
      return;
    }

    // 2. Establish Follow Graph in follows_zyntra
    console.log('\n🤝 Creating follow relationships in follows_zyntra...');
    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = 0; j < createdUsers.length; j++) {
        if (i !== j && (i + j) % 2 === 0) {
          try {
            await supabaseAdmin
              .from('follows_zyntra')
              .upsert({
                follower_id: createdUsers[i].id,
                following_id: createdUsers[j].id
              }, { onConflict: 'follower_id,following_id' });
          } catch (e) {}
        }
      }
    }
    console.log('  ✓ Follow graph established');

    // 3. Publish Sample Posts in posts_zyntra
    console.log('\n📸 Publishing sample posts in posts_zyntra...');
    const createdPosts = [];

    for (const p of SAMPLE_POSTS) {
      const author = createdUsers[p.user_index % createdUsers.length];
      if (!author) continue;

      const { data: post, error: postErr } = await supabaseAdmin
        .from('posts_zyntra')
        .insert({
          user_id: author.id,
          image_url: p.image_url,
          caption: p.caption
        })
        .select()
        .single();

      if (!postErr && post) {
        createdPosts.push(post);
        console.log(`  ✓ Post published for @${author.username}`);
      }
    }

    // 4. Add Likes in likes_zyntra & Comments in comments_zyntra
    console.log('\n❤️ Generating likes, comments, and notifications...');
    for (const post of createdPosts) {
      for (const user of createdUsers) {
        // Randomly like
        if (Math.random() > 0.3) {
          try {
            await supabaseAdmin
              .from('likes_zyntra')
              .upsert({
                post_id: post.id,
                user_id: user.id
              }, { onConflict: 'post_id,user_id' });
          } catch (e) {}
        }

        // Randomly comment
        if (Math.random() > 0.6) {
          try {
            const commentText = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
            await supabaseAdmin
              .from('comments_zyntra')
              .insert({
                post_id: post.id,
                user_id: user.id,
                comment_text: commentText
              });
          } catch (e) {}
        }
      }
    }

    console.log('\n✨ Database seeding completed successfully!');
    console.log('You can now log in or explore the live community in ZYNTRA.');
  } catch (err) {
    console.error('Seeder encountered an error:', err);
  }
}

seed();
