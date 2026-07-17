/**
 * Anna's Money Tracker ~ AGB
 * Features: Supabase sync, budgets, trend chart, recurring expenses
 */
(function () {
  'use strict';

  // ─── Supabase ────────────────────────────────────────────────────────────────

  var SUPABASE_URL = 'https://vvqjrysccdondikgrsey.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cWpyeXNjY2RvbmRpa2dyc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTQ5ODQsImV4cCI6MjA5ODk5MDk4NH0.LBkBp7TbcUEgcJtZCF6_VD0stCV9ZjFJMhZzZlDUaic';
  var TABLE = 'expenses';

  var CLIENT_ID = (function () {
    var k = 'agb_client_id', id = localStorage.getItem(k);
    if (!id) { id = 'agb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); localStorage.setItem(k, id); }
    return id;
  })();

  function sbHeaders() {
    return { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=representation' };
  }
  function sbUrl(path) { return SUPABASE_URL + '/rest/v1/' + path; }

  function sbFetch() {
    return fetch(sbUrl(TABLE + '?client_id=eq.' + encodeURIComponent(CLIENT_ID) + '&order=expense_date.desc'), { headers: sbHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        return rows.map(function (r) {
          return { id: r.id, amount: parseFloat(r.amount), category: r.category, payment: r.payment || '', notes: r.notes || '', date: r.expense_date + 'T00:00:00', isRecurring: !!r.is_recurring };
        });
      });
  }

  function sbInsert(entry) {
    return fetch(sbUrl(TABLE), { method: 'POST', headers: sbHeaders(), body: JSON.stringify({ client_id: CLIENT_ID, amount: entry.amount, category: entry.category, payment: entry.payment || null, notes: entry.notes || null, expense_date: entry.date.slice(0, 10), is_recurring: !!entry.isRecurring }) })
      .then(function (r) { return r.json(); })
      .then(function (rows) { if (!Array.isArray(rows) || !rows[0]) throw new Error('Insert failed'); return rows[0].id; });
  }

  function sbUpdate(id, fields) {
    return fetch(sbUrl(TABLE + '?id=eq.' + id + '&client_id=eq.' + encodeURIComponent(CLIENT_ID)), { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ amount: fields.amount, category: fields.category, payment: fields.payment || null, notes: fields.notes || null, is_recurring: !!fields.isRecurring }) })
      .then(function (r) { if (!r.ok) throw new Error('Update failed'); });
  }

  function sbDelete(id) {
    return fetch(sbUrl(TABLE + '?id=eq.' + id + '&client_id=eq.' + encodeURIComponent(CLIENT_ID)), { method: 'DELETE', headers: Object.assign({}, sbHeaders(), { Prefer: '' }) })
      .then(function (r) { if (!r.ok) throw new Error('Delete failed'); });
  }

  // ─── Constants ───────────────────────────────────────────────────────────────

  var STORAGE_KEY  = 'agb_expenses';
  var BUDGETS_KEY  = 'agb_budgets';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var CATEGORIES = ['Health','Beauty','Food / Groceries','Vacation / Relaxation / Eating Out','House','Self Improvement','Gadgets','Clothing','Transportation','Gifts','Government Savings'];

  var CAT_EMOJI = { 'Health':'🩺','Beauty':'💄','Food / Groceries':'🛒','Vacation / Relaxation / Eating Out':'🌴','House':'🏠','Self Improvement':'📚','Gadgets':'💻','Clothing':'👗','Transportation':'🚗','Gifts':'🎁','Government Savings':'🏛️' };

  // ─── State ───────────────────────────────────────────────────────────────────

  var today     = new Date();
  var viewYear  = today.getFullYear();
  var viewMonth = today.getMonth();
  var expenses  = loadLocal();
  var budgets   = loadBudgets();

  // ─── DOM ─────────────────────────────────────────────────────────────────────

  var $ = function (id) { return document.getElementById(id); };

  var elTabTracker = $('tab-tracker'), elTabDashboard = $('tab-dashboard');
  var elViewTracker = $('view-tracker'), elViewDash = $('view-dashboard');
  var elMonthLabel = $('month-label'), elPrevMonth = $('prev-month'), elNextMonth = $('next-month');
  var elTotalSpent = $('total-spent'), elBudgetLeft = $('budget-left'), elTopCat = $('top-cat');
  var elAmt = $('amt'), elCat = $('cat'), elPayment = $('payment'), elNotes = $('notes'), elIsRecurring = $('is-recurring');
  var elAddBtn = $('add-btn'), elFormError = $('form-error'), elCancelEdit = $('cancel-edit-btn'), elFormTitle = $('form-title');
  var elBudgetBtn = $('budget-btn');
  var elExpenseList = $('expense-list'), elChartSection = $('chart-section'), elCatChart = $('cat-chart');
  var elBudgetSection = $('budget-section'), elBudgetList = $('budget-list');

  var elModalOverlay = $('modal-overlay'), elModalClose = $('modal-close'), elModalCancel = $('modal-cancel'), elModalSave = $('modal-save');
  var elModalId = $('modal-id'), elModalAmt = $('modal-amt'), elModalCat = $('modal-cat'), elModalPayment = $('modal-payment'), elModalNotes = $('modal-notes'), elModalRecurring = $('modal-recurring'), elModalError = $('modal-error');

  var elBudgetModalOverlay = $('budget-modal-overlay'), elBudgetModalClose = $('budget-modal-close'), elBudgetModalCancel = $('budget-modal-cancel'), elBudgetModalSave = $('budget-modal-save'), elBudgetInputs = $('budget-inputs');

  var elDashMonth = $('dash-month'), elDashYear = $('dash-year');
  var elDashTotal = $('dash-total'), elDashCount = $('dash-count'), elDashAvg = $('dash-avg');
  var elDashChartSec = $('dash-chart-section'), elDashCatChart = $('dash-cat-chart');
  var elDashTbody = $('dash-tbody'), elDashEmpty = $('dash-empty'), elDashTfoot = $('dash-tfoot'), elDashTfootTotal = $('dash-tfoot-total');
  var elTrendChart = $('trend-chart');

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function loadLocal() { try { var p = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(p) ? p : []; } catch(e) { return []; } }
  function saveLocal() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)); } catch(e) {} }
  function loadBudgets() { try { return JSON.parse(localStorage.getItem(BUDGETS_KEY)) || {}; } catch(e) { return {}; } }
  function saveBudgets() { try { localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)); } catch(e) {} }

  // ─── Sync ────────────────────────────────────────────────────────────────────

  function syncFromSupabase() {
    setStatus('syncing');
    return sbFetch()
      .then(function (rows) { expenses = rows; saveLocal(); setStatus('online'); populateYears(); renderTracker(); })
      .catch(function () { setStatus('offline'); });
  }

  function setStatus(s) {
    var el = $('sync-status');
    if (!el) return;
    el.textContent = { syncing: 'Syncing...', online: 'Synced', offline: 'Offline' }[s] || '';
    el.className = 'sync-status sync-status--' + s;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function peso(n) { return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(iso) { var d = new Date(iso); return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate(); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function monthlyExp(y, m) {
    return expenses.filter(function (e) { var d = new Date(e.date); return d.getFullYear() === y && d.getMonth() === m; });
  }

  function catTotals(list) {
    var t = {};
    list.forEach(function (e) { t[e.category] = (t[e.category] || 0) + e.amount; });
    return Object.entries(t).sort(function (a, b) { return b[1] - a[1]; });
  }

  function totalBudget() {
    return Object.values(budgets).reduce(function (s, v) { return s + (parseFloat(v) || 0); }, 0);
  }

  // ─── Cat chart ───────────────────────────────────────────────────────────────

  function buildCatChart(container, sorted) {
    if (!sorted.length) { container.innerHTML = ''; return; }
    var max = sorted[0][1];
    var fills = ['', '--alt', '--faint'];
    container.innerHTML = sorted.map(function (pair, i) {
      var cat = pair[0], val = pair[1];
      var pct = ((val / max) * 100).toFixed(1);
      var mod = fills[i % fills.length];
      return '<div class="cat-chart__row">' +
        '<span class="cat-chart__label" title="' + esc(cat) + '">' + (CAT_EMOJI[cat] || '') + ' ' + esc(cat.split('/')[0].trim()) + '</span>' +
        '<div class="cat-chart__track"><div class="cat-chart__fill' + (mod ? ' cat-chart__fill' + mod : '') + '" style="width:' + pct + '%"></div></div>' +
        '<span class="cat-chart__value">' + peso(val) + '</span>' +
        '</div>';
    }).join('');
  }

  // ─── Budget progress bars ────────────────────────────────────────────────────

  function renderBudgetSection(monthly) {
    var hasBudget = Object.keys(budgets).some(function (k) { return parseFloat(budgets[k]) > 0; });
    elBudgetSection.hidden = false;
    if (!hasBudget) { elBudgetList.innerHTML = '<p class="budget-list__empty">No budgets set yet. Use the button above to set monthly limits.</p>'; return; }

    var catSpend = {};
    monthly.forEach(function (e) { catSpend[e.category] = (catSpend[e.category] || 0) + e.amount; });

    var rows = CATEGORIES.filter(function (c) { return parseFloat(budgets[c]) > 0; }).map(function (c) {
      var budget = parseFloat(budgets[c]) || 0;
      var spent  = catSpend[c] || 0;
      var pct    = Math.min((spent / budget) * 100, 100).toFixed(1);
      var over   = spent > budget;
      var statusClass = over ? 'budget-bar__fill--over' : pct > 80 ? 'budget-bar__fill--warn' : '';
      return '<div class="budget-bar">' +
        '<div class="budget-bar__header">' +
          '<span class="budget-bar__cat">' + (CAT_EMOJI[c] || '') + ' ' + esc(c.split('/')[0].trim()) + '</span>' +
          '<span class="budget-bar__amounts">' + peso(spent) + ' <span class="budget-bar__of">of</span> ' + peso(budget) + '</span>' +
        '</div>' +
        '<div class="budget-bar__track"><div class="budget-bar__fill ' + statusClass + '" style="width:' + pct + '%"></div></div>' +
        (over ? '<p class="budget-bar__warning">Over budget by ' + peso(spent - budget) + '</p>' : '') +
      '</div>';
    }).join('');

    elBudgetList.innerHTML = rows;
    elBudgetSection.hidden = false;
  }

  // ─── 6-month trend chart ─────────────────────────────────────────────────────

  function renderTrendChart(baseYear, baseMonth) {
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var m = baseMonth - i, y = baseYear;
      if (m < 0) { m += 12; y -= 1; }
      var total = monthlyExp(y, m).reduce(function (s, e) { return s + e.amount; }, 0);
      months.push({ label: MONTHS_SHORT[m], total: total, isCurrent: (m === baseMonth && y === baseYear) });
    }

    var max = Math.max.apply(null, months.map(function (x) { return x.total; })) || 1;

    elTrendChart.innerHTML = '<div class="trend-chart__bars">' +
      months.map(function (m) {
        var pct = ((m.total / max) * 100).toFixed(1);
        return '<div class="trend-chart__col">' +
          '<span class="trend-chart__val">' + (m.total > 0 ? peso(m.total) : '') + '</span>' +
          '<div class="trend-chart__bar-wrap">' +
            '<div class="trend-chart__bar' + (m.isCurrent ? ' trend-chart__bar--current' : '') + '" style="height:' + pct + '%"></div>' +
          '</div>' +
          '<span class="trend-chart__label">' + m.label + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ─── Year dropdown ───────────────────────────────────────────────────────────

  function populateYears() {
    var selected = elDashYear.value ? parseInt(elDashYear.value, 10) : today.getFullYear();
    var yearSet = {};
    expenses.forEach(function (e) { yearSet[new Date(e.date).getFullYear()] = true; });
    yearSet[today.getFullYear()] = true;
    var years = Object.keys(yearSet).map(Number).sort(function (a, b) { return b - a; });
    elDashYear.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    elDashYear.value = yearSet[selected] ? selected : today.getFullYear();
  }

  // ─── Tab switching ────────────────────────────────────────────────────────────

  function showTab(tab) {
    elViewTracker.hidden = tab !== 'tracker';
    elViewDash.hidden    = tab !== 'dashboard';
    elTabTracker.classList.toggle('tracker__tab--active',   tab === 'tracker');
    elTabDashboard.classList.toggle('tracker__tab--active', tab === 'dashboard');
    if (tab === 'dashboard') renderDashboard();
  }

  // ─── Add expense ─────────────────────────────────────────────────────────────

  function addExpense() {
    clearError();
    var rawAmt = elAmt.value.trim(), cat = elCat.value, payment = elPayment.value, notes = elNotes.value.trim(), isRecurring = elIsRecurring.checked;
    var valid = true;

    if (!rawAmt || isNaN(rawAmt) || parseFloat(rawAmt) <= 0) { elAmt.classList.add('is-error'); valid = false; } else { elAmt.classList.remove('is-error'); }
    if (!cat)     { elCat.classList.add('is-error'); valid = false; } else { elCat.classList.remove('is-error'); }
    if (!payment) { elPayment.classList.add('is-error'); valid = false; } else { elPayment.classList.remove('is-error'); }
    if (!valid)   { showError('Amount, category and payment method are required.'); return; }

    var entry = { id: null, amount: parseFloat(parseFloat(rawAmt).toFixed(2)), category: cat, payment: payment, notes: notes, date: new Date(viewYear, viewMonth, today.getDate()).toISOString(), isRecurring: isRecurring };

    elAddBtn.disabled = true; elAddBtn.textContent = 'Saving...';

    sbInsert(entry)
      .then(function (id) { entry.id = id; })
      .catch(function () { entry.id = Date.now(); })
      .then(function () {
        expenses.unshift(entry); saveLocal(); populateYears(); resetForm(); renderTracker();
        elAddBtn.disabled = false; elAddBtn.textContent = 'Add Expense';
      });
  }

  function resetForm() { elAmt.value = ''; elCat.value = ''; elPayment.value = ''; elNotes.value = ''; elIsRecurring.checked = false; elAmt.focus(); }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  function deleteExpense(id) {
    if (!confirm('Remove this entry?')) return;
    sbDelete(id).catch(function () {});
    expenses = expenses.filter(function (e) { return e.id !== id; });
    saveLocal(); renderTracker();
  }

  // ─── Edit modal ───────────────────────────────────────────────────────────────

  function openEditModal(id) {
    var e = expenses.find(function (x) { return x.id === id; });
    if (!e) return;
    elModalId.value = id; elModalAmt.value = e.amount; elModalCat.value = e.category;
    elModalPayment.value = e.payment || ''; elModalNotes.value = e.notes || '';
    elModalRecurring.checked = !!e.isRecurring;
    elModalError.hidden = true;
    elModalOverlay.hidden = false; document.body.style.overflow = 'hidden'; elModalAmt.focus();
  }

  function closeEditModal() { elModalOverlay.hidden = true; document.body.style.overflow = ''; }

  function saveEdit() {
    var id = Number(elModalId.value), rawAmt = elModalAmt.value.trim(), cat = elModalCat.value, payment = elModalPayment.value, notes = elModalNotes.value.trim(), isRecurring = elModalRecurring.checked;
    var valid = true;
    if (!rawAmt || isNaN(rawAmt) || parseFloat(rawAmt) <= 0) { elModalAmt.classList.add('is-error'); valid = false; } else { elModalAmt.classList.remove('is-error'); }
    if (!cat) { elModalCat.classList.add('is-error'); valid = false; } else { elModalCat.classList.remove('is-error'); }
    if (!valid) { elModalError.textContent = 'Amount and category are required.'; elModalError.hidden = false; return; }

    var fields = { amount: parseFloat(parseFloat(rawAmt).toFixed(2)), category: cat, payment: payment, notes: notes, isRecurring: isRecurring };
    elModalSave.disabled = true; elModalSave.textContent = 'Saving...';
    sbUpdate(id, fields).catch(function () {});
    var idx = expenses.findIndex(function (e) { return e.id === id; });
    if (idx !== -1) { expenses[idx] = Object.assign({}, expenses[idx], fields); saveLocal(); }
    closeEditModal(); renderTracker();
    elModalSave.disabled = false; elModalSave.textContent = 'Save Changes';
  }

  // ─── Budget modal ─────────────────────────────────────────────────────────────

  function openBudgetModal() {
    elBudgetInputs.innerHTML = CATEGORIES.map(function (c) {
      var val = budgets[c] || '';
      return '<div class="expense-form__row">' +
        '<div class="expense-form__group expense-form__group--full">' +
          '<label class="expense-form__label" for="budget-' + esc(c) + '">' + (CAT_EMOJI[c] || '') + ' ' + esc(c) + '</label>' +
          '<input class="expense-form__input" type="number" id="budget-' + esc(c) + '" data-cat="' + esc(c) + '" placeholder="Monthly budget..." min="0" step="1" value="' + esc(val) + '">' +
        '</div>' +
      '</div>';
    }).join('');
    elBudgetModalOverlay.hidden = false; document.body.style.overflow = 'hidden';
  }

  function closeBudgetModal() { elBudgetModalOverlay.hidden = true; document.body.style.overflow = ''; }

  function saveBudgetModal() {
    var inputs = elBudgetInputs.querySelectorAll('input[data-cat]');
    inputs.forEach(function (inp) {
      var cat = inp.dataset.cat, val = parseFloat(inp.value);
      if (val > 0) { budgets[cat] = val; } else { delete budgets[cat]; }
    });
    saveBudgets(); closeBudgetModal(); renderTracker();
  }

  // ─── Error helpers ────────────────────────────────────────────────────────────

  function showError(msg) { elFormError.textContent = msg; elFormError.hidden = false; }
  function clearError()   { elFormError.textContent = ''; elFormError.hidden = true; }

  // ─── Render: Tracker ──────────────────────────────────────────────────────────

  function renderTracker() {
    elMonthLabel.textContent = MONTHS[viewMonth] + ' ' + viewYear;
    var monthly = monthlyExp(viewYear, viewMonth);
    var total   = monthly.reduce(function (s, e) { return s + e.amount; }, 0);
    var sorted  = catTotals(monthly);
    var tb      = totalBudget();

    elTotalSpent.textContent = peso(total);
    elTopCat.textContent     = sorted.length ? sorted[0][0].split('/')[0].trim() : '~';

    if (tb > 0) {
      var left = tb - total;
      elBudgetLeft.textContent = left >= 0 ? peso(left) + ' left' : peso(Math.abs(left)) + ' over';
      elBudgetLeft.className   = 'summary-card__value summary-card__value--sm' + (left < 0 ? ' summary-card__value--over' : '');
    } else {
      elBudgetLeft.textContent = '~ no budget';
      elBudgetLeft.className   = 'summary-card__value summary-card__value--sm';
    }

    renderBudgetSection(monthly); // section always visible; list conditionally rendered

    if (sorted.length) { elChartSection.hidden = false; buildCatChart(elCatChart, sorted); }
    else               { elChartSection.hidden = true;  elCatChart.innerHTML = ''; }

    if (!monthly.length) { elExpenseList.innerHTML = '<p class="expense-list__empty">No expenses logged yet.</p>'; return; }

    var byDate = monthly.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    elExpenseList.innerHTML = byDate.map(function (e) {
      return '<article class="expense-item" data-id="' + e.id + '">' +
        '<div class="expense-item__icon" aria-hidden="true">' + (CAT_EMOJI[e.category] || '•') + '</div>' +
        '<div class="expense-item__body">' +
          '<div class="expense-item__cat">' + esc(e.category) + (e.isRecurring ? ' <span class="badge badge--recurring" title="Recurring">↻</span>' : '') + '</div>' +
          (e.payment ? '<div class="expense-item__payment">' + esc(e.payment) + '</div>' : '') +
          (e.notes   ? '<div class="expense-item__note">'    + esc(e.notes)   + '</div>' : '') +
          '<div class="expense-item__date">' + fmtDate(e.date) + '</div>' +
        '</div>' +
        '<div class="expense-item__right">' +
          '<span class="expense-item__amount">' + peso(e.amount) + '</span>' +
          '<div class="expense-item__actions">' +
            '<button class="expense-item__edit"   data-id="' + e.id + '" aria-label="Edit">&#9998;</button>' +
            '<button class="expense-item__delete" data-id="' + e.id + '" aria-label="Delete">&#x2715;</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // ─── Render: Dashboard ────────────────────────────────────────────────────────

  function renderDashboard() {
    var m = parseInt(elDashMonth.value, 10), y = parseInt(elDashYear.value, 10);
    var list = monthlyExp(y, m);
    var total = list.reduce(function (s, e) { return s + e.amount; }, 0);
    var sorted = catTotals(list);

    elDashTotal.textContent = peso(total);
    elDashCount.textContent = list.length;
    elDashAvg.textContent   = list.length ? peso(total / list.length) : '~';

    renderTrendChart(y, m);

    if (sorted.length) { elDashChartSec.hidden = false; buildCatChart(elDashCatChart, sorted); }
    else               { elDashChartSec.hidden = true;  elDashCatChart.innerHTML = ''; }

    if (!list.length) { elDashTbody.innerHTML = ''; elDashEmpty.hidden = false; elDashTfoot.hidden = true; return; }
    elDashEmpty.hidden = true; elDashTfoot.hidden = false;
    elDashTfootTotal.textContent = peso(total);

    var byDate = list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    elDashTbody.innerHTML = byDate.map(function (e) {
      return '<tr>' +
        '<td class="dash-table__date">' + fmtDate(e.date) + '</td>' +
        '<td>' + esc(e.category) + (e.isRecurring ? ' <span class="badge badge--recurring">↻</span>' : '') + '</td>' +
        '<td>' + esc(e.payment || '~') + '</td>' +
        '<td class="dash-table__note">' + esc(e.notes || '~') + '</td>' +
        '<td class="dash-table__num">' + peso(e.amount) + '</td>' +
      '</tr>';
    }).join('');
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  elTabTracker.addEventListener('click',   function () { showTab('tracker'); });
  elTabDashboard.addEventListener('click', function () { showTab('dashboard'); });
  elPrevMonth.addEventListener('click', function () { viewMonth -= 1; if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; } renderTracker(); });
  elNextMonth.addEventListener('click', function () { viewMonth += 1; if (viewMonth > 11) { viewMonth = 0; viewYear += 1; } renderTracker(); });
  elAddBtn.addEventListener('click', addExpense);
  elAmt.addEventListener('keydown', function (e) { if (e.key === 'Enter') elCat.focus(); });
  elAmt.addEventListener('input',     function () { elAmt.classList.remove('is-error'); });
  elCat.addEventListener('change',    function () { elCat.classList.remove('is-error'); });
  elPayment.addEventListener('change', function () { elPayment.classList.remove('is-error'); });
  elCancelEdit.addEventListener('click', function () { elCancelEdit.hidden = true; elFormTitle.textContent = 'Add Expense'; elAddBtn.textContent = 'Add Expense'; resetForm(); });
  elBudgetBtn.addEventListener('click', openBudgetModal);

  elExpenseList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-id]');
    if (!btn) return;
    var id = Number(btn.dataset.id);
    if (btn.classList.contains('expense-item__delete')) deleteExpense(id);
    if (btn.classList.contains('expense-item__edit'))   openEditModal(id);
  });

  elModalClose.addEventListener('click',  closeEditModal);
  elModalCancel.addEventListener('click', closeEditModal);
  elModalSave.addEventListener('click',   saveEdit);
  elModalOverlay.addEventListener('click', function (e) { if (e.target === elModalOverlay) closeEditModal(); });

  elBudgetModalClose.addEventListener('click',  closeBudgetModal);
  elBudgetModalCancel.addEventListener('click', closeBudgetModal);
  elBudgetModalSave.addEventListener('click',   saveBudgetModal);
  elBudgetModalOverlay.addEventListener('click', function (e) { if (e.target === elBudgetModalOverlay) closeBudgetModal(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!elModalOverlay.hidden) closeEditModal(); if (!elBudgetModalOverlay.hidden) closeBudgetModal(); }
  });

  elDashMonth.addEventListener('change', renderDashboard);
  elDashYear.addEventListener('change',  renderDashboard);

  // ─── Init ─────────────────────────────────────────────────────────────────────

  elDashMonth.value = today.getMonth();
  populateYears();
  renderTracker();
  syncFromSupabase();

})();
