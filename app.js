// Simple To-Do app with localStorage persistence
(function(){
  const STORAGE_KEY = 'todo.tasks.v1';

  // DOM
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const dueInput = document.getElementById('due-input');
  const list = document.getElementById('task-list');
  const empty = document.getElementById('empty');
  const counts = document.getElementById('counts');
  const filters = document.querySelectorAll('.filter');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const exportBtn = document.getElementById('export');
  const importBtn = document.getElementById('import');
  const importFile = document.getElementById('import-file');

  // State
  let tasks = []; // {id, title, dueDate, completed, createdAt}
  let filter = 'all';

  // Helpers
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load tasks', e);
      tasks = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString();
  }

  function render() {
    list.innerHTML = '';
    const filtered = tasks.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'active') return !t.completed;
      if (filter === 'completed') return t.completed;
    }).sort((a,b)=>{
      // sort by completed, then due date (soon first), then createdAt
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (filtered.length === 0) empty.style.display = 'block'; else empty.style.display = 'none';

    for (const t of filtered) {
      const el = document.createElement('div');
      el.className = 'task';
      const left = document.createElement('div');
      left.className = 'task-left';

      // checkbox
      const cb = document.createElement('button');
      cb.className = 'checkbox' + (t.completed ? ' checked' : '');
      cb.setAttribute('aria-pressed', t.completed ? 'true' : 'false');
      cb.title = t.completed ? 'Mark as incomplete' : 'Mark as complete';
      cb.innerHTML = t.completed ? '✓' : '';
      cb.addEventListener('click', ()=> toggleComplete(t.id));
      left.appendChild(cb);

      // title + meta
      const info = document.createElement('div');
      info.style.minWidth = 0;
      const title = document.createElement('div');
      title.className = 'task-title' + (t.completed ? ' completed' : '');
      title.textContent = t.title;
      title.title = 'Click to edit';
      title.addEventListener('click', ()=> editTaskPrompt(t.id));
      info.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'meta';
      const dueText = t.dueDate ? `Due ${formatDate(t.dueDate)}` : '';
      meta.textContent = [dueText, `Created ${formatDate(t.createdAt)}`].filter(Boolean).join(' • ');
      info.appendChild(meta);
      left.appendChild(info);

      // actions
      const actions = document.createElement('div');
      actions.className = 'task-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', ()=> editTaskPrompt(t.id));
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', ()=> deleteTask(t.id));
      actions.appendChild(delBtn);

      el.appendChild(left);
      el.appendChild(actions);
      list.appendChild(el);
    }

    const total = tasks.length;
    const completed = tasks.filter(t=>t.completed).length;
    counts.textContent = `${total} task${total!==1?'s':''} • ${completed} completed`;
  }

  // Actions
  function addTask(title, due) {
    title = (title || '').trim();
    if (!title) return;
    const t = { id: uid(), title, dueDate: due||'', completed:false, createdAt: new Date().toISOString() };
    tasks.push(t);
    save();
    render();
  }

  function toggleComplete(id) {
    const t = tasks.find(x=>x.id===id);
    if (!t) return;
    t.completed = !t.completed;
    save();
    render();
  }

  function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    tasks = tasks.filter(x=>x.id!==id);
    save();
    render();
  }

  function editTaskPrompt(id) {
    const t = tasks.find(x=>x.id===id);
    if (!t) return;
    const newTitle = prompt('Edit task title', t.title);
    if (newTitle === null) return; // canceled
    const newDue = prompt('Due date (YYYY-MM-DD) or blank to clear', t.dueDate || '');
    // basic validation for date format (YYYY-MM-DD) or empty
    if (newDue && !/^\d{4}-\d{2}-\d{2}$/.test(newDue)) {
      alert('Invalid date format. Use YYYY-MM-DD or leave blank.');
      return;
    }
    t.title = newTitle.trim() || t.title;
    t.dueDate = newDue ? newDue : '';
    save();
    render();
  }

  function clearCompleted() {
    if (!confirm('Remove all completed tasks?')) return;
    tasks = tasks.filter(t=>!t.completed);
    save();
    render();
  }

  function setFilter(f) {
    filter = f;
    filters.forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    render();
  }

  function exportTasks() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'todo-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTasksFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('Invalid file');
        // basic merge: keep existing + add imported (but avoid id collisions)
        const existingIds = new Set(tasks.map(t=>t.id));
        for (const it of data) {
          if (!it.id || existingIds.has(it.id)) it.id = uid();
          tasks.push({
            id: it.id,
            title: it.title || 'Untitled',
            dueDate: it.dueDate || '',
            completed: !!it.completed,
            createdAt: it.createdAt || new Date().toISOString()
          });
        }
        save();
        render();
        alert('Import complete');
      } catch (e) {
        alert('Failed to import: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  // Event wiring
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    addTask(input.value, dueInput.value);
    input.value = '';
    dueInput.value = '';
    input.focus();
  });

  filters.forEach(btn => btn.addEventListener('click', ()=> setFilter(btn.dataset.filter)));
  clearCompletedBtn.addEventListener('click', clearCompleted);
  exportBtn.addEventListener('click', exportTasks);
  importBtn.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (f) importTasksFile(f);
    importFile.value = '';
  });

  // Init
  load();
  render();

  // Expose for console debugging (optional)
  window.todoApp = {
    get tasks(){ return tasks; },
    clearAll(){ if(confirm('Clear all tasks?')) { tasks=[]; save(); render(); } }
  };
})();