// ============================================
// KAYVIN — CORE
// Config, shared state, utilities, storage,
// Firebase init, and all data operations.
// ============================================

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD3EU0Kr7ypDuqGmVO4mCYc_4RwvAppAsE',
  authDomain: 'envelope-budget-c2b58.firebaseapp.com',
  projectId: 'envelope-budget-c2b58',
  storageBucket: 'envelope-budget-c2b58.firebasestorage.app',
  messagingSenderId: '278247768167',
  appId: '1:278247768167:web:b357b6a36e2618fa9e94c2',
};

const DEFAULT_ENVELOPES = [
  { name: 'Groceries', budget: 700, color: '#34C759' },
  { name: 'Dining Out', budget: 550, color: '#FF9500' },
  { name: 'Coffee/Tea/Matcha', budget: 80, color: '#5AC8FA' },
  { name: 'Household/Amazon', budget: 500, color: '#AF52DE' },
];

const COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE',
  '#5AC8FA', '#FF2D55', '#FFCC00', '#30B0C7', '#A2845E',
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================
// STATE
// ============================================
const state = {
  user: null,
  householdId: null,
  householdCode: null,
  members: {},
  envelopes: [],
  transactions: [],
  debts: [],
  payments: [],
  habits: [],
  habitLogs: [],
  planner: { strategy: 'avalanche', extraMonthly: 0, lumpSums: [], refis: [] },
  currentView: 'auth',
  module: null,
  viewPeriod: getCurrentPeriod(),
  habitDate: todayStr(),
};

let db = null;
let useFirebase = false;
let unsubscribers = [];
let txnUnsub = null;

// ============================================
// UTILITIES
// ============================================
const $ = id => document.getElementById(id);

function getCurrentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodLabel(period) {
  const [y, m] = period.split('-');
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatCurrency(n) {
  return '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Compact currency for tiles/labels (no cents)
function formatCurrencyShort(n) {
  return '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function parseAmount(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function parseRate(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// A random id for local-only mode
function localId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

// ============================================
// LOCAL STORAGE
// ============================================
function saveLocal() {
  localStorage.setItem('kayvin', JSON.stringify({
    user: state.user,
    householdId: state.householdId,
    householdCode: state.householdCode,
    members: state.members,
    envelopes: state.envelopes,
    transactions: state.transactions,
    debts: state.debts,
    payments: state.payments,
    habits: state.habits,
    habitLogs: state.habitLogs,
    planner: state.planner,
  }));
}

function loadLocal() {
  try {
    // Migrate from the pre-rebrand storage key if present.
    const raw = localStorage.getItem('kayvin') || localStorage.getItem('envelope_budget');
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    return !!state.householdId;
  } catch {
    return false;
  }
}

// ============================================
// FIREBASE INIT
// ============================================
function initFirebase() {
  if (!FIREBASE_CONFIG.apiKey || typeof firebase === 'undefined') return false;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function householdRef() {
  return db.collection('households').doc(state.householdId);
}

// ============================================
// HOUSEHOLD
// ============================================
async function createHousehold() {
  const code = generateCode();

  if (useFirebase) {
    const uid = state.user.uid;
    const userName = state.user.name;
    const ref = await db.collection('households').add({
      code,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      members: { [uid]: userName },
    });
    state.householdId = ref.id;
    state.householdCode = code;
    state.members = { [uid]: userName };

    for (let i = 0; i < DEFAULT_ENVELOPES.length; i++) {
      await ref.collection('envelopes').add({ ...DEFAULT_ENVELOPES[i], order: i });
    }
  } else {
    state.householdId = 'local_' + Date.now();
    state.householdCode = code;
    state.user = state.user || { name: 'User', uid: 'local' };
    state.members = { local: state.user.name };
    state.envelopes = DEFAULT_ENVELOPES.map((e, i) => ({ ...e, id: 'env_' + i, order: i }));
    state.transactions = [];
  }

  saveLocal();
}

async function joinHousehold(code) {
  if (!useFirebase) {
    toast('Firebase required for joining.');
    return false;
  }

  const snap = await db.collection('households').where('code', '==', code.toUpperCase()).limit(1).get();
  if (snap.empty) {
    toast('Household not found');
    return false;
  }

  const uid = state.user.uid;
  const userName = state.user.name;
  const doc = snap.docs[0];

  await doc.ref.update({ [`members.${uid}`]: userName });

  state.householdId = doc.id;
  state.householdCode = code.toUpperCase();
  state.members = { ...doc.data().members, [uid]: userName };

  saveLocal();
  return true;
}

// ============================================
// TRANSACTIONS
// ============================================
async function addTransactionData(envelopeId, amount, note, date) {
  const finalDate = date || todayStr();
  const txn = {
    envelopeId,
    amount: parseAmount(amount),
    note: note || '',
    date: finalDate,
    period: finalDate.slice(0, 7),
    addedBy: state.user.name,
  };

  if (txn.amount <= 0) {
    toast('Enter a valid amount');
    return false;
  }

  if (useFirebase) {
    txn.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await householdRef().collection('transactions').add(txn);
  } else {
    txn.id = localId('txn');
    txn.createdAt = new Date().toISOString();
    state.transactions.push(txn);
    saveLocal();
    renderAll();
  }
  return true;
}

async function updateTransactionData(id, updates) {
  if (useFirebase) {
    await householdRef().collection('transactions').doc(id).update(updates);
  } else {
    const txn = state.transactions.find(t => t.id === id);
    if (txn) Object.assign(txn, updates);
    saveLocal();
    renderAll();
  }
}

async function deleteTransactionData(id) {
  if (useFirebase) {
    await householdRef().collection('transactions').doc(id).delete();
  } else {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveLocal();
    renderAll();
  }
}

// ============================================
// ENVELOPES
// ============================================
async function addEnvelopeData(name, budget, color, type) {
  const env = { name, budget: parseAmount(budget), color, order: state.envelopes.length, type: type || 'monthly' };

  if (useFirebase) {
    await householdRef().collection('envelopes').add(env);
  } else {
    env.id = 'env_' + Date.now();
    state.envelopes.push(env);
    saveLocal();
    renderAll();
  }
}

async function updateEnvelopeData(id, updates) {
  if (useFirebase) {
    await householdRef().collection('envelopes').doc(id).update(updates);
  } else {
    const env = state.envelopes.find(e => e.id === id);
    if (env) Object.assign(env, updates);
    saveLocal();
    renderAll();
  }
}

async function deleteEnvelopeData(id) {
  if (useFirebase) {
    await householdRef().collection('envelopes').doc(id).delete();
    const txns = await householdRef().collection('transactions').where('envelopeId', '==', id).get();
    const batch = db.batch();
    txns.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    state.envelopes = state.envelopes.filter(e => e.id !== id);
    state.transactions = state.transactions.filter(t => t.envelopeId !== id);
    saveLocal();
    renderAll();
  }
}

async function resetMonthData() {
  const period = state.viewPeriod;
  if (useFirebase) {
    const txns = await householdRef().collection('transactions').where('period', '==', period).get();
    const batch = db.batch();
    txns.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    state.transactions = state.transactions.filter(t => t.period !== period);
    saveLocal();
    renderAll();
  }
}

// ============================================
// DEBTS
// ============================================
async function addDebtData(data) {
  const debt = {
    name: data.name,
    balance: parseAmount(data.balance),
    apr: parseRate(data.apr),
    minPayment: parseAmount(data.minPayment),
    color: data.color,
    order: state.debts.length,
  };
  if (useFirebase) {
    await householdRef().collection('debts').add(debt);
  } else {
    debt.id = localId('debt');
    state.debts.push(debt);
    saveLocal();
    renderAll();
  }
}

async function updateDebtData(id, updates) {
  if (useFirebase) {
    await householdRef().collection('debts').doc(id).update(updates);
  } else {
    const d = state.debts.find(x => x.id === id);
    if (d) Object.assign(d, updates);
    saveLocal();
    renderAll();
  }
}

async function deleteDebtData(id) {
  if (useFirebase) {
    await householdRef().collection('debts').doc(id).delete();
    const pays = await householdRef().collection('debtPayments').where('debtId', '==', id).get();
    const batch = db.batch();
    pays.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    state.debts = state.debts.filter(d => d.id !== id);
    state.payments = state.payments.filter(p => p.debtId !== id);
    saveLocal();
    renderAll();
  }
}

// Log a payment AND decrement the debt balance (never below 0).
async function logPaymentData(debtId, amount, note, date) {
  const amt = parseAmount(amount);
  if (amt <= 0) { toast('Enter a valid amount'); return false; }
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) return false;

  const newBalance = Math.max(0, Math.round((debt.balance - amt) * 100) / 100);
  const finalDate = date || todayStr();
  const payment = {
    debtId,
    amount: amt,
    note: note || '',
    date: finalDate,
    period: finalDate.slice(0, 7),
    addedBy: state.user.name,
  };

  if (useFirebase) {
    payment.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await householdRef().collection('debtPayments').add(payment);
    await householdRef().collection('debts').doc(debtId).update({ balance: newBalance });
  } else {
    payment.id = localId('pay');
    payment.createdAt = new Date().toISOString();
    state.payments.push(payment);
    debt.balance = newBalance;
    saveLocal();
    renderAll();
  }
  return true;
}

async function deletePaymentData(id) {
  const payment = state.payments.find(p => p.id === id);
  if (useFirebase) {
    // Add the amount back to the debt balance, then remove the payment.
    if (payment) {
      const debt = state.debts.find(d => d.id === payment.debtId);
      if (debt) {
        await householdRef().collection('debts').doc(debt.id)
          .update({ balance: Math.round((debt.balance + payment.amount) * 100) / 100 });
      }
    }
    await householdRef().collection('debtPayments').doc(id).delete();
  } else {
    if (payment) {
      const debt = state.debts.find(d => d.id === payment.debtId);
      if (debt) debt.balance = Math.round((debt.balance + payment.amount) * 100) / 100;
    }
    state.payments = state.payments.filter(p => p.id !== id);
    saveLocal();
    renderAll();
  }
}

// ============================================
// HABITS
// ============================================
async function addHabitData(name, owner, color) {
  const habit = { name, owner, color, order: state.habits.length };
  if (useFirebase) {
    await householdRef().collection('habits').add(habit);
  } else {
    habit.id = localId('habit');
    state.habits.push(habit);
    saveLocal();
    renderAll();
  }
}

async function updateHabitData(id, updates) {
  if (useFirebase) {
    await householdRef().collection('habits').doc(id).update(updates);
  } else {
    const h = state.habits.find(x => x.id === id);
    if (h) Object.assign(h, updates);
    saveLocal();
    renderAll();
  }
}

async function deleteHabitData(id) {
  if (useFirebase) {
    await householdRef().collection('habits').doc(id).delete();
    const logs = await householdRef().collection('habitLogs').where('habitId', '==', id).get();
    const batch = db.batch();
    logs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    state.habits = state.habits.filter(h => h.id !== id);
    state.habitLogs = state.habitLogs.filter(l => l.habitId !== id);
    saveLocal();
    renderAll();
  }
}

// Toggle a habit's done-state for a given date (presence of a log = done).
async function toggleHabitLog(habitId, date) {
  const existing = state.habitLogs.find(l => l.habitId === habitId && l.date === date);
  if (useFirebase) {
    if (existing) {
      await householdRef().collection('habitLogs').doc(existing.id).delete();
    } else {
      await householdRef().collection('habitLogs').add({
        habitId, date, uid: state.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    if (existing) {
      state.habitLogs = state.habitLogs.filter(l => l.id !== existing.id);
    } else {
      state.habitLogs.push({ id: localId('log'), habitId, date, uid: state.user.uid });
    }
    saveLocal();
    renderAll();
  }
}

// ============================================
// PLANNER CONFIG (shared scenario for payoff)
// ============================================
async function savePlannerData(updates) {
  Object.assign(state.planner, updates);
  renderAll(); // immediate feedback; listener will reconcile
  if (useFirebase) {
    await householdRef().collection('settings').doc('planner').set(state.planner, { merge: true });
  } else {
    saveLocal();
  }
}

// ============================================
// REAL-TIME LISTENERS
// ============================================
function setupListeners() {
  if (!useFirebase || !state.householdId) return;

  unsubscribers.forEach(fn => fn());
  unsubscribers = [];

  const ref = householdRef();

  // Household doc (members)
  unsubscribers.push(ref.onSnapshot(doc => {
    if (doc.exists) {
      state.members = doc.data().members || {};
      renderAll();
    }
  }));

  // Envelopes
  unsubscribers.push(ref.collection('envelopes').orderBy('order').onSnapshot(snap => {
    state.envelopes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocal();
    renderAll();
  }));

  // Debts
  unsubscribers.push(ref.collection('debts').orderBy('order').onSnapshot(snap => {
    state.debts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocal();
    renderAll();
  }));

  // Debt payments (recent, for "paid this month" + history)
  unsubscribers.push(ref.collection('debtPayments').orderBy('date', 'desc').limit(500).onSnapshot(snap => {
    state.payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocal();
    renderAll();
  }));

  // Habits
  unsubscribers.push(ref.collection('habits').orderBy('order').onSnapshot(snap => {
    state.habits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocal();
    renderAll();
  }));

  // Habit logs (recent window is enough for streaks/day view)
  unsubscribers.push(ref.collection('habitLogs').orderBy('date', 'desc').limit(1000).onSnapshot(snap => {
    state.habitLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocal();
    renderAll();
  }));

  // Planner config
  unsubscribers.push(ref.collection('settings').doc('planner').onSnapshot(doc => {
    if (doc.exists) {
      state.planner = { strategy: 'avalanche', extraMonthly: 0, lumpSums: [], refis: [], ...doc.data() };
      saveLocal();
      renderAll();
    }
  }));

  // Transactions — scoped to the viewed year (see subscribeTransactions).
  subscribeTransactions();
}

function subscribeTransactions() {
  if (!useFirebase || !state.householdId) return;
  if (txnUnsub) { txnUnsub(); txnUnsub = null; }

  const year = getViewYear();
  txnUnsub = householdRef().collection('transactions')
    .where('period', '>=', `${year}-01`)
    .where('period', '<=', `${year}-12`)
    .onSnapshot(snap => {
      state.transactions = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '' };
      });
      saveLocal();
      renderAll();
    });
}

function teardownListeners() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  if (txnUnsub) { txnUnsub(); txnUnsub = null; }
}

function leaveHouseholdData() {
  teardownListeners();
  state.user = null;
  state.householdId = null;
  state.householdCode = null;
  state.members = {};
  state.envelopes = [];
  state.transactions = [];
  state.debts = [];
  state.payments = [];
  state.habits = [];
  state.habitLogs = [];
  state.planner = { strategy: 'avalanche', extraMonthly: 0, lumpSums: [], refis: [] };
  localStorage.removeItem('kayvin');
  localStorage.removeItem('envelope_budget');
}
