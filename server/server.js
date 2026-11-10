const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

// Static uploads directory (for local storage fallback)
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api', apiRoutes);

// Clean Page Routing mapped to static HTML views
const publicPath = path.join(__dirname, '..', 'public');

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(publicPath, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(publicPath, 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(publicPath, 'forgot-password.html')));
app.get('/feed', (req, res) => res.sendFile(path.join(publicPath, 'feed.html')));
app.get('/explore', (req, res) => res.sendFile(path.join(publicPath, 'explore.html')));
app.get('/create-post', (req, res) => res.sendFile(path.join(publicPath, 'create-post.html')));
app.get('/create', (req, res) => res.sendFile(path.join(publicPath, 'create-post.html')));
app.get('/post/:id', (req, res) => res.sendFile(path.join(publicPath, 'post.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(publicPath, 'profile.html')));
app.get('/edit-profile', (req, res) => res.sendFile(path.join(publicPath, 'edit-profile.html')));
app.get('/user/:username', (req, res) => res.sendFile(path.join(publicPath, 'user.html')));
app.get('/u/:username', (req, res) => res.sendFile(path.join(publicPath, 'user.html')));
app.get('/user/:username/followers', (req, res) => res.sendFile(path.join(publicPath, 'followers.html')));
app.get('/user/:username/following', (req, res) => res.sendFile(path.join(publicPath, 'following.html')));
app.get('/notifications', (req, res) => res.sendFile(path.join(publicPath, 'notifications.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(publicPath, 'settings.html')));

// Catch-all 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ZYNTRA Server running on: http://localhost:${PORT}`);
  console.log(`✨ Tagline: Connect. Share. Discover.`);
  console.log(`📁 Static files served from: ${publicPath}`);
  console.log(`=======================================================`);
});
