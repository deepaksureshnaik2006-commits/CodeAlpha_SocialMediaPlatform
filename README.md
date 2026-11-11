# CodeAlpha_SocialMediaPlatform

> **ZYNTRA** — *Connect. Share. Discover.*

**ZYNTRA** is a modern, responsive full-stack social networking platform designed to deliver a smooth and engaging community experience. Inspired by modern photo and video sharing platforms, ZYNTRA empowers users to publish multimedia posts and video reels, build interactive follow networks, engage through instant likes and threaded discussions, and manage personalized profiles with granular privacy controls.

Built with clean architecture and performance in mind, the platform features a lightweight **Vanilla JavaScript, HTML5, and CSS3** frontend paired with a robust **Node.js & Express.js** REST API backend and a **relational PostgreSQL** database with Row-Level Security (RLS).

---

## 🌟 Core Features

- 👤 **User Profiles & Authentication:** Secure registration, login, profile customization (avatar, bio, display name), follower/following counts, and private account privacy gating with follow request approval.
- 📸 **Posts & Video Reels:** Upload photos and video reels with captions, responsive media grid, chronological feed, and explore discovery page.
- ❤️ **Interactive Likes:** Double-tap heart animation, real-time like counters, and modal displaying users who liked a post.
- 💬 **Comments System:** Real-time comment threads on posts with author timestamps and delete controls.
- 🤝 **Follow Network:** Dynamic follow/unfollow system with dedicated followers and following lists.
- 🔔 **In-App Notifications:** Real-time notifications for new followers, likes, comments, and follow requests.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3, Lucide Icons |
| **Backend** | Node.js, Express.js, Multer |
| **Database & Auth** | PostgreSQL, JWT Authentication |
| **Storage** | Cloud Media Storage (Avatars & Posts) |

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/deepaksureshnaik2006-commits/CodeAlpha_SocialMediaPlatform.git
cd CodeAlpha_SocialMediaPlatform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Configure your database and storage credentials in `.env`:
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your-database-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_AVATARS_BUCKET=zyntra-avatars
SUPABASE_POSTS_BUCKET=zyntra-posts
```

### 4. Database Setup
Execute [`supabase-schema.sql`](./supabase-schema.sql) in your database SQL editor to create all required tables (`_zyntra`), constraints, and security policies.

### 5. Run Tests
```bash
npm test
```

### 6. Start the Server
```bash
npm start
```
Visit `http://localhost:5000` in your browser.
