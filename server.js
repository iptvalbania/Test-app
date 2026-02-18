const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store
let todos = [
  { id: uuidv4(), title: 'Buy groceries', completed: false, createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Read a book', completed: false, createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Go for a walk', completed: true, createdAt: new Date().toISOString() },
];

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──────────────────────────────────────────────────────────────

// GET /api/todos — list all todos (optional ?completed=true|false filter)
app.get('/api/todos', (req, res) => {
  let result = todos;
  if (req.query.completed !== undefined) {
    const flag = req.query.completed === 'true';
    result = todos.filter(t => t.completed === flag);
  }
  res.json(result);
});

// GET /api/todos/:id — get a single todo
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

// POST /api/todos — create a new todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const todo = {
    id: uuidv4(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  res.status(201).json(todo);
});

// PUT /api/todos/:id — update a todo (title and/or completed)
app.put('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });

  const { title, completed } = req.body;
  if (title !== undefined) todos[index].title = title.trim();
  if (completed !== undefined) todos[index].completed = Boolean(completed);

  res.json(todos[index]);
});

// DELETE /api/todos/:id — delete a todo
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });

  const deleted = todos.splice(index, 1)[0];
  res.json(deleted);
});

// DELETE /api/todos — delete all completed todos
app.delete('/api/todos', (req, res) => {
  const removed = todos.filter(t => t.completed);
  todos = todos.filter(t => !t.completed);
  res.json({ deleted: removed.length });
});

// Fallback — serve frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Todo app running at http://localhost:${PORT}`);
});

module.exports = app;
