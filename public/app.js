// ── State ────────────────────────────────────────────────────────────────────
let todos = [];
let currentFilter = 'all';

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
  getAll:  ()           => fetch('/api/todos').then(r => r.json()),
  create:  (title)      => fetch('/api/todos', { method: 'POST',   headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title }) }).then(r => r.json()),
  update:  (id, patch)  => fetch(`/api/todos/${id}`, { method: 'PUT',    headers: {'Content-Type':'application/json'}, body: JSON.stringify(patch) }).then(r => r.json()),
  remove:  (id)         => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(r => r.json()),
  clearCompleted: ()    => fetch('/api/todos', { method: 'DELETE' }).then(r => r.json()),
};

// ── Render ────────────────────────────────────────────────────────────────────
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
    cb.addEventListener('change', () => toggleTodo(todo.id, cb.checked));

    // Title (inline edit on double-click)
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'todo-title';
    titleInput.value = todo.title;
    titleInput.readOnly = true;

    titleInput.addEventListener('dblclick', () => startEdit(titleInput));
    titleInput.addEventListener('blur',  () => finishEdit(titleInput, todo.id));
    titleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') titleInput.blur();
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

  // Stats
  const activeCount = todos.filter(t => !t.completed).length;
  itemsLeft.textContent = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;

  // Empty state
  if (visible.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }
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
    // Restore original title if blank
    const todo = todos.find(t => t.id === id);
    input.value = todo ? todo.title : '';
    return;
  }

  const updated = await api.update(id, { title: newTitle });
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx] = updated;
  render();
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function addTodo(title) {
  const todo = await api.create(title);
  todos.push(todo);
  render();
}

async function toggleTodo(id, completed) {
  const updated = await api.update(id, { completed });
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx] = updated;
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
  todos = await api.getAll();
  render();
})();
