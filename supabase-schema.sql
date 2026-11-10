-- =====================================================================
-- ZYNTRA DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Tagline: Connect. Share. Discover.
-- IMPORTANT: Every application-created table MUST end with `_zyntra`.
-- =====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. USERS TABLE (users_zyntra)
-- References auth.users(id) managed by Supabase Auth
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users_zyntra (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    bio TEXT DEFAULT '',
    profile_image TEXT DEFAULT '',
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure is_private exists if table already created
ALTER TABLE public.users_zyntra ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Index for username lookups and profile queries
CREATE INDEX IF NOT EXISTS idx_users_zyntra_username ON public.users_zyntra (username);

-- =====================================================================
-- 2. POSTS TABLE (posts_zyntra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.posts_zyntra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for post feed queries (chronological ordering) and user posts
CREATE INDEX IF NOT EXISTS idx_posts_zyntra_user_id ON public.posts_zyntra (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_zyntra_created_at ON public.posts_zyntra (created_at DESC);

-- =====================================================================
-- 3. COMMENTS TABLE (comments_zyntra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.comments_zyntra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts_zyntra(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments on posts
CREATE INDEX IF NOT EXISTS idx_comments_zyntra_post_id ON public.comments_zyntra (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_zyntra_user_id ON public.comments_zyntra (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_zyntra_created_at ON public.comments_zyntra (created_at ASC);

-- =====================================================================
-- 4. LIKES TABLE (likes_zyntra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.likes_zyntra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts_zyntra(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_post_user_like_zyntra UNIQUE (post_id, user_id)
);

-- Indexes for likes lookup
CREATE INDEX IF NOT EXISTS idx_likes_zyntra_post_id ON public.likes_zyntra (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_zyntra_user_id ON public.likes_zyntra (user_id);

-- =====================================================================
-- 5. FOLLOWS TABLE (follows_zyntra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.follows_zyntra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_follower_following_zyntra UNIQUE (follower_id, following_id),
    CONSTRAINT check_no_self_follow_zyntra CHECK (follower_id <> following_id)
);

-- Indexes for followers and following lookups
CREATE INDEX IF NOT EXISTS idx_follows_zyntra_follower ON public.follows_zyntra (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_zyntra_following ON public.follows_zyntra (following_id);

-- =====================================================================
-- 6. NOTIFICATIONS TABLE (notifications_zyntra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications_zyntra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users_zyntra(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'like', 'comment', 'follow'
    post_id UUID REFERENCES public.posts_zyntra(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_zyntra_recipient ON public.notifications_zyntra (recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_zyntra_created_at ON public.notifications_zyntra (created_at DESC);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.users_zyntra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts_zyntra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments_zyntra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes_zyntra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows_zyntra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_zyntra ENABLE ROW LEVEL SECURITY;

-- 2. users_zyntra policies
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.users_zyntra FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON public.users_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.users_zyntra FOR UPDATE 
    USING (auth.uid() = id);

-- 3. posts_zyntra policies
CREATE POLICY "Posts are viewable by everyone" 
    ON public.posts_zyntra FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can insert their own posts" 
    ON public.posts_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
    ON public.posts_zyntra FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
    ON public.posts_zyntra FOR DELETE 
    USING (auth.uid() = user_id);

-- 4. comments_zyntra policies
CREATE POLICY "Comments are viewable by everyone" 
    ON public.comments_zyntra FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can insert comments" 
    ON public.comments_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
    ON public.comments_zyntra FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments or post owners can delete" 
    ON public.comments_zyntra FOR DELETE 
    USING (
        auth.uid() = user_id 
        OR auth.uid() IN (SELECT user_id FROM public.posts_zyntra WHERE id = comments_zyntra.post_id)
    );

-- 5. likes_zyntra policies
CREATE POLICY "Likes are viewable by everyone" 
    ON public.likes_zyntra FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can insert likes" 
    ON public.likes_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" 
    ON public.likes_zyntra FOR DELETE 
    USING (auth.uid() = user_id);

-- 6. follows_zyntra policies
CREATE POLICY "Follows are viewable by everyone" 
    ON public.follows_zyntra FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can follow others" 
    ON public.follows_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = follower_id AND auth.uid() <> following_id);

CREATE POLICY "Authenticated users can unfollow" 
    ON public.follows_zyntra FOR DELETE 
    USING (auth.uid() = follower_id);

-- 7. notifications_zyntra policies
CREATE POLICY "Users can view their own notifications" 
    ON public.notifications_zyntra FOR SELECT 
    USING (auth.uid() = recipient_id);

CREATE POLICY "Authenticated users can insert notifications" 
    ON public.notifications_zyntra FOR INSERT 
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update read status on their own notifications" 
    ON public.notifications_zyntra FOR UPDATE 
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete their own notifications" 
    ON public.notifications_zyntra FOR DELETE 
    USING (auth.uid() = recipient_id);

-- =====================================================================
-- STORAGE BUCKETS SETUP (Run in Supabase SQL editor)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('zyntra-avatars', 'zyntra-avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('zyntra-posts', 'zyntra-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for zyntra-avatars
CREATE POLICY "Public Avatar Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'zyntra-avatars');

CREATE POLICY "Authenticated User Avatar Upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'zyntra-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users Can Update Their Own Avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'zyntra-avatars' AND auth.uid() = owner);

CREATE POLICY "Users Can Delete Their Own Avatar"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'zyntra-avatars' AND auth.uid() = owner);

-- Storage RLS Policies for zyntra-posts
CREATE POLICY "Public Post Image Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'zyntra-posts');

CREATE POLICY "Authenticated User Post Image Upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'zyntra-posts' AND auth.role() = 'authenticated');

CREATE POLICY "Users Can Update Their Own Post Image"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'zyntra-posts' AND auth.uid() = owner);

CREATE POLICY "Users Can Delete Their Own Post Image"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'zyntra-posts' AND auth.uid() = owner);

-- =====================================================================
-- OPTIONAL AUTOMATIC TRIGGER TO SYNC NEW AUTH USERS TO USERS_ZYNTRA
-- Automatically provisions profile when user registers via Supabase Auth
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_zyntra()
RETURNS TRIGGER AS $$
DECLARE
    clean_username TEXT;
BEGIN
    -- Extract username from metadata if provided, otherwise derive from email
    clean_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTRING(NEW.id::text, 1, 4)
    );

    INSERT INTO public.users_zyntra (id, username, full_name, bio, profile_image)
    VALUES (
        NEW.id,
        clean_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', clean_username),
        COALESCE(NEW.raw_user_meta_data->>'bio', ''),
        COALESCE(NEW.raw_user_meta_data->>'profile_image', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_zyntra ON auth.users;
CREATE TRIGGER on_auth_user_created_zyntra
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_zyntra();

