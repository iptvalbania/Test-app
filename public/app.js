// ── State ────────────────────────────────────────────────────────────────────
let todos = [];
let currentFilter = 'all';
let gameData = null;        // current game state from server
let prevLevel = 1;          // detect level-ups

// ── DOM refs ─────────────────────────────────────────────────────────────────
const addForm      = document.getElementById('add-form');
const newTodoInput = document.getElementById('new-todo');
const todoList     = document.getElementById('todo-list');
const emptyState   = document.getElementById('empty-state');
const itemsLeft    = document.getElementById('items-left');
const clearBtn     = document.getElementById('clear-completed');
const filterBtns   = document.querySelectorAll('.filter-btn');

// ── API helpers ───────────────────────────────────────────────────────────────
const api = {
  getAll:         ()          => fetch('/api/todos').then(r => r.json()),
  create:         (title)     => fetch('/api/todos', { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }).then(r => r.json()),
  update:         (id, patch) => fetch(`/api/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).then(r => r.json()),
  remove:         (id)        => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(r => r.json()),
  clearCompleted: ()          => fetch('/api/todos', { method: 'DELETE' }).then(r => r.json()),
  getGame:        ()          => fetch('/api/game').then(r => r.json()),
};

// ── Render todos ──────────────────────────────────────────────────────────────
function getVisible() {
  if (currentFilter === 'active')    return todos.filter(t => !t.completed);
  if (currentFilter === 'completed') return todos.filter(t => t.completed);
  return todos;
}

function render() {
  const visible = getVisible();
  todoList.innerHTML = '';

  visible.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;
    li.dataset.id = todo.id;

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'todo-checkbox';
    cb.checked = todo.completed;
    cb.addEventListener('change', () => toggleTodo(todo.id, cb.checked, cb));

    // Title (inline edit on double-click)
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'todo-title';
    titleInput.value = todo.title;
    titleInput.readOnly = true;

    titleInput.addEventListener('dblclick', () => startEdit(titleInput));
    titleInput.addEventListener('blur',     () => finishEdit(titleInput, todo.id));
    titleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  titleInput.blur();
      if (e.key === 'Escape') {
        titleInput.value = todo.title;
        titleInput.readOnly = true;
        titleInput.classList.remove('editing');
      }
    });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.title = 'Delete todo';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.append(cb, titleInput, delBtn);
    todoList.appendChild(li);
  });

  const activeCount = todos.filter(t => !t.completed).length;
  itemsLeft.textContent = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;

  emptyState.classList.toggle('hidden', visible.length > 0);
}

// ── Inline edit helpers ───────────────────────────────────────────────────────
function startEdit(input) {
  input.readOnly = false;
  input.classList.add('editing');
  input.focus();
  input.select();
}

async function finishEdit(input, id) {
  if (!input.classList.contains('editing')) return;
  input.readOnly = true;
  input.classList.remove('editing');

  const newTitle = input.value.trim();
  if (!newTitle) {
    const todo = todos.find(t => t.id === id);
    input.value = todo ? todo.title : '';
    return;
  }

  const result = await api.update(id, { title: newTitle });
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx] = result.todo;
  render();
}

// ── Todo actions ──────────────────────────────────────────────────────────────
async function addTodo(title) {
  const todo = await api.create(title);
  todos.push(todo);
  render();
}

async function toggleTodo(id, completed, checkboxEl) {
  const result = await api.update(id, { completed });
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx] = result.todo;

  if (completed) {
    // Update game UI
    updateGamePanel(result.game);
    updateAchievementsGrid(result.game);

    // Feedback effects
    spawnConfetti(checkboxEl);
    showXpPopup(checkboxEl, result.game.xpPerTask);

    // Queue any newly unlocked achievements
    if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
      result.newlyUnlocked.forEach(ach => queueAchievement(ach));
    }
  }

  render();
}

async function deleteTodo(id) {
  await api.remove(id);
  todos = todos.filter(t => t.id !== id);
  render();
}

async function clearCompleted() {
  await api.clearCompleted();
  todos = todos.filter(t => !t.completed);
  render();
}

// ── Game panel ────────────────────────────────────────────────────────────────
function updateGamePanel(game) {
  const newLevel = game.level;

  document.getElementById('player-level').textContent = newLevel;
  document.getElementById('streak-count').textContent  = game.streak;
  document.getElementById('total-points').textContent  = game.points;
  document.getElementById('total-completed').textContent = game.totalCompleted;

  const pct = (game.xpInLevel / game.xpPerLevel) * 100;
  document.getElementById('xp-fill').style.width = pct + '%';
  document.getElementById('xp-text').textContent = `${game.xpInLevel} / ${game.xpPerLevel} XP`;

  // Level-up animation
  if (newLevel > prevLevel) {
    const badge = document.getElementById('level-badge');
    badge.classList.remove('leveled-up');
    void badge.offsetWidth; // force reflow
    badge.classList.add('leveled-up');
    queueAchievement({ icon: '⬆️', name: `Level ${newLevel}!`, desc: 'You leveled up! Keep going!' });
  }

  prevLevel = newLevel;
  gameData = game;
}

// ── Achievements grid ─────────────────────────────────────────────────────────
function updateAchievementsGrid(game) {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = '';

  (game.achievements || []).forEach(ach => {
    const unlocked = (game.unlockedAchievements || []).includes(ach.id);
    const card = document.createElement('div');
    card.className = `ach-card ${unlocked ? 'unlocked' : 'locked'}`;
    card.title = ach.desc;

    const icon = document.createElement('div');
    icon.className = 'ach-icon';
    icon.textContent = unlocked ? ach.icon : '🔒';

    const name = document.createElement('div');
    name.className = 'ach-name';
    name.textContent = ach.name;

    const desc = document.createElement('div');
    desc.className = 'ach-desc';
    desc.textContent = ach.desc;

    card.append(icon, name, desc);
    grid.appendChild(card);
  });
}

// ── Achievement toast queue ───────────────────────────────────────────────────
const achievementQueue = [];
let toastVisible = false;

function queueAchievement(ach) {
  achievementQueue.push(ach);
  if (!toastVisible) showNextAchievement();
}

function showNextAchievement() {
  if (achievementQueue.length === 0) { toastVisible = false; return; }
  toastVisible = true;

  const ach   = achievementQueue.shift();
  const toast = document.getElementById('achievement-toast');

  document.getElementById('achievement-toast-icon').textContent = ach.icon;
  document.getElementById('achievement-toast-name').textContent = ach.name;
  document.getElementById('achievement-toast-desc').textContent = ach.desc;

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextAchievement, 450);
  }, 3000);
}

// ── Floating XP popup ─────────────────────────────────────────────────────────
function showXpPopup(el, amount) {
  const rect = el.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.textContent = `+${amount} XP`;
  popup.style.left = (rect.right + 6) + 'px';
  popup.style.top  = (rect.top + window.scrollY - 4) + 'px';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1050);
}

// ── Confetti burst ────────────────────────────────────────────────────────────
function spawnConfetti(originEl) {
  const container = document.getElementById('confetti-container');
  const rect  = originEl.getBoundingClientRect();
  const ox    = rect.left + rect.width  / 2;
  const oy    = rect.top  + rect.height / 2;
  const colors = ['#4f46e5','#7c3aed','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];

  for (let i = 0; i < 28; i++) {
    const p    = document.createElement('div');
    p.className = 'confetti-particle';
    const color = colors[i % colors.length];
    const size  = Math.random() * 7 + 5;
    const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist  = Math.random() * 100 + 60;
    const dur   = (Math.random() * 0.5 + 0.7).toFixed(2);
    const rot   = Math.round(Math.random() * 720 - 360);
    const dx    = (Math.cos(angle) * dist).toFixed(1);
    const dy    = (Math.sin(angle) * dist - 60).toFixed(1);   // bias upward
    const shape = Math.random() > 0.4 ? '50%' : '2px';

    Object.assign(p.style, {
      left:    ox + 'px',
      top:     oy + 'px',
      width:   size + 'px',
      height:  size + 'px',
      background: color,
      borderRadius: shape,
      '--dx':  dx + 'px',
      '--dy':  dy + 'px',
      '--dur': dur + 's',
      '--rot': rot + 'deg',
    });

    container.appendChild(p);
    setTimeout(() => p.remove(), parseFloat(dur) * 1000 + 100);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
addForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = newTodoInput.value.trim();
  if (title) {
    addTodo(title);
    newTodoInput.value = '';
  }
});

clearBtn.addEventListener('click', clearCompleted);

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async () => {
  const [fetchedTodos, game] = await Promise.all([api.getAll(), api.getGame()]);
  todos  = fetchedTodos;
  prevLevel = game.level;
  updateGamePanel(game);
  updateAchievementsGrid(game);
  render();
})();
