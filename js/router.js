// ============================================
// KAYVIN — ROUTER
// Home launcher, module navigation, dynamic
// bottom nav + FAB, and the render dispatcher.
// ============================================

const ICONS = {
  home: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  budget: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor"/></svg>',
  history: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  debts: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="6" width="20" height="13" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 10h20" stroke="currentColor" stroke-width="2"/></svg>',
  payoff: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  habits: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
};

// Module definitions: emoji tile + sub-screens (tabs).
const MODULES = {
  budget: {
    name: 'Budget', emoji: '💰', color: '#5856D6',
    tabs: [
      { view: 'dashboard', label: 'Budget', icon: 'budget' },
      { view: 'history', label: 'History', icon: 'history' },
    ],
  },
  debt: {
    name: 'Debt', emoji: '💳', color: '#FF3B30',
    tabs: [
      { view: 'debts', label: 'Debts', icon: 'debts' },
      { view: 'payoff', label: 'Payoff', icon: 'payoff' },
    ],
  },
  habits: {
    name: 'Habits', emoji: '✅', color: '#34C759',
    tabs: [
      { view: 'habits', label: 'Habits', icon: 'habits' },
    ],
  },
};

// FAB action per view (null = hidden).
const FAB_ACTIONS = {
  dashboard: () => showAddTransaction(),
  debts: () => showDebtModal(),
  habits: () => showHabitModal(),
};

// ============================================
// HOME LAUNCHER
// ============================================
function renderHome() {
  const first = (state.user?.name || '').split(' ')[0];
  $('home-greeting').textContent = first ? `Hi ${first} 👋` : '';

  const grid = $('module-grid');
  if (!grid) return;

  // Per-module quick stats
  const monthly = state.envelopes.filter(e => e.type !== 'annual');
  const period = getCurrentPeriod();
  const budgetTotal = monthly.reduce((s, e) => s + (e.budget || 0), 0);
  const budgetSpent = state.transactions
    .filter(t => t.period === period && monthly.some(e => e.id === t.envelopeId))
    .reduce((s, t) => s + t.amount, 0);
  const budgetRemaining = budgetTotal - budgetSpent;

  const debtTotal = state.debts.reduce((s, d) => s + (d.balance || 0), 0);

  const today = todayStr();
  const doneToday = state.habits.filter(h =>
    state.habitLogs.some(l => l.habitId === h.id && l.date === today)).length;

  const stats = {
    budget: state.envelopes.length
      ? `${budgetRemaining < 0 ? '-' : ''}${formatCurrencyShort(budgetRemaining)} left this month`
      : 'Set up envelopes',
    debt: state.debts.length
      ? `${formatCurrencyShort(debtTotal)} owed across ${state.debts.length}`
      : 'Add your debts',
    habits: state.habits.length
      ? `${doneToday}/${state.habits.length} done today`
      : 'Add disciplines',
  };

  grid.innerHTML = Object.entries(MODULES).map(([key, m]) => `
    <button class="module-tile" data-module="${key}" style="--tile-color:${m.color}">
      <span class="module-emoji">${m.emoji}</span>
      <span class="module-name">${m.name}</span>
      <span class="module-stat">${esc(stats[key])}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.module-tile').forEach(tile =>
    tile.addEventListener('click', () => enterModule(tile.dataset.module)));
}

// ============================================
// NAVIGATION
// ============================================
function enterModule(moduleName) {
  const mod = MODULES[moduleName];
  if (!mod) return;
  state.module = moduleName;
  renderBottomNav();
  navigate(mod.tabs[0].view);
}

function goHome() {
  state.module = null;
  navigate('home');
}

function navigate(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + viewName)?.classList.add('active');
  state.currentView = viewName;

  const nav = $('bottom-nav');
  const fab = $('fab');
  const isChrome = viewName === 'home' || viewName === 'auth' || viewName === 'setup';

  if (isChrome) {
    nav.classList.add('hidden');
    fab.classList.add('hidden');
  } else {
    nav.classList.remove('hidden');
    renderBottomNav();
    // Highlight the active nav button
    nav.querySelectorAll('.nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.view === viewName));
    renderFab();
  }

  // Fire per-view render so freshly shown data is current.
  if (viewName === 'home') renderHome();
  if (viewName === 'history') renderHistory();
  if (viewName === 'habits') renderHabits();
  if (viewName === 'payoff') renderPayoff();

  const scroll = $('view-' + viewName)?.querySelector('.scroll-area');
  if (scroll) scroll.scrollTop = 0;
}

function renderBottomNav() {
  const mod = MODULES[state.module];
  const nav = $('bottom-nav');

  const items = [
    { nav: 'home', label: 'Home', icon: 'home' },
    ...(mod ? mod.tabs : []),
    { view: 'settings', label: 'Settings', icon: 'settings' },
  ];

  nav.innerHTML = items.map(it => {
    const view = it.view || '';
    const isHome = it.nav === 'home';
    return `<button class="nav-btn" ${isHome ? 'data-nav="home"' : `data-view="${view}"`}>
      ${ICONS[it.icon]}<span>${it.label}</span>
    </button>`;
  }).join('');

  nav.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.nav === 'home') { goHome(); return; }
      navigate(btn.dataset.view);
    });
  });
}

function renderFab() {
  const fab = $('fab');
  const action = FAB_ACTIONS[state.currentView];
  if (action) {
    fab.classList.remove('hidden');
    fab.onclick = action;
  } else {
    fab.classList.add('hidden');
    fab.onclick = null;
  }
}

// ============================================
// RENDER DISPATCHER
// Called by every data listener. Cheap enough to
// refresh all module views; only the active one shows.
// ============================================
function renderAll() {
  renderHome();
  renderPeriodSwitchers();
  renderDashboard();
  renderHistory();
  renderEnvelopePicker();
  renderDebts();
  renderPayoff();
  renderHabits();
  renderSettings();
}
