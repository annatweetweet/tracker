/**
 * Anna's Money Tracker
 * AGB ~ tracker.js
 */

(function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────────────────────

  const STORAGE_KEY = 'agb_expenses';

  const MONTHS = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  const CAT_EMOJI = {
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

  // ─── State ─────────────────────────────────────────────────────────────────

  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();
  let expenses  = load();

  // ─── DOM refs ──────────────────────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);

  const elMonthLabel  = $('month-label');
  const elPrevMonth   = $('prev-month');
  const elNextMonth   = $('next-month');
  const elTotalSpent  = $('total-spent');
  const elEntryCount  = $('entry-count');
  const elTopCat      = $('top-cat');
  const elAmt         = $('amt');
  const elCat         = $('cat');
  const elNotes       = $('notes');
  const elAddBtn      = $('add-btn');
  const elFormError   = $('form-error');
  const elExpenseList = $('expense-list');
  const elChartSection = $('chart-section');
  const elCatChart    = $('cat-chart');

  // ─── Storage ───────────────────────────────────────────────────────────────

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch (e) {
      console.warn('Could not save expenses:', e);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function formatPeso(n) {
    return '₱' + Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function monthlyExpenses() {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }

  function showError(msg) {
    elFormError.textContent = msg;
    elFormError.hidden = false;
  }

  function clearError() {
    elFormError.textContent = '';
    elFormError.hidden = true;
  }

  // ─── Add Expense ───────────────────────────────────────────────────────────

  function addExpense() {
    clearError();

    const rawAmt = elAmt.value.trim();
    const cat    = elCat.value;
    const notes  = elNotes.value.trim();

    let valid = true;

    if (!rawAmt || isNaN(rawAmt) || parseFloat(rawAmt) <= 0) {
      elAmt.classList.add('is-error');
      valid = false;
    } else {
      elAmt.classList.remove('is-error');
    }

    if (!cat) {
      elCat.classList.add('is-error');
      valid = false;
    } else {
      elCat.classList.remove('is-error');
    }

    if (!valid) {
      showError('Amount and category are required.');
      return;
    }

    const entry = {
      id: Date.now(),
      amount: parseFloat(parseFloat(rawAmt).toFixed(2)),
      category: cat,
      notes: notes,
      date: new Date(viewYear, viewMonth, today.getDate()).toISOString(),
    };

    expenses.push(entry);
    save();

    // reset form
    elAmt.value   = '';
    elCat.value   = '';
    elNotes.value = '';
    elAmt.focus();

    render();
  }

  // ─── Delete Expense ────────────────────────────────────────────────────────

  function deleteExpense(id) {
    expenses = expenses.filter((e) => e.id !== id);
    save();
    render();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  function render() {
    // Month label
    elMonthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

    const monthly = monthlyExpenses();
    const total   = monthly.reduce((s, e) => s + e.amount, 0);

    // Summary
    elTotalSpent.textContent = formatPeso(total);
    elEntryCount.textContent = monthly.length;

    // Category totals
    const catTotals = {};
    monthly.forEach((e) => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    elTopCat.textContent = sortedCats.length
      ? sortedCats[0][0].split('/')[0].trim()
      : '~';

    // Category chart
    if (sortedCats.length > 0) {
      elChartSection.hidden = false;
      const max = sortedCats[0][1];
      const fills = ['', '--alt', '--faint'];

      elCatChart.innerHTML = sortedCats
        .map(([cat, val], i) => {
          const pct = ((val / max) * 100).toFixed(1);
          const mod = fills[i % fills.length];
          const shortLabel = cat.split('/')[0].trim();
          return `
            <div class="cat-chart__row">
              <span class="cat-chart__label" title="${cat}">${CAT_EMOJI[cat] || ''} ${shortLabel}</span>
              <div class="cat-chart__track" role="presentation">
                <div class="cat-chart__fill${mod ? ' cat-chart__fill' + mod : ''}" style="width: ${pct}%"></div>
              </div>
              <span class="cat-chart__value">${formatPeso(val)}</span>
            </div>
          `;
        })
        .join('');
    } else {
      elChartSection.hidden = true;
      elCatChart.innerHTML = '';
    }

    // Expense list
    if (monthly.length === 0) {
      elExpenseList.innerHTML = '<p class="expense-list__empty">No expenses logged yet.</p>';
      return;
    }

    const sorted = [...monthly].sort((a, b) => new Date(b.date) - new Date(a.date));

    elExpenseList.innerHTML = sorted
      .map((e) => {
        const emoji = CAT_EMOJI[e.category] || '•';
        return `
          <article class="expense-item" data-id="${e.id}">
            <div class="expense-item__icon" aria-hidden="true">${emoji}</div>
            <div class="expense-item__body">
              <div class="expense-item__cat">${e.category}</div>
              ${e.notes ? `<div class="expense-item__note">${escHtml(e.notes)}</div>` : ''}
              <div class="expense-item__date">${formatDate(e.date)}</div>
            </div>
            <div class="expense-item__right">
              <span class="expense-item__amount">${formatPeso(e.amount)}</span>
              <button
                class="expense-item__delete"
                data-id="${e.id}"
                aria-label="Delete ${e.category} expense of ${formatPeso(e.amount)}"
              >&#x2715;</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Event Listeners ───────────────────────────────────────────────────────

  elPrevMonth.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  });

  elNextMonth.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  });

  elAddBtn.addEventListener('click', addExpense);

  elAmt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elCat.focus();
  });

  // delegated delete
  elExpenseList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn && btn.classList.contains('expense-item__delete')) {
      deleteExpense(Number(btn.dataset.id));
    }
  });

  // clear field errors on change
  elAmt.addEventListener('input', () => elAmt.classList.remove('is-error'));
  elCat.addEventListener('change', () => elCat.classList.remove('is-error'));

  // ─── Init ──────────────────────────────────────────────────────────────────

  render();

})();
