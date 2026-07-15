/**
 * Anna's Money Tracker
 * AGB ~ tracker.js
 * Supabase-backed, localStorage fallback for offline use
 */

(function () {
  'use strict';

  // ─── Supabase config ─────────────────────────────────────────────────────────

  var SUPABASE_URL = 'https://vvqjrysccdondikgrsey.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cWpyeXNjY2RvbmRpa2dyc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTQ5ODQsImV4cCI6MjA5ODk5MDk4NH0.LBkBp7TbcUEgcJtZCF6_VD0stCV9ZjFJMhZzZlDUaic';
  var TABLE = 'expenses';

  // Stable client ID so all entries from this browser belong to Anna
  var CLIENT_ID = (function () {
    var key = 'agb_client_id';
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'agb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(key, id);
    }
    return id;
  })();

  // ─── Supabase REST helpers ────────────────────────────────────────────────────

  function sbHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=representation',
    };
  }

  function sbUrl(path) {
    return SUPABASE_URL + '/rest/v1/' + path;
  }

  // Fetch all expenses for this client from Supabase
  function sbFetch() {
    return fetch(
      sbUrl(TABLE + '?client_id=eq.' + encodeURIComponent(CLIENT_ID) + '&order=expense_date.desc'),
      { headers: sbHeaders() }
    )
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        // Normalise Supabase rows to internal format
        return rows.map(function (r) {
          return {
            id: r.id,
            amount: parseFloat(r.amount),
            category: r.category,
            payment: r.payment || '',
            notes: r.notes || '',
            date: r.expense_date + 'T00:00:00',
          };
        });
      });
  }

  function sbInsert(entry) {
    return fetch(sbUrl(TABLE), {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        client_id: CLIENT_ID,
        amount: entry.amount,
        category: entry.category,
        payment: entry.payment || null,
        notes: entry.notes || null,
        expense_date: entry.date.slice(0, 10),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows[0]) throw new Error('Insert failed');
        return rows[0].id;
      });
  }

  function sbUpdate(id, fields) {
    return fetch(sbUrl(TABLE + '?id=eq.' + id + '&client_id=eq.' + encodeURIComponent(CLIENT_ID)), {
      method: 'PATCH',
      headers: sbHeaders(),
      body: JSON.stringify({
        amount: fields.amount,
        category: fields.category,
        payment: fields.payment || null,
        notes: fields.notes || null,
      }),
    }).then(function (r) {
      if (!r.ok) throw new Error('Update failed');
    });
  }

  function sbDelete(id) {
    return fetch(sbUrl(TABLE + '?id=eq.' + id + '&client_id=eq.' + encodeURIComponent(CLIENT_ID)), {
      method: 'DELETE',
      headers: Object.assign({}, sbHeaders(), { Prefer: '' }),
    }).then(function (r) {
      if (!r.ok) throw new Error('Delete failed');
    });
  }

  // ─── Constants ───────────────────────────────────────────────────────────────

  var STORAGE_KEY = 'agb_expenses';

  var MONTHS = [
    'January','February','March','April',
    'May','June','July','August',
    'September','October','November','December',
  ];

  var MONTHS_SHORT = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec',
  ];

  var CAT_EMOJI = {
    'Health': '🩺',
    'Beauty': '💄',
    'Food / Groceries': '🛒',
    'Vacation / Relaxation / Eating Out': '🌴',
    'House': '🏠',
    'Self Improvement': '📚',
    'Gadgets': '💻',
    'Clothing': '👗',
    'Transportation': '🚗',
    'Gifts': '🎁',
    'Government Savings': '🏛️',
  };

  // ─── State ───────────────────────────────────────────────────────────────────

  var today     = new Date();
  var viewYear  = today.getFullYear();
  var viewMonth = today.getMonth();
  var expenses  = loadLocal();
  var online    = true;

  // ─── DOM refs ────────────────────────────────────────────────────────────────

  var $ = function (id) { return document.getElementById(id); };

  var elTabTracker    = $('tab-tracker');
  var elTabDashboard  = $('tab-dashboard');
  var elViewTracker   = $('view-tracker');
  var elViewDash      = $('view-dashboard');

  var elMonthLabel    = $('month-label');
  var elPrevMonth     = $('prev-month');
  var elNextMonth     = $('next-month');
  var elTotalSpent    = $('total-spent');
  var elEntryCount    = $('entry-count');
  var elTopCat        = $('top-cat');
  var elAmt           = $('amt');
  var elCat           = $('cat');
  var elPayment       = $('payment');
  var elNotes         = $('notes');
  var elAddBtn        = $('add-btn');
  var elFormError     = $('form-error');
  var elExpenseList   = $('expense-list');
  var elChartSection  = $('chart-section');
  var elCatChart      = $('cat-chart');
  var elFormTitle     = $('form-title');
  var elCancelEdit    = $('cancel-edit-btn');

  var elModalOverlay  = $('modal-overlay');
  var elModalClose    = $('modal-close');
  var elModalCancel   = $('modal-cancel');
  var elModalSave     = $('modal-save');
  var elModalId       = $('modal-id');
  var elModalAmt      = $('modal-amt');
  var elModalCat      = $('modal-cat');
  var elModalPayment  = $('modal-payment');
  var elModalNotes    = $('modal-notes');
  var elModalError    = $('modal-error');

  var elDashMonth       = $('dash-month');
  var elDashYear        = $('dash-year');
  var elDashTotal       = $('dash-total');
  var elDashCount       = $('dash-count');
  var elDashAvg         = $('dash-avg');
  var elDashChartSec    = $('dash-chart-section');
  var elDashCatChart    = $('dash-cat-chart');
  var elDashTbody       = $('dash-tbody');
  var elDashEmpty       = $('dash-empty');
  var elDashTfoot       = $('dash-tfoot');
  var elDashTfootTotal  = $('dash-tfoot-total');

  // ─── localStorage fallback ───────────────────────────────────────────────────

  function loadLocal() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; }
  }

  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)); }
    catch(e) { console.warn('localStorage save failed:', e); }
  }

  // ─── Sync: load from Supabase on boot ────────────────────────────────────────

  function syncFromSupabase() {
    setStatus('syncing');
    return sbFetch()
      .then(function (rows) {
        expenses = rows;
        saveLocal();
        online = true;
        setStatus('online');
        renderTracker();
        populateYears();
      })
      .catch(function (err) {
        console.warn('Supabase fetch failed, using local data:', err);
        online = false;
        setStatus('offline');
      });
  }

  // ─── Status indicator ────────────────────────────────────────────────────────

  function setStatus(state) {
    var el = $('sync-status');
    if (!el) return;
    var labels = { syncing: 'Syncing...', online: 'Synced', offline: 'Offline ~ local only' };
    el.textContent = labels[state] || '';
    el.className = 'sync-status sync-status--' + state;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function formatPeso(n) {
    return '₱' + Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function monthlyExpenses(y, m) {
    return expenses.filter(function (e) {
      var d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }

  function catTotals(list) {
    var t = {};
    list.forEach(function (e) { t[e.category] = (t[e.category] || 0) + e.amount; });
    return Object.entries(t).sort(function (a, b) { return b[1] - a[1]; });
  }

  function buildCatChart(container, sorted) {
    if (!sorted.length) { container.innerHTML = ''; return; }
    var max = sorted[0][1];
    var fills = ['', '--alt', '--faint'];
    container.innerHTML = sorted.map(function (pair, i) {
      var cat = pair[0], val = pair[1];
      var pct = ((val / max) * 100).toFixed(1);
      var mod = fills[i % fills.length];
      var label = cat.split('/')[0].trim();
      return '<div class="cat-chart__row">' +
        '<span class="cat-chart__label" title="' + escHtml(cat) + '">' + (CAT_EMOJI[cat] || '') + ' ' + escHtml(label) + '</span>' +
        '<div class="cat-chart__track" role="presentation">' +
        '<div class="cat-chart__fill' + (mod ? ' cat-chart__fill' + mod : '') + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="cat-chart__value">' + formatPeso(val) + '</span>' +
        '</div>';
    }).join('');
  }

  // ─── Year dropdown ~ populated once on init ───────────────────────────────────

  function populateYears() {
    var selected = elDashYear.value ? parseInt(elDashYear.value, 10) : today.getFullYear();
    var yearSet = {};
    expenses.forEach(function (e) { yearSet[new Date(e.date).getFullYear()] = true; });
    yearSet[today.getFullYear()] = true;
    var years = Object.keys(yearSet).map(Number).sort(function (a, b) { return b - a; });
    elDashYear.innerHTML = years.map(function (y) {
      return '<option value="' + y + '">' + y + '</option>';
    }).join('');
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

  // ─── Add Expense ─────────────────────────────────────────────────────────────

  function addExpense() {
    clearError();
    var rawAmt  = elAmt.value.trim();
    var cat     = elCat.value;
    var payment = elPayment.value;
    var notes   = elNotes.value.trim();
    var valid   = true;

    if (!rawAmt || isNaN(rawAmt) || parseFloat(rawAmt) <= 0) {
      elAmt.classList.add('is-error'); valid = false;
    } else { elAmt.classList.remove('is-error'); }

    if (!cat) {
      elCat.classList.add('is-error'); valid = false;
    } else { elCat.classList.remove('is-error'); }

    if (!payment) {
      elPayment.classList.add('is-error'); valid = false;
    } else { elPayment.classList.remove('is-error'); }

    if (!valid) { showError('Amount, category and payment method are required.'); return; }

    var dateStr = new Date(viewYear, viewMonth, today.getDate()).toISOString();
    var entry = {
      id: null,
      amount: parseFloat(parseFloat(rawAmt).toFixed(2)),
      category: cat,
      payment: payment,
      notes: notes,
      date: dateStr,
    };

    elAddBtn.disabled = true;
    elAddBtn.textContent = 'Saving...';

    sbInsert(entry)
      .then(function (newId) {
        entry.id = newId;
        expenses.unshift(entry);
        saveLocal();
        populateYears();
        resetForm();
        renderTracker();
      })
      .catch(function (err) {
        console.warn('Supabase insert failed, saving locally:', err);
        entry.id = Date.now();
        expenses.unshift(entry);
        saveLocal();
        populateYears();
        resetForm();
        renderTracker();
      })
      .then(function () {
        elAddBtn.disabled = false;
        elAddBtn.textContent = 'Add Expense';
      });
  }

  function resetForm() {
    elAmt.value = ''; elCat.value = ''; elPayment.value = ''; elNotes.value = '';
    elAmt.focus();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  function deleteExpense(id) {
    if (!confirm('Remove this entry?')) return;
    sbDelete(id)
      .catch(function (err) { console.warn('Supabase delete failed:', err); });
    expenses = expenses.filter(function (e) { return e.id !== id; });
    saveLocal();
    renderTracker();
  }

  // ─── Edit Modal ───────────────────────────────────────────────────────────────

  function openEditModal(id) {
    var entry = expenses.find(function (e) { return e.id === id; });
    if (!entry) return;
    elModalId.value      = id;
    elModalAmt.value     = entry.amount;
    elModalCat.value     = entry.category;
    elModalPayment.value = entry.payment || '';
    elModalNotes.value   = entry.notes || '';
    elModalError.hidden  = true;
    elModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    elModalAmt.focus();
  }

  function closeEditModal() {
    elModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function saveEdit() {
    var id      = Number(elModalId.value);
    var rawAmt  = elModalAmt.value.trim();
    var cat     = elModalCat.value;
    var payment = elModalPayment.value;
    var notes   = elModalNotes.value.trim();
    var valid   = true;

    if (!rawAmt || isNaN(rawAmt) || parseFloat(rawAmt) <= 0) {
      elModalAmt.classList.add('is-error'); valid = false;
    } else { elModalAmt.classList.remove('is-error'); }

    if (!cat) {
      elModalCat.classList.add('is-error'); valid = false;
    } else { elModalCat.classList.remove('is-error'); }

    if (!valid) {
      elModalError.textContent = 'Amount and category are required.';
      elModalError.hidden = false;
      return;
    }

    var fields = {
      amount: parseFloat(parseFloat(rawAmt).toFixed(2)),
      category: cat,
      payment: payment,
      notes: notes,
    };

    elModalSave.disabled = true;
    elModalSave.textContent = 'Saving...';

    sbUpdate(id, fields)
      .catch(function (err) { console.warn('Supabase update failed:', err); });

    var idx = expenses.findIndex(function (e) { return e.id === id; });
    if (idx !== -1) {
      expenses[idx] = Object.assign({}, expenses[idx], fields);
      saveLocal();
    }

    closeEditModal();
    renderTracker();
    elModalSave.disabled = false;
    elModalSave.textContent = 'Save Changes';
  }

  // ─── Error helpers ────────────────────────────────────────────────────────────

  function showError(msg) { elFormError.textContent = msg; elFormError.hidden = false; }
  function clearError()   { elFormError.textContent = ''; elFormError.hidden = true; }

  // ─── Render: Tracker ──────────────────────────────────────────────────────────

  function renderTracker() {
    elMonthLabel.textContent = MONTHS[viewMonth] + ' ' + viewYear;

    var monthly = monthlyExpenses(viewYear, viewMonth);
    var total   = monthly.reduce(function (s, e) { return s + e.amount; }, 0);
    var sorted  = catTotals(monthly);

    elTotalSpent.textContent = formatPeso(total);
    elEntryCount.textContent = monthly.length;
    elTopCat.textContent     = sorted.length ? sorted[0][0].split('/')[0].trim() : '~';

    if (sorted.length) {
      elChartSection.hidden = false;
      buildCatChart(elCatChart, sorted);
    } else {
      elChartSection.hidden = true;
      elCatChart.innerHTML  = '';
    }

    if (!monthly.length) {
      elExpenseList.innerHTML = '<p class="expense-list__empty">No expenses logged yet.</p>';
      return;
    }

    var byDate = monthly.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    elExpenseList.innerHTML = byDate.map(function (e) {
      return '<article class="expense-item" data-id="' + e.id + '">' +
        '<div class="expense-item__icon" aria-hidden="true">' + (CAT_EMOJI[e.category] || '•') + '</div>' +
        '<div class="expense-item__body">' +
          '<div class="expense-item__cat">' + escHtml(e.category) + '</div>' +
          (e.payment ? '<div class="expense-item__payment">' + escHtml(e.payment) + '</div>' : '') +
          (e.notes   ? '<div class="expense-item__note">'    + escHtml(e.notes)   + '</div>' : '') +
          '<div class="expense-item__date">'  + formatDate(e.date) + '</div>' +
        '</div>' +
        '<div class="expense-item__right">' +
          '<span class="expense-item__amount">' + formatPeso(e.amount) + '</span>' +
          '<div class="expense-item__actions">' +
            '<button class="expense-item__edit"   data-id="' + e.id + '" aria-label="Edit expense">&#9998;</button>' +
            '<button class="expense-item__delete" data-id="' + e.id + '" aria-label="Delete expense">&#x2715;</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // ─── Render: Dashboard ────────────────────────────────────────────────────────

  function renderDashboard() {
    var m    = parseInt(elDashMonth.value, 10);
    var y    = parseInt(elDashYear.value, 10);
    var list = monthlyExpenses(y, m);
    var total  = list.reduce(function (s, e) { return s + e.amount; }, 0);
    var avg    = list.length ? total / list.length : 0;
    var sorted = catTotals(list);

    elDashTotal.textContent = formatPeso(total);
    elDashCount.textContent = list.length;
    elDashAvg.textContent   = list.length ? formatPeso(avg) : '~';

    if (sorted.length) {
      elDashChartSec.hidden = false;
      buildCatChart(elDashCatChart, sorted);
    } else {
      elDashChartSec.hidden = true;
      elDashCatChart.innerHTML = '';
    }

    if (!list.length) {
      elDashTbody.innerHTML = '';
      elDashEmpty.hidden    = false;
      elDashTfoot.hidden    = true;
      return;
    }

    elDashEmpty.hidden = true;
    elDashTfoot.hidden = false;
    elDashTfootTotal.textContent = formatPeso(total);

    var byDate = list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    elDashTbody.innerHTML = byDate.map(function (e) {
      return '<tr>' +
        '<td class="dash-table__date">' + formatDate(e.date) + '</td>' +
        '<td>' + escHtml(e.category) + '</td>' +
        '<td>' + escHtml(e.payment || '~') + '</td>' +
        '<td class="dash-table__note">' + escHtml(e.notes || '~') + '</td>' +
        '<td class="dash-table__num">' + formatPeso(e.amount) + '</td>' +
      '</tr>';
    }).join('');
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  elTabTracker.addEventListener('click',   function () { showTab('tracker'); });
  elTabDashboard.addEventListener('click', function () { showTab('dashboard'); });

  elPrevMonth.addEventListener('click', function () {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderTracker();
  });
  elNextMonth.addEventListener('click', function () {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderTracker();
  });

  elAddBtn.addEventListener('click', addExpense);
  elAmt.addEventListener('keydown', function (e) { if (e.key === 'Enter') elCat.focus(); });
  elAmt.addEventListener('input',    function () { elAmt.classList.remove('is-error'); });
  elCat.addEventListener('change',   function () { elCat.classList.remove('is-error'); });
  elPayment.addEventListener('change', function () { elPayment.classList.remove('is-error'); });

  elCancelEdit.addEventListener('click', function () {
    elCancelEdit.hidden = true;
    elFormTitle.textContent = 'Add Expense';
    elAddBtn.textContent    = 'Add Expense';
    resetForm();
  });

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
  elModalOverlay.addEventListener('click', function (e) {
    if (e.target === elModalOverlay) closeEditModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !elModalOverlay.hidden) closeEditModal();
  });

  elDashMonth.addEventListener('change', renderDashboard);
  elDashYear.addEventListener('change',  renderDashboard);

  // ─── Init ─────────────────────────────────────────────────────────────────────

  elDashMonth.value = today.getMonth();
  populateYears();
  renderTracker();
  syncFromSupabase(); // async ~ updates UI when complete

})();
