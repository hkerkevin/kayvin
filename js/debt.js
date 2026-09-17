// ============================================
// KAYVIN — DEBT MODULE
// Debt tracker (log payments, progress) and a
// payoff planner (avalanche/snowball, extra
// payments, lump sums, refinance what-ifs).
// ============================================

let editingDebtId = null;
let paymentDebtId = null;
let selectedDebtColor = COLORS[3];

// ============================================
// DEBT TRACKER
// ============================================
function paidTowardDebt(debtId) {
  return state.payments
    .filter(p => p.debtId === debtId)
    .reduce((s, p) => s + p.amount, 0);
}

function renderDebts() {
  const container = $('debts-container');
  if (!container) return;

  const total = state.debts.reduce((s, d) => s + (d.balance || 0), 0);
  const period = getCurrentPeriod();
  const paidThisMonth = state.payments
    .filter(p => (p.period || (p.date || '').slice(0, 7)) === period)
    .reduce((s, p) => s + p.amount, 0);

  $('debt-total').textContent = formatCurrency(total);
  $('debt-total-label').textContent = state.debts.length ? `${state.debts.length} debt${state.debts.length > 1 ? 's' : ''}` : '';
  $('debt-count').textContent = state.debts.length;
  $('debt-paid-month').textContent = formatCurrency(paidThisMonth);

  container.innerHTML = '';

  if (state.debts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>No debts tracked yet.<br>Tap + to add one.</p></div>';
    return;
  }

  state.debts.forEach(debt => {
    const paid = paidTowardDebt(debt.id);
    const origin = debt.balance + paid; // best estimate of starting balance since tracking
    const pct = origin > 0 ? Math.min((paid / origin) * 100, 100) : 0;

    const card = document.createElement('div');
    card.className = 'envelope-card';
    card.addEventListener('click', () => showDebtModal(debt));
    card.innerHTML = `
      <div class="envelope-header">
        <div class="envelope-name" style="color:${debt.color}">${esc(debt.name)}</div>
        <div class="envelope-remaining">${formatCurrency(debt.balance)}</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;background:${debt.color}"></div>
      </div>
      <div class="debt-meta">
        <span>${(debt.apr || 0).toFixed(2)}% APR · min ${formatCurrency(debt.minPayment)}/mo</span>
        <button class="btn-mini" data-pay="${debt.id}">Log payment</button>
      </div>
    `;
    card.querySelector('[data-pay]').addEventListener('click', e => {
      e.stopPropagation();
      showPaymentModal(debt.id);
    });
    container.appendChild(card);
  });

  // Recent payments (for review / correction)
  const recent = [...state.payments]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 15);
  if (recent.length) {
    const section = document.createElement('div');
    section.className = 'debt-payments';
    section.innerHTML = '<div class="history-date">Recent payments</div>';
    recent.forEach(p => {
      const debt = state.debts.find(d => d.id === p.debtId);
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <div class="history-dot" style="background:${debt?.color || '#999'}"></div>
        <div class="history-info">
          <div class="history-envelope-name">${esc(debt?.name || 'Unknown')}</div>
          <div class="history-note">${formatDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</div>
        </div>
        <div class="history-right">
          <div class="history-amount">${formatCurrency(p.amount)}</div>
          <div class="history-who">${esc(p.addedBy || '')}</div>
        </div>
        <button class="history-delete" data-delpay="${p.id}">Delete</button>
      `;
      row.querySelector('[data-delpay]').addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm('Delete this payment? The amount is added back to the balance.')) {
          await deletePaymentData(p.id);
          toast('Deleted');
        }
      });
      section.appendChild(row);
    });
    container.appendChild(section);
  }
}

// ============================================
// DEBT MODAL
// ============================================
function showDebtModal(debt) {
  editingDebtId = debt?.id || null;
  $('debt-modal-title').textContent = debt ? 'Edit Debt' : 'Add Debt';
  $('input-debt-name').value = debt?.name || '';
  $('input-debt-balance').value = debt?.balance ?? '';
  $('input-debt-apr').value = debt?.apr ?? '';
  $('input-debt-minpayment').value = debt?.minPayment ?? '';
  selectedDebtColor = debt?.color || COLORS[3];
  $('btn-delete-debt').style.display = debt ? 'block' : 'none';
  renderDebtColorPicker();
  showModal('modal-debt');
}

function renderDebtColorPicker() {
  buildColorPicker('debt-color-picker', selectedDebtColor, c => {
    selectedDebtColor = c;
    renderDebtColorPicker();
  });
}

async function saveDebt() {
  const name = $('input-debt-name').value.trim();
  const balance = $('input-debt-balance').value;
  const apr = $('input-debt-apr').value;
  const minPayment = $('input-debt-minpayment').value;

  if (!name) { toast('Enter a name'); return; }
  if (parseAmount(balance) <= 0) { toast('Enter the current balance'); return; }

  const data = { name, balance, apr, minPayment, color: selectedDebtColor };
  if (editingDebtId) {
    await updateDebtData(editingDebtId, {
      name, balance: parseAmount(balance), apr: parseRate(apr),
      minPayment: parseAmount(minPayment), color: selectedDebtColor,
    });
  } else {
    await addDebtData(data);
  }
  hideModal('modal-debt');
  toast(editingDebtId ? 'Updated' : 'Added');
}

// ============================================
// PAYMENT MODAL
// ============================================
function showPaymentModal(debtId) {
  paymentDebtId = debtId;
  const debt = state.debts.find(d => d.id === debtId);
  $('payment-modal-title').textContent = 'Log Payment';
  $('payment-debt-hint').textContent = debt ? `${debt.name} · balance ${formatCurrency(debt.balance)}` : '';
  $('input-payment-amount').value = debt?.minPayment ? debt.minPayment.toFixed(2) : '';
  $('input-payment-note').value = '';
  $('input-payment-date').value = todayStr();
  showModal('modal-payment');
  setTimeout(() => $('input-payment-amount').focus(), 300);
}

async function savePayment() {
  const amount = $('input-payment-amount').value;
  const note = $('input-payment-note').value.trim();
  const date = $('input-payment-date').value;
  if (!parseAmount(amount)) { toast('Enter an amount'); return; }
  const ok = await logPaymentData(paymentDebtId, amount, note, date);
  if (ok) { hideModal('modal-payment'); toast('Payment logged'); }
}

// ============================================
// PAYOFF ENGINE
// ============================================
function addMonthsToPeriod(period, n) {
  let [y, m] = period.split('-').map(Number);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function priorityDebt(debts, strategy) {
  const active = debts.filter(d => d.balance > 0.005);
  if (!active.length) return null;
  if (strategy === 'snowball') {
    return active.reduce((a, b) => (b.balance < a.balance ? b : a));
  }
  return active.reduce((a, b) => (b.apr > a.apr ? b : a));
}

// Month-by-month simulation. Interest accrues monthly; minimums paid first,
// then extra + freed minimums + scheduled lump sums roll into the priority debt.
function simulatePayoff(debtsInput, opts) {
  const startPeriod = opts.startPeriod || getCurrentPeriod();
  const strategy = opts.strategy || 'avalanche';
  const extra = Math.max(0, opts.extraMonthly || 0);
  const lumpSums = opts.lumpSums || [];
  const refis = opts.refis || [];

  let debts = debtsInput.map(d => ({
    id: d.id, name: d.name, color: d.color,
    balance: d.balance, apr: d.apr || 0, minPayment: d.minPayment || 0,
    paidOffPeriod: d.balance <= 0 ? startPeriod : null,
  }));

  let totalInterest = 0, totalPaid = 0, months = 0, neverPaysOff = false;
  let period = startPeriod;
  const MAX = 1200;
  const active = () => debts.filter(d => d.balance > 0.005).length;

  while (active() > 0) {
    if (months >= MAX) { neverPaysOff = true; break; }

    // Refinance changes effective this month
    refis.forEach(r => {
      if (r.period === period) {
        const d = debts.find(x => x.id === r.debtId);
        if (d) d.apr = r.newApr;
      }
    });

    // Accrue interest
    debts.forEach(d => {
      if (d.balance > 0) {
        const interest = d.balance * (d.apr / 100 / 12);
        d.balance += interest;
        totalInterest += interest;
      }
    });

    // Pay minimums; freed minimums roll into the extra pool
    let pool = extra;
    debts.forEach(d => {
      if (d.balance <= 0) return;
      const pay = Math.min(d.minPayment, d.balance);
      d.balance -= pay;
      totalPaid += pay;
      if (d.minPayment > pay) pool += (d.minPayment - pay);
    });

    // Scheduled lump sums this month
    lumpSums.filter(l => l.period === period).forEach(l => {
      let target = null;
      if (l.debtId && l.debtId !== 'auto') target = debts.find(d => d.id === l.debtId && d.balance > 0);
      if (!target) target = priorityDebt(debts, strategy);
      let amt = l.amount;
      if (target) {
        const pay = Math.min(amt, target.balance);
        target.balance -= pay;
        totalPaid += pay;
        amt -= pay;
      }
      pool += amt; // leftover joins the pool
    });

    // Roll the pool into priority debts
    let guard = 0;
    while (pool > 0.005 && active() > 0 && guard < 200) {
      const target = priorityDebt(debts, strategy);
      if (!target) break;
      const pay = Math.min(pool, target.balance);
      target.balance -= pay;
      totalPaid += pay;
      pool -= pay;
      guard++;
    }

    months++;
    debts.forEach(d => {
      if (d.balance <= 0.005 && !d.paidOffPeriod) { d.balance = 0; d.paidOffPeriod = period; }
    });
    period = addMonthsToPeriod(period, 1);
  }

  return {
    months,
    neverPaysOff,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    payoffPeriod: (neverPaysOff || months === 0) ? null : addMonthsToPeriod(startPeriod, months - 1),
    schedule: debts.map(d => ({ id: d.id, name: d.name, color: d.color, paidOffPeriod: d.paidOffPeriod })),
  };
}

function fmtDuration(months) {
  if (months <= 0) return '0 months';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(y + (y > 1 ? ' yrs' : ' yr'));
  if (m) parts.push(m + ' mo');
  return parts.join(' ') || '0 months';
}

// ============================================
// PAYOFF PLANNER UI
// ============================================
function renderPayoff() {
  const container = $('payoff-container');
  if (!container) return;

  const debts = state.debts.filter(d => d.balance > 0.005);
  if (debts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><p>Add debts with a balance,<br>APR, and minimum payment to plan your payoff.</p></div>';
    return;
  }

  const p = state.planner;
  const opts = { strategy: p.strategy, extraMonthly: p.extraMonthly, lumpSums: p.lumpSums, refis: p.refis };
  const plan = simulatePayoff(debts, opts);
  const baseline = simulatePayoff(debts, { strategy: p.strategy, extraMonthly: 0, lumpSums: [], refis: [] });
  const avalanche = simulatePayoff(debts, { ...opts, strategy: 'avalanche' });
  const snowball = simulatePayoff(debts, { ...opts, strategy: 'snowball' });

  const interestSaved = baseline.totalInterest - plan.totalInterest;
  const monthsSaved = baseline.months - plan.months;

  const debtOptions = ['<option value="auto">Priority debt</option>']
    .concat(debts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`)).join('');

  const planResult = plan.neverPaysOff
    ? `<div class="payoff-hero-value negative">Never (at this rate)</div>
       <div class="payoff-hero-sub">Payments don't cover interest — increase extra/month.</div>`
    : `<div class="payoff-hero-value">${getPeriodLabel(plan.payoffPeriod)}</div>
       <div class="payoff-hero-sub">${fmtDuration(plan.months)} · ${formatCurrencyShort(plan.totalInterest)} interest</div>`;

  container.innerHTML = `
    <div class="overview-card payoff-hero">
      <div class="overview-label">Debt-free</div>
      ${planResult}
      ${!plan.neverPaysOff && (interestSaved > 1 || monthsSaved > 0) ? `
        <div class="payoff-saved">vs minimums only: save <strong>${formatCurrencyShort(interestSaved)}</strong> &amp; <strong>${fmtDuration(monthsSaved)}</strong></div>
      ` : ''}
    </div>

    <div class="settings-card payoff-controls">
      <div class="setting-row payoff-row-col">
        <span class="field-label" style="margin:0 0 8px">Strategy</span>
        <div class="seg" id="payoff-strategy">
          <button class="seg-btn${p.strategy === 'avalanche' ? ' active' : ''}" data-strat="avalanche">Avalanche</button>
          <button class="seg-btn${p.strategy === 'snowball' ? ' active' : ''}" data-strat="snowball">Snowball</button>
        </div>
        <span class="seg-hint">${p.strategy === 'avalanche' ? 'Highest APR first — saves the most interest.' : 'Smallest balance first — fastest wins for momentum.'}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">Extra $/month</span>
        <div class="inline-input"><span>$</span><input type="text" id="payoff-extra" inputmode="decimal" value="${p.extraMonthly || ''}" placeholder="0"></div>
      </div>
    </div>

    <div class="payoff-compare">
      <div class="compare-card${p.strategy === 'avalanche' ? ' active' : ''}">
        <div class="compare-title">Avalanche</div>
        <div class="compare-main">${avalanche.neverPaysOff ? '—' : fmtDuration(avalanche.months)}</div>
        <div class="compare-sub">${avalanche.neverPaysOff ? 'never' : formatCurrencyShort(avalanche.totalInterest) + ' interest'}</div>
      </div>
      <div class="compare-card${p.strategy === 'snowball' ? ' active' : ''}">
        <div class="compare-title">Snowball</div>
        <div class="compare-main">${snowball.neverPaysOff ? '—' : fmtDuration(snowball.months)}</div>
        <div class="compare-sub">${snowball.neverPaysOff ? 'never' : formatCurrencyShort(snowball.totalInterest) + ' interest'}</div>
      </div>
    </div>

    <h3 class="section-title">Payoff order</h3>
    <div class="settings-card" id="payoff-order"></div>

    <h3 class="section-title">One-time lump sums</h3>
    <div class="settings-card" id="lumpsum-list"></div>
    <div class="mini-form">
      <div class="inline-input"><span>$</span><input type="text" id="lump-amount" inputmode="decimal" placeholder="Amount"></div>
      <input type="month" id="lump-month" class="field-input mini" value="${addMonthsToPeriod(getCurrentPeriod(), 1)}">
      <select id="lump-debt" class="field-input mini">${debtOptions}</select>
      <button class="btn-mini add" id="lump-add">Add</button>
    </div>

    <h3 class="section-title">Refinance what-if</h3>
    <div class="settings-card" id="refi-list"></div>
    <div class="mini-form">
      <select id="refi-debt" class="field-input mini">${debts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
      <div class="inline-input"><input type="text" id="refi-apr" inputmode="decimal" placeholder="New APR"><span>%</span></div>
      <input type="month" id="refi-month" class="field-input mini" value="${getCurrentPeriod()}">
      <button class="btn-mini add" id="refi-add">Add</button>
    </div>
  `;

  // Payoff order list
  const order = [...plan.schedule]
    .filter(s => s.paidOffPeriod)
    .sort((a, b) => a.paidOffPeriod.localeCompare(b.paidOffPeriod));
  const orderEl = $('payoff-order');
  if (order.length) {
    orderEl.innerHTML = order.map((s, i) => `
      <div class="setting-row">
        <span class="setting-label"><span class="order-num" style="background:${s.color}">${i + 1}</span> ${esc(s.name)}</span>
        <span class="setting-value">${getPeriodLabel(s.paidOffPeriod)}</span>
      </div>
    `).join('');
  } else {
    orderEl.innerHTML = '<div class="setting-row"><span class="setting-value">Not payable at this rate.</span></div>';
  }

  // Lump sum list
  const lumpEl = $('lumpsum-list');
  if (p.lumpSums.length) {
    lumpEl.innerHTML = p.lumpSums.map((l, i) => {
      const d = state.debts.find(x => x.id === l.debtId);
      const target = l.debtId === 'auto' || !d ? 'Priority debt' : d.name;
      return `<div class="setting-row">
        <span class="setting-label">${formatCurrency(l.amount)} · ${getPeriodLabel(l.period)}</span>
        <span class="setting-value">${esc(target)} <button class="member-remove" data-dellump="${i}">Remove</button></span>
      </div>`;
    }).join('');
  } else {
    lumpEl.innerHTML = '<div class="setting-row"><span class="setting-value">None. Add a bonus or windfall above.</span></div>';
  }

  // Refi list
  const refiEl = $('refi-list');
  if (p.refis.length) {
    refiEl.innerHTML = p.refis.map((r, i) => {
      const d = state.debts.find(x => x.id === r.debtId);
      return `<div class="setting-row">
        <span class="setting-label">${esc(d?.name || 'Debt')} → ${r.newApr}% APR</span>
        <span class="setting-value">from ${getPeriodLabel(r.period)} <button class="member-remove" data-delrefi="${i}">Remove</button></span>
      </div>`;
    }).join('');
  } else {
    refiEl.innerHTML = '<div class="setting-row"><span class="setting-value">None. Model a lower rate above.</span></div>';
  }

  bindPayoffControls();
}

function bindPayoffControls() {
  const p = state.planner;

  $('payoff-strategy')?.querySelectorAll('.seg-btn').forEach(btn =>
    btn.addEventListener('click', () => savePlannerData({ strategy: btn.dataset.strat })));

  const extra = $('payoff-extra');
  if (extra) {
    const commit = () => savePlannerData({ extraMonthly: parseAmount(extra.value) });
    extra.addEventListener('change', commit);
    extra.addEventListener('keydown', e => { if (e.key === 'Enter') extra.blur(); });
  }

  $('lump-add')?.addEventListener('click', () => {
    const amount = parseAmount($('lump-amount').value);
    const period = $('lump-month').value;
    const debtId = $('lump-debt').value;
    if (!amount || !period) { toast('Enter an amount and month'); return; }
    savePlannerData({ lumpSums: [...p.lumpSums, { amount, period, debtId }] });
  });

  $('refi-add')?.addEventListener('click', () => {
    const debtId = $('refi-debt').value;
    const newApr = parseRate($('refi-apr').value);
    const period = $('refi-month').value;
    if (!debtId || !period) { toast('Pick a debt and month'); return; }
    savePlannerData({ refis: [...p.refis, { debtId, newApr, period }] });
  });

  document.querySelectorAll('[data-dellump]').forEach(btn =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.dellump);
      savePlannerData({ lumpSums: p.lumpSums.filter((_, idx) => idx !== i) });
    }));

  document.querySelectorAll('[data-delrefi]').forEach(btn =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.delrefi);
      savePlannerData({ refis: p.refis.filter((_, idx) => idx !== i) });
    }));
}
