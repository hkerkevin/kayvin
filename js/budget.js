// ============================================
// KAYVIN — BUDGET MODULE
// Envelope dashboard, history, period switcher,
// transaction + envelope modals, settings, CSV.
// ============================================

let editingEnvelopeId = null;
let editingTransactionId = null;
let selectedEnvelopeId = null;
let selectedColor = COLORS[0];
let selectedEnvelopeType = 'monthly';

// ============================================
// SHARED: color picker
// ============================================
function buildColorPicker(containerId, selected, onPick) {
  const picker = $(containerId);
  if (!picker) return;
  picker.innerHTML = '';
  COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (selected === c ? ' selected' : '');
    dot.style.background = c;
    dot.addEventListener('click', () => onPick(c));
    picker.appendChild(dot);
  });
}

// ============================================
// SPENT / PERIOD HELPERS
// ============================================
function getViewYear() {
  return state.viewPeriod.slice(0, 4);
}

function getSpent(envelopeId) {
  const env = state.envelopes.find(e => e.id === envelopeId);
  if (env?.type === 'annual') {
    const year = getViewYear();
    return state.transactions
      .filter(t => t.envelopeId === envelopeId && (t.period || '').startsWith(year))
      .reduce((s, t) => s + t.amount, 0);
  }
  const period = state.viewPeriod;
  return state.transactions
    .filter(t => t.envelopeId === envelopeId && t.period === period)
    .reduce((s, t) => s + t.amount, 0);
}

// ============================================
// DASHBOARD
// ============================================
function renderDashboard() {
  if (!$('period-label')) return;
  $('period-label').textContent = getPeriodLabel(state.viewPeriod);
  $('household-code-btn').textContent = state.householdCode || '';

  let monthlyBudget = 0, monthlySpent = 0;
  const container = $('envelopes-container');
  container.innerHTML = '';

  if (state.envelopes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✉️</div><p>No envelopes yet.<br>Add some in Settings.</p></div>';
    $('total-remaining').textContent = '$0.00';
    $('total-remaining').className = 'overview-amount';
    $('total-budget').textContent = '$0';
    $('total-spent').textContent = '$0';
    $('total-bar').style.width = '0%';
    return;
  }

  state.envelopes.forEach(env => {
    const spent = getSpent(env.id);
    const remaining = env.budget - spent;
    const pct = env.budget > 0 ? Math.min((spent / env.budget) * 100, 100) : 0;
    const isAnnual = env.type === 'annual';

    if (!isAnnual) {
      monthlyBudget += env.budget;
      monthlySpent += spent;
    }

    const barColor = pct > 90 ? '#FF3B30' : pct > 75 ? '#FF9500' : env.color;

    const card = document.createElement('div');
    card.className = 'envelope-card';
    card.addEventListener('click', () => {
      $('history-filter').value = env.id;
      navigate('history');
    });

    const leftLabel = remaining < 0 ? 'over' : isAnnual ? 'left this year' : 'left';

    card.innerHTML = `
      <div class="envelope-header">
        <div class="envelope-name" style="color:${env.color}">${esc(env.name)}${isAnnual ? ' <span class="envelope-badge">Annual</span>' : ''}</div>
        <div class="envelope-remaining ${remaining < 0 ? 'negative' : ''}">
          ${remaining < 0 ? '-' : ''}${formatCurrency(remaining)} ${leftLabel}
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="envelope-detail">
        ${formatCurrency(spent)} of ${formatCurrency(env.budget)}${isAnnual ? ' (year)' : ''}
      </div>
    `;
    container.appendChild(card);
  });

  const monthlyRemaining = monthlyBudget - monthlySpent;
  const monthlyPct = monthlyBudget > 0 ? Math.min((monthlySpent / monthlyBudget) * 100, 100) : 0;

  $('total-remaining').textContent = (monthlyRemaining < 0 ? '-' : '') + formatCurrency(monthlyRemaining);
  $('total-remaining').className = 'overview-amount' + (monthlyRemaining < 0 ? ' negative' : '');
  $('total-budget').textContent = formatCurrency(monthlyBudget);
  $('total-spent').textContent = formatCurrency(monthlySpent);

  const bar = $('total-bar');
  bar.style.width = monthlyPct + '%';
  bar.style.background = monthlyPct > 90 ? '#FF3B30' : monthlyPct > 75 ? '#FF9500' : '#5856D6';
}

