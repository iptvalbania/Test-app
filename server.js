const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── In-memory store ───────────────────────────────────────────────────────────
let todos = [
  { id: uuidv4(), title: 'Buy groceries', completed: false, createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Read a book',   completed: false, createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Go for a walk', completed: true,  createdAt: new Date().toISOString() },
];

// ── Game state ────────────────────────────────────────────────────────────────
let gameState = {
  points: 0,
  totalCompleted: 0,
  level: 1,
  streak: 0,
  lastCompletedDate: null,
  unlockedAchievements: [],
};

const XP_PER_TASK = 10;
const XP_PER_LEVEL = 100;

const ACHIEVEMENTS = [
  { id: 'first',     name: 'First Step',    desc: 'Complete your first task', icon: '🌱', type: 'tasks',  threshold: 1  },
  { id: 'five',      name: 'Getting Going', desc: 'Complete 5 tasks',         icon: '⚡', type: 'tasks',  threshold: 5  },
  { id: 'ten',       name: 'Productive',    desc: 'Complete 10 tasks',        icon: '💪', type: 'tasks',  threshold: 10 },
  { id: 'twentyfive',name: 'Task Machine',  desc: 'Complete 25 tasks',        icon: '🚀', type: 'tasks',  threshold: 25 },
  { id: 'streak3',   name: 'On a Roll',     desc: '3-day streak',             icon: '🔥', type: 'streak', threshold: 3  },
  { id: 'streak7',   name: 'Week Warrior',  desc: '7-day streak',             icon: '⚔️', type: 'streak', threshold: 7  },
];

function calcLevel(points) { return Math.floor(points / XP_PER_LEVEL) + 1; }
function calcXpInLevel(points) { return points % XP_PER_LEVEL; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function recordCompletion() {
  const today = todayStr();
  const newlyUnlocked = [];

  gameState.points += XP_PER_TASK;
  gameState.totalCompleted += 1;

  if (gameState.lastCompletedDate === today) {
    // same day — streak unchanged
  } else if (gameState.lastCompletedDate === yesterdayStr()) {
    gameState.streak += 1;
  } else {
    gameState.streak = 1;
  }
  gameState.lastCompletedDate = today;
  gameState.level = calcLevel(gameState.points);

  for (const ach of ACHIEVEMENTS) {
    if (gameState.unlockedAchievements.includes(ach.id)) continue;
    const val = ach.type === 'streak' ? gameState.streak : gameState.totalCompleted;
    if (val >= ach.threshold) {
      gameState.unlockedAchievements.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

function gameResponse() {
  return {
    ...gameState,
    xpInLevel: calcXpInLevel(gameState.points),
    xpPerLevel: XP_PER_LEVEL,
    xpPerTask: XP_PER_TASK,
    achievements: ACHIEVEMENTS,
  };
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Todo routes ───────────────────────────────────────────────────────────────
app.get('/api/todos', (req, res) => {
  let result = todos;
  if (req.query.completed !== undefined) {
    const flag = req.query.completed === 'true';
    result = todos.filter(t => t.completed === flag);
  }
  res.json(result);
});

app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const todo = { id: uuidv4(), title: title.trim(), completed: false, createdAt: new Date().toISOString() };
  todos.push(todo);
  res.status(201).json(todo);
});

app.put('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });

  const wasCompleted = todos[index].completed;
  const { title, completed } = req.body;
  if (title !== undefined) todos[index].title = title.trim();
  if (completed !== undefined) todos[index].completed = Boolean(completed);

  let newlyUnlocked = [];
  if (!wasCompleted && todos[index].completed) {
    newlyUnlocked = recordCompletion();
  }

  res.json({ todo: todos[index], game: gameResponse(), newlyUnlocked });
});

app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  res.json(todos.splice(index, 1)[0]);
});

app.delete('/api/todos', (req, res) => {
  const removed = todos.filter(t => t.completed);
  todos = todos.filter(t => !t.completed);
  res.json({ deleted: removed.length });
});

// ── Game route ────────────────────────────────────────────────────────────────
app.get('/api/game', (req, res) => res.json(gameResponse()));

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Todo app running at http://localhost:${PORT}`));
module.exports = app;
