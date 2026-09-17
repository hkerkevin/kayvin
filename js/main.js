// ============================================
// KAYVIN — MAIN
// Event wiring and bootstrap.
// ============================================

function bindEvents() {
  // ---------- Auth ----------
  let authMode = 'register';

  $('btn-auth-toggle').addEventListener('click', () => {
    authMode = authMode === 'register' ? 'login' : 'register';
    $('input-auth-name').style.display = authMode === 'register' ? '' : 'none';
    $('btn-auth-submit').textContent = authMode === 'register' ? 'Create Account' : 'Log In';
    $('auth-toggle-prompt').textContent = authMode === 'register' ? 'Already have an account?' : 'Need an account?';
    $('btn-auth-toggle').textContent = authMode === 'register' ? 'Log in' : 'Create one';
    $('auth-error').textContent = '';
  });

  $('btn-auth-submit').addEventListener('click', async () => {
    const email = $('input-auth-email').value.trim();
    const password = $('input-auth-password').value;
    const name = $('input-auth-name').value.trim();

    if (authMode === 'register' && !name) { toast('Enter your name'); return; }
    if (!email) { toast('Enter your email'); return; }
    if (!password || password.length < 6) { toast('Password must be at least 6 characters'); return; }

    $('btn-auth-submit').disabled = true;
    $('auth-error').textContent = '';

    try {
      if (authMode === 'register') {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      }
    } catch (e) {
      $('auth-error').textContent = e.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim() || 'Authentication failed';
    }
    $('btn-auth-submit').disabled = false;
  });

  $('input-auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-auth-submit').click(); });
  $('input-auth-email').addEventListener('keydown', e => { if (e.key === 'Enter') $('input-auth-password').focus(); });

  // ---------- Setup (household create/join) ----------
  $('btn-create').addEventListener('click', async () => {
    $('btn-create').disabled = true;
    try { await createHousehold(); enterApp(); }
    catch (e) { toast('Error: ' + e.message); }
    $('btn-create').disabled = false;
  });

  $('btn-join').addEventListener('click', async () => {
    const code = $('input-code').value.trim();
    if (!code) { toast('Enter a household code'); return; }
    $('btn-join').disabled = true;
    try { const ok = await joinHousehold(code); if (ok) enterApp(); }
    catch (e) { toast('Error: ' + e.message); }
    $('btn-join').disabled = false;
  });

  // ---------- Home ----------
  $('btn-home-settings').addEventListener('click', () => navigate('settings'));

  // ---------- Add transaction modal ----------
  $('btn-cancel-add').addEventListener('click', () => hideModal('modal-add'));
  $('btn-save-add').addEventListener('click', saveTransaction);
  $('modal-add').querySelector('.modal-overlay').addEventListener('click', () => hideModal('modal-add'));
  $('input-amount').addEventListener('keydown', e => { if (e.key === 'Enter') saveTransaction(); });

  // ---------- Envelope modal ----------
  $('btn-cancel-envelope').addEventListener('click', () => hideModal('modal-envelope'));
  $('btn-save-envelope').addEventListener('click', saveEnvelope);
  $('modal-envelope').querySelector('.modal-overlay').addEventListener('click', () => hideModal('modal-envelope'));
  $('btn-delete-envelope').addEventListener('click', async () => {
    if (!editingEnvelopeId) return;
    if (!confirm('Delete this envelope and all its transactions?')) return;
    await deleteEnvelopeData(editingEnvelopeId);
    hideModal('modal-envelope');
    toast('Deleted');
  });

  // ---------- Debt modal ----------
  $('btn-cancel-debt').addEventListener('click', () => hideModal('modal-debt'));
  $('btn-save-debt').addEventListener('click', saveDebt);
  $('modal-debt').querySelector('.modal-overlay').addEventListener('click', () => hideModal('modal-debt'));
  $('btn-delete-debt').addEventListener('click', async () => {
    if (!editingDebtId) return;
    if (!confirm('Delete this debt and its payment history?')) return;
    await deleteDebtData(editingDebtId);
    hideModal('modal-debt');
    toast('Deleted');
  });

  // ---------- Payment modal ----------
  $('btn-cancel-payment').addEventListener('click', () => hideModal('modal-payment'));
  $('btn-save-payment').addEventListener('click', savePayment);
  $('modal-payment').querySelector('.modal-overlay').addEventListener('click', () => hideModal('modal-payment'));
  $('input-payment-amount').addEventListener('keydown', e => { if (e.key === 'Enter') savePayment(); });

  // ---------- Habit modal ----------
  $('btn-cancel-habit').addEventListener('click', () => hideModal('modal-habit'));
  $('btn-save-habit').addEventListener('click', saveHabit);
  $('modal-habit').querySelector('.modal-overlay').addEventListener('click', () => hideModal('modal-habit'));
  $('btn-delete-habit').addEventListener('click', async () => {
    if (!editingHabitId) return;
    if (!confirm('Delete this habit and its history?')) return;
    await deleteHabitData(editingHabitId);
    hideModal('modal-habit');
    toast('Deleted');
  });
  $('input-habit-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveHabit(); });

  // ---------- Habits day nav ----------
  $('habits-prev').addEventListener('click', () => shiftHabitDate(-1));
  $('habits-next').addEventListener('click', () => shiftHabitDate(1));

  // ---------- Settings ----------
  $('btn-add-envelope').addEventListener('click', () => showEnvelopeModal());
  $('btn-export-month').addEventListener('click', () => exportTransactionsCSV(false));
  $('btn-export-all').addEventListener('click', () => exportTransactionsCSV(true));
  $('btn-export-envelopes').addEventListener('click', exportEnvelopesJSON);

  $('btn-import-transactions').addEventListener('click', () => {
    $('file-import-transactions').value = '';
    $('file-import-transactions').click();
  });
  $('file-import-transactions').addEventListener('change', e => {
    if (e.target.files[0]) importTransactionsCSV(e.target.files[0]);
  });

  $('btn-import-envelopes').addEventListener('click', () => {
    $('file-import-envelopes').value = '';
    $('file-import-envelopes').click();
  });
  $('file-import-envelopes').addEventListener('change', e => {
    if (e.target.files[0]) importEnvelopesJSON(e.target.files[0]);
  });

  $('btn-reset-month').addEventListener('click', async () => {
    if (!confirm(`Delete all transactions for ${getPeriodLabel(state.viewPeriod)}? This cannot be undone.`)) return;
    await resetMonthData();
    toast('Month reset');
  });

  $('btn-leave').addEventListener('click', () => {
    if (!confirm('Leave this household? You can rejoin with the code.')) return;
    teardownListeners();
    state.householdId = null;
    state.householdCode = null;
    state.members = {};
    state.envelopes = [];
    state.transactions = [];
    state.debts = [];
    state.payments = [];
    state.habits = [];
    state.habitLogs = [];
    saveLocal();
    $('bottom-nav').classList.add('hidden');
    $('fab').classList.add('hidden');
    $('input-code').value = '';
    navigate('setup');
  });

  $('btn-signout').addEventListener('click', async () => {
    if (!confirm('Sign out?')) return;
    leaveHouseholdData();
    if (useFirebase) await firebase.auth().signOut();
    $('bottom-nav').classList.add('hidden');
    $('fab').classList.add('hidden');
    navigate('auth');
  });

  // ---------- Household code copy ----------
  $('household-code-btn').addEventListener('click', () => {
    if (state.householdCode) {
      navigator.clipboard?.writeText(state.householdCode).then(() => toast('Code copied!')).catch(() => {});
    }
  });

  // ---------- History filter ----------
  $('history-filter').addEventListener('change', renderHistory);
  $('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
}

// ============================================
// ENTER APP
// ============================================
function enterApp() {
  state.viewPeriod = getCurrentPeriod();
  state.habitDate = todayStr();
  state.module = null;
  navigate('home');
  setupListeners();
  if (!useFirebase) renderAll();
}

// ============================================
// AUTH STATE
// ============================================
function handleAuthState(user) {
  if (!user) {
    $('bottom-nav').classList.add('hidden');
    $('fab').classList.add('hidden');
    navigate('auth');
    return;
  }

  state.user = {
    name: user.displayName || user.email.split('@')[0],
    uid: user.uid,
    email: user.email,
  };

  if (state.householdId && state.members[user.uid]) {
    saveLocal();
    enterApp();
  } else if (state.householdId) {
    state.householdId = null;
    state.householdCode = null;
    state.members = {};
    state.envelopes = [];
    state.transactions = [];
    state.debts = [];
    state.payments = [];
    state.habits = [];
    state.habitLogs = [];
    saveLocal();
    navigate('setup');
  } else {
    saveLocal();
    navigate('setup');
  }
}

// ============================================
// INIT
// ============================================
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  useFirebase = initFirebase();
  loadLocal();
  bindEvents();

  if (useFirebase) {
    firebase.auth().onAuthStateChanged(handleAuthState);
  } else {
    if (state.householdId) enterApp();
    else navigate('auth');
  }
}

init();