// ============================================
// PERIOD SWITCHER
// ============================================
function renderPeriodSwitchers() {
  ['period-switcher-dashboard', 'period-switcher-history'].forEach(id => {
    const el = $(id);
    if (el) buildPeriodSwitcher(el);
  });
}

function buildPeriodSwitcher(el) {
  const [vy, vm] = state.viewPeriod.split('-').map(Number);
  const nowYear = new Date().getFullYear();
  const minYear = Math.min(nowYear - 5, vy);
  const maxYear = Math.max(nowYear + 1, vy);
  const isCurrent = state.viewPeriod === getCurrentPeriod();

  let monthOpts = '';
  for (let m = 1; m <= 12; m++) {
    monthOpts += `<option value="${m}"${m === vm ? ' selected' : ''}>${MONTH_NAMES[m - 1]}</option>`;
  }
  let yearOpts = '';
  for (let y = maxYear; y >= minYear; y--) {
    yearOpts += `<option value="${y}"${y === vy ? ' selected' : ''}>${y}</option>`;
  }

  el.innerHTML = `
    <button class="period-nav" data-dir="-1" aria-label="Previous month">‹</button>
    <select class="period-month" aria-label="Month">${monthOpts}</select>
    <select class="period-year" aria-label="Year">${yearOpts}</select>
    <button class="period-nav" data-dir="1" aria-label="Next month">›</button>
    <button class="period-today${isCurrent ? ' hidden' : ''}">Today</button>
  `;

  el.querySelectorAll('.period-nav').forEach(btn =>
    btn.addEventListener('click', () => shiftViewPeriod(Number(btn.dataset.dir))));
  el.querySelector('.period-month').addEventListener('change', e => {
    const y = state.viewPeriod.split('-')[0];
    setViewPeriod(`${y}-${String(Number(e.target.value)).padStart(2, '0')}`);
  });
  el.querySelector('.period-year').addEventListener('change', e => {
    const m = state.viewPeriod.split('-')[1];
    setViewPeriod(`${e.target.value}-${m}`);
  });
  el.querySelector('.period-today').addEventListener('click', () => setViewPeriod(getCurrentPeriod()));
}

function shiftViewPeriod(delta) {
  let [y, m] = state.viewPeriod.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  setViewPeriod(`${y}-${String(m).padStart(2, '0')}`);
}

function setViewPeriod(period) {
  const prevYear = state.viewPeriod.slice(0, 4);
  state.viewPeriod = period;
  if (useFirebase && period.slice(0, 4) !== prevYear) subscribeTransactions();
  renderAll();
}

// ============================================
// HISTORY
// ============================================
function renderHistory() {
  const filter = $('history-filter');
  if (!filter) return;
  const currentVal = filter.value;

  filter.innerHTML = '<option value="all">All Envelopes</option>';
  state.envelopes.forEach(env => {
    const opt = document.createElement('option');
    opt.value = env.id;
    opt.textContent = env.name;
    filter.appendChild(opt);
  });
  filter.value = currentVal;
  if (!filter.value) filter.value = 'all';

  const period = state.viewPeriod;
  const year = getViewYear();
  const filterEnv = filter.value !== 'all' ? state.envelopes.find(e => e.id === filter.value) : null;
  const showYear = filterEnv?.type === 'annual';

  let txns = showYear
    ? state.transactions.filter(t => (t.period || '').startsWith(year))
    : state.transactions.filter(t => t.period === period);
  if (filter.value !== 'all') txns = txns.filter(t => t.envelopeId === filter.value);

  txns.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const list = $('history-list');
  list.innerHTML = '';

  if (txns.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>No transactions for ${esc(showYear ? year : getPeriodLabel(period))}.</p></div>`;
    return;
  }

  const grouped = {};
  txns.forEach(t => {
    const key = t.date || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  Object.entries(grouped).forEach(([date, items]) => {
    const group = document.createElement('div');
    group.className = 'history-date-group';
    group.innerHTML = `<div class="history-date">${formatDate(date)}</div>`;

    items.forEach(t => {
      const env = state.envelopes.find(e => e.id === t.envelopeId);
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <div class="history-dot" style="background:${env?.color || '#999'}"></div>
        <div class="history-info">
          <div class="history-envelope-name">${esc(env?.name || 'Unknown')}</div>
          ${t.note ? `<div class="history-note">${esc(t.note)}</div>` : ''}
        </div>
        <div class="history-right">
          <div class="history-amount">${formatCurrency(t.amount)}</div>
          <div class="history-who">${esc(t.addedBy || '')}</div>
        </div>
        <button class="history-delete" data-id="${t.id}">Delete</button>
      `;
      row.addEventListener('click', () => showEditTransaction(t));
      group.appendChild(row);
    });

    list.appendChild(group);
  });

  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm('Delete this transaction?')) {
        await deleteTransactionData(btn.dataset.id);
        toast('Deleted');
      }
    });
  });
}

// ============================================
// TRANSACTION MODAL
// ============================================
function showModal(id) { $(id).classList.add('active'); }
function hideModal(id) { $(id).classList.remove('active'); }

function showAddTransaction(preselectedEnvelopeId) {
  editingTransactionId = null;
  $('add-modal-title').textContent = 'Add Expense';
  $('input-amount').value = '';
  $('input-note').value = '';
  $('input-date').value = state.viewPeriod === getCurrentPeriod() ? todayStr() : `${state.viewPeriod}-01`;
  selectedEnvelopeId = preselectedEnvelopeId || (state.envelopes[0]?.id || null);
  renderEnvelopePicker();
  showModal('modal-add');
  setTimeout(() => $('input-amount').focus(), 300);
}

function showEditTransaction(txn) {
  editingTransactionId = txn.id;
  $('add-modal-title').textContent = 'Edit Expense';
  $('input-amount').value = txn.amount.toFixed(2);
  $('input-note').value = txn.note || '';
  $('input-date').value = txn.date || todayStr();
  selectedEnvelopeId = txn.envelopeId;
  renderEnvelopePicker();
  showModal('modal-add');
  setTimeout(() => $('input-amount').focus(), 300);
}

function renderEnvelopePicker() {
  const picker = $('envelope-picker');
  if (!picker) return;
  picker.innerHTML = '';
  state.envelopes.forEach(env => {
    const chip = document.createElement('button');
    chip.className = 'picker-chip' + (selectedEnvelopeId === env.id ? ' selected' : '');
    chip.textContent = env.name;
    if (selectedEnvelopeId === env.id) {
      chip.style.background = env.color;
      chip.style.borderColor = env.color;
    }
    chip.addEventListener('click', () => {
      selectedEnvelopeId = env.id;
      renderEnvelopePicker();
    });
    picker.appendChild(chip);
  });
}

async function saveTransaction() {
  const amount = $('input-amount').value;
  const note = $('input-note').value.trim();
  const date = $('input-date').value;

  if (!selectedEnvelopeId) { toast('Select an envelope'); return; }
  if (!parseAmount(amount)) { toast('Enter an amount'); return; }

  if (editingTransactionId) {
    await updateTransactionData(editingTransactionId, {
      envelopeId: selectedEnvelopeId,
      amount: parseAmount(amount),
      note,
      date,
      period: date.slice(0, 7),
    });
    hideModal('modal-add');
    toast('Updated');
  } else {
    const ok = await addTransactionData(selectedEnvelopeId, amount, note, date);
    if (ok) {
      hideModal('modal-add');
      toast('Added');
    }
  }
}

// ============================================
// ENVELOPE MODAL
// ============================================
function showEnvelopeModal(env) {
  editingEnvelopeId = env?.id || null;
  $('envelope-modal-title').textContent = env ? 'Edit Envelope' : 'Add Envelope';
  $('input-envelope-name').value = env?.name || '';
  $('input-envelope-budget').value = env?.budget || '';
  selectedColor = env?.color || COLORS[0];
  selectedEnvelopeType = env?.type || 'monthly';
  $('btn-delete-envelope').style.display = env ? 'block' : 'none';
  $('budget-label').textContent = selectedEnvelopeType === 'annual' ? 'Annual Budget' : 'Monthly Budget';

  renderEnvelopeColorPicker();
  renderTypePicker();
  showModal('modal-envelope');
}

function renderTypePicker() {
  const picker = $('type-picker');
  picker.innerHTML = '';
  [{ key: 'monthly', label: 'Monthly' }, { key: 'annual', label: 'Annual' }].forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'picker-chip' + (selectedEnvelopeType === opt.key ? ' selected' : '');
    chip.textContent = opt.label;
    if (selectedEnvelopeType === opt.key) {
      chip.style.background = 'var(--primary)';
      chip.style.borderColor = 'var(--primary)';
    }
    chip.addEventListener('click', () => {
      selectedEnvelopeType = opt.key;
      $('budget-label').textContent = opt.key === 'annual' ? 'Annual Budget' : 'Monthly Budget';
      renderTypePicker();
    });
    picker.appendChild(chip);
  });
}

function renderEnvelopeColorPicker() {
  buildColorPicker('color-picker', selectedColor, c => {
    selectedColor = c;
    renderEnvelopeColorPicker();
  });
}

async function saveEnvelope() {
  const name = $('input-envelope-name').value.trim();
  const budget = $('input-envelope-budget').value;

  if (!name) { toast('Enter a name'); return; }
  if (!parseAmount(budget)) { toast('Enter a budget'); return; }

  if (editingEnvelopeId) {
    await updateEnvelopeData(editingEnvelopeId, { name, budget: parseAmount(budget), color: selectedColor, type: selectedEnvelopeType });
  } else {
    await addEnvelopeData(name, budget, selectedColor, selectedEnvelopeType);
  }

  hideModal('modal-envelope');
  toast(editingEnvelopeId ? 'Updated' : 'Added');
}

// ============================================
// SETTINGS
// ============================================
function renderSettings() {
  if (!$('settings-email')) return;
  $('settings-email').textContent = state.user?.email || '-';
  $('settings-code').textContent = state.householdCode || '-';

  const monthLabel = getPeriodLabel(state.viewPeriod);
  const exportSpan = $('btn-export-month')?.querySelector('span');
  if (exportSpan) exportSpan.textContent = `Export ${monthLabel} (CSV)`;
  const resetSpan = $('btn-reset-month')?.querySelector('span');
  if (resetSpan) resetSpan.textContent = `Reset ${monthLabel}`;

  const membersList = $('settings-members-list');
  membersList.innerHTML = '';
  Object.entries(state.members).forEach(([uid, name]) => {
    const row = document.createElement('div');
    row.className = 'setting-row member-row';
    const isMe = uid === state.user?.uid;
    row.innerHTML = `
      <span class="setting-label">${esc(name)}${isMe ? ' (you)' : ''}</span>
      ${isMe ? '' : '<button class="member-remove">Remove</button>'}
    `;
    if (!isMe) {
      row.querySelector('.member-remove').addEventListener('click', async () => {
        if (!confirm(`Remove ${name} from this household?`)) return;
        if (useFirebase) {
          await householdRef().update({ [`members.${uid}`]: firebase.firestore.FieldValue.delete() });
        } else {
          delete state.members[uid];
          saveLocal();
          renderSettings();
        }
      });
    }
    membersList.appendChild(row);
  });

  const list = $('envelope-settings-list');
  list.innerHTML = '';
  state.envelopes.forEach(env => {
    const row = document.createElement('div');
    row.className = 'envelope-setting-row';
    row.addEventListener('click', () => showEnvelopeModal(env));
    row.innerHTML = `
      <div class="envelope-setting-color" style="background:${env.color}"></div>
      <div class="envelope-setting-name">${esc(env.name)}</div>
      <div class="envelope-setting-budget">${formatCurrency(env.budget)}/${env.type === 'annual' ? 'yr' : 'mo'}</div>
    `;
    list.appendChild(row);
  });
}

// ============================================
// EXPORT & IMPORT
// ============================================
function csvEscape(str) {
  str = String(str || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportTransactionsCSV(allMonths) {
  const period = state.viewPeriod;
  let txns;
  if (allMonths && useFirebase) {
    const snap = await householdRef().collection('transactions').get();
    txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else if (allMonths) {
    txns = [...state.transactions];
  } else {
    txns = state.transactions.filter(t => t.period === period);
  }

  if (txns.length === 0) {
    toast('No transactions to export');
    return;
  }

  txns.sort((a, b) => (a.period || '').localeCompare(b.period || '') || (a.date || '').localeCompare(b.date || ''));

  const headers = ['Envelope', 'Amount', 'Note', 'Date', 'Period', 'Added By'];
  const rows = txns.map(t => {
    const env = state.envelopes.find(e => e.id === t.envelopeId);
    return [
      csvEscape(env?.name || 'Unknown'),
      t.amount.toFixed(2),
      csvEscape(t.note),
      t.date || '',
      t.period || '',
      csvEscape(t.addedBy),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = allMonths ? 'kayvin-budget-all.csv' : `kayvin-budget-${period}.csv`;
  downloadFile(csv, filename, 'text/csv');
  toast('Exported ' + txns.length + ' transactions');
}

function exportEnvelopesJSON() {
  const data = state.envelopes.map(e => ({
    name: e.name, budget: e.budget, color: e.color, order: e.order, type: e.type || 'monthly',
  }));
  downloadFile(JSON.stringify(data, null, 2), 'kayvin-envelopes.json', 'application/json');
  toast('Exported ' + data.length + ' envelopes');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = (vals[i] || '').trim());
    return row;
  });
}

async function importTransactionsCSV(file) {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length === 0) { toast('No data found in file'); return; }

  const envMap = {};
  state.envelopes.forEach(e => { envMap[e.name.toLowerCase()] = e.id; });

  const valid = [];
  const unmatched = new Set();
  for (const row of rows) {
    const envName = row['Envelope'] || '';
    const envId = envMap[envName.toLowerCase()];
    if (!envId) { unmatched.add(envName); continue; }
    const amount = parseAmount(row['Amount']);
    if (amount <= 0) continue;
    const date = row['Date'] || todayStr();
    valid.push({
      envelopeId: envId,
      amount,
      note: row['Note'] || '',
      date,
      period: row['Period'] || date.slice(0, 7),
      addedBy: row['Added By'] || state.user.name,
    });
  }

  if (valid.length === 0) {
    const msg = unmatched.size
      ? 'No valid rows. Unmatched envelopes: ' + [...unmatched].join(', ')
      : 'No valid rows found';
    toast(msg);
    return;
  }

  let msg = `Import ${valid.length} transactions?`;
  if (unmatched.size) msg += ` (${unmatched.size} rows skipped — unmatched envelopes: ${[...unmatched].join(', ')})`;
  msg += '\nThis adds to your existing data.';
  if (!confirm(msg)) return;

  for (const txn of valid) {
    if (useFirebase) {
      txn.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await householdRef().collection('transactions').add(txn);
    } else {
      txn.id = localId('txn');
      txn.createdAt = new Date().toISOString();
      state.transactions.push(txn);
    }
  }

  if (!useFirebase) { saveLocal(); renderAll(); }
  toast('Imported ' + valid.length + ' transactions');
}

async function importEnvelopesJSON(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { toast('Invalid JSON file'); return; }
  if (!Array.isArray(data)) { toast('Invalid format — expected an array'); return; }

  const valid = data.filter(d => d.name && d.budget);
  if (valid.length === 0) { toast('No valid envelopes found'); return; }

  const existing = valid.filter(d => state.envelopes.some(e => e.name.toLowerCase() === d.name.toLowerCase()));
  const fresh = valid.filter(d => !state.envelopes.some(e => e.name.toLowerCase() === d.name.toLowerCase()));

  let msg = `Import ${valid.length} envelopes?`;
  if (existing.length) msg += `\n${existing.length} existing will be updated (budget/color).`;
  if (fresh.length) msg += `\n${fresh.length} new will be added.`;
  if (!confirm(msg)) return;

  let added = 0, updated = 0;
  for (const item of valid) {
    const match = state.envelopes.find(e => e.name.toLowerCase() === item.name.toLowerCase());
    if (match) {
      await updateEnvelopeData(match.id, {
        budget: parseAmount(item.budget),
        color: item.color || match.color,
        type: item.type || match.type || 'monthly',
      });
      updated++;
    } else {
      await addEnvelopeData(item.name, item.budget, item.color || COLORS[added % COLORS.length], item.type || 'monthly');
      added++;
    }
  }

  toast(`${added} added, ${updated} updated`);
}
