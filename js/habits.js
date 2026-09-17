// ============================================
// KAYVIN — HABITS MODULE
// Per-person daily discipline check-off + streaks.
// ============================================

let editingHabitId = null;
let selectedHabitOwner = null;
let selectedHabitColor = COLORS[1];

function habitDone(habitId, date) {
  return state.habitLogs.some(l => l.habitId === habitId && l.date === date);
}

// Consecutive done-days ending at (or just before) the given date.
function habitStreak(habitId, uptoDate) {
  let streak = 0;
  let d = uptoDate;
  if (!habitDone(habitId, d)) d = addDays(d, -1);
  while (habitDone(habitId, d)) { streak++; d = addDays(d, -1); }
  return streak;
}

function renderHabits() {
  const container = $('habits-container');
  if (!container) return;

  const date = state.habitDate;
  $('habits-date-label').textContent = formatDate(date);
  const next = $('habits-next');
  if (next) next.disabled = date >= todayStr();

  container.innerHTML = '';

  if (state.habits.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>No disciplines yet.<br>Tap + to add one.</p></div>';
    return;
  }

  // Group habits by owner, ordered by member list then any orphans.
  const ownerIds = Object.keys(state.members);
  state.habits.forEach(h => { if (!ownerIds.includes(h.owner)) ownerIds.push(h.owner); });

  ownerIds.forEach(uid => {
    const habits = state.habits.filter(h => h.owner === uid);
    if (!habits.length) return;

    const name = state.members[uid] || 'Someone';
    const doneCount = habits.filter(h => habitDone(h.id, date)).length;

    const group = document.createElement('div');
    group.className = 'habit-group';
    group.innerHTML = `
      <div class="habit-group-head">
        <span class="habit-owner">${esc(name)}${uid === state.user?.uid ? ' (you)' : ''}</span>
        <span class="habit-count">${doneCount}/${habits.length}</span>
      </div>
    `;

    const card = document.createElement('div');
    card.className = 'settings-card';

    habits.forEach(h => {
      const done = habitDone(h.id, date);
      const streak = habitStreak(h.id, date);
      const row = document.createElement('div');
      row.className = 'habit-row' + (done ? ' done' : '');
      row.innerHTML = `
        <button class="habit-check" style="${done ? `background:${h.color};border-color:${h.color}` : ''}" aria-label="Toggle">
          ${done ? '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12l5 5L20 6" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </button>
        <span class="habit-name">${esc(h.name)}</span>
        <span class="habit-streak">${streak > 0 ? '🔥 ' + streak : ''}</span>
        <button class="btn-mini ghost" data-edit="${h.id}">Edit</button>
      `;
      row.querySelector('.habit-check').addEventListener('click', () => toggleHabitLog(h.id, date));
      row.querySelector('.habit-name').addEventListener('click', () => toggleHabitLog(h.id, date));
      row.querySelector('[data-edit]').addEventListener('click', e => {
        e.stopPropagation();
        showHabitModal(h);
      });
      card.appendChild(row);
    });

    group.appendChild(card);
    container.appendChild(group);
  });
}

// ============================================
// HABIT MODAL
// ============================================
function showHabitModal(habit) {
  editingHabitId = habit?.id || null;
  $('habit-modal-title').textContent = habit ? 'Edit Habit' : 'Add Habit';
  $('input-habit-name').value = habit?.name || '';
  selectedHabitOwner = habit?.owner || state.user?.uid || Object.keys(state.members)[0];
  selectedHabitColor = habit?.color || COLORS[1];
  $('btn-delete-habit').style.display = habit ? 'block' : 'none';
  renderHabitOwnerPicker();
  renderHabitColorPicker();
  showModal('modal-habit');
}

function renderHabitOwnerPicker() {
  const picker = $('habit-owner-picker');
  picker.innerHTML = '';
  Object.entries(state.members).forEach(([uid, name]) => {
    const chip = document.createElement('button');
    chip.className = 'picker-chip' + (selectedHabitOwner === uid ? ' selected' : '');
    chip.textContent = name + (uid === state.user?.uid ? ' (you)' : '');
    if (selectedHabitOwner === uid) {
      chip.style.background = 'var(--primary)';
      chip.style.borderColor = 'var(--primary)';
    }
    chip.addEventListener('click', () => {
      selectedHabitOwner = uid;
      renderHabitOwnerPicker();
    });
    picker.appendChild(chip);
  });
}

function renderHabitColorPicker() {
  buildColorPicker('habit-color-picker', selectedHabitColor, c => {
    selectedHabitColor = c;
    renderHabitColorPicker();
  });
}

async function saveHabit() {
  const name = $('input-habit-name').value.trim();
  if (!name) { toast('Enter a discipline'); return; }
  if (!selectedHabitOwner) { toast('Pick whose habit'); return; }

  if (editingHabitId) {
    await updateHabitData(editingHabitId, { name, owner: selectedHabitOwner, color: selectedHabitColor });
  } else {
    await addHabitData(name, selectedHabitOwner, selectedHabitColor);
  }
  hideModal('modal-habit');
  toast(editingHabitId ? 'Updated' : 'Added');
}

function shiftHabitDate(delta) {
  const nextDate = addDays(state.habitDate, delta);
  if (nextDate > todayStr()) return; // no future
  state.habitDate = nextDate;
  renderHabits();
}
