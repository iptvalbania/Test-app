require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── In-memory stores ──────────────────────────────────────────────────────────
// users: { [userId]: { id, displayName, email, photo } }
const users = {};
// todos: { [userId]: [{ id, title, completed, createdAt }] }
const todosByUser = {};

function getUserTodos(userId) {
  if (!todosByUser[userId]) todosByUser[userId] = [];
  return todosByUser[userId];
}

// ── Passport ──────────────────────────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  },
  (_accessToken, _refreshToken, profile, done) => {
    // Upsert user in memory
    if (!users[profile.id]) {
      users[profile.id] = {
        id:          profile.id,
        displayName: profile.displayName,
        email:       (profile.emails?.[0]?.value) || '',
        photo:       (profile.photos?.[0]?.value) || '',
      };
      // Seed a couple of sample todos for new users
      todosByUser[profile.id] = [
        { id: uuidv4(), title: 'Welcome! Double-click a todo to edit it', completed: false, createdAt: new Date().toISOString() },
        { id: uuidv4(), title: 'Try completing this task',                completed: false, createdAt: new Date().toISOString() },
      ];
    }
    return done(null, users[profile.id]);
  }
));

passport.serializeUser((user, done)   => done(null, user.id));
passport.deserializeUser((id, done)   => done(null, users[id] || false));

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'todo-app-dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// ── Auth routes ───────────────────────────────────────────────────────────────
// Kick off Google OAuth flow
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (_req, res) => res.redirect('/')
);

// Logout
app.post('/auth/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

// Current user info (used by the frontend to check auth state)
app.get('/auth/me', (req, res) => {
  if (!req.isAuthenticated()) return res.json(null);
  const { id, displayName, email, photo } = req.user;
  res.json({ id, displayName, email, photo });
});

// ── Todo API (all routes require auth) ───────────────────────────────────────

// GET /api/todos
app.get('/api/todos', requireAuth, (req, res) => {
  let list = getUserTodos(req.user.id);
  if (req.query.completed !== undefined) {
    const flag = req.query.completed === 'true';
    list = list.filter(t => t.completed === flag);
  }
  res.json(list);
});

// GET /api/todos/:id
app.get('/api/todos/:id', requireAuth, (req, res) => {
  const todo = getUserTodos(req.user.id).find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

// POST /api/todos
app.post('/api/todos', requireAuth, (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

  const todo = {
    id:        uuidv4(),
    title:     title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  getUserTodos(req.user.id).push(todo);
  res.status(201).json(todo);
});

// PUT /api/todos/:id
app.put('/api/todos/:id', requireAuth, (req, res) => {
  const list  = getUserTodos(req.user.id);
  const index = list.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });

  const { title, completed } = req.body;
  if (title     !== undefined) list[index].title     = title.trim();
  if (completed !== undefined) list[index].completed = Boolean(completed);

  res.json(list[index]);
});

// DELETE /api/todos/:id
app.delete('/api/todos/:id', requireAuth, (req, res) => {
  const list  = getUserTodos(req.user.id);
  const index = list.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });

  const [deleted] = list.splice(index, 1);
  res.json(deleted);
});

// DELETE /api/todos  — clear completed
app.delete('/api/todos', requireAuth, (req, res) => {
  const list    = getUserTodos(req.user.id);
  const removed = list.filter(t => t.completed).length;
  todosByUser[req.user.id] = list.filter(t => !t.completed);
  res.json({ deleted: removed });
});

// ── Fallback → SPA ────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Todo app running at http://localhost:${PORT}`);
});

module.exports = app;
