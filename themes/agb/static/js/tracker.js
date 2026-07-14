/* ─── AGB Money Tracker ─────────────────────────────────────────────────────
   Anna's personal expense ledger. All data in localStorage.
   Key: agb_expenses  → { "YYYY-MM": [ {id, date, category, amount, notes} ] }
   Key: agb_settings  → { "YYYY-MM": { budget, note } }
──────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const STORAGE_KEY   = 'agb_expenses';
  const SETTINGS_KEY  = 'agb_settings';
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  // ── State ──────────────────────────────────────────────────────────────────
  let currentDate = new Date();
  let currentYear  = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth(); // 0-based
  let editingId    = null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function monthKey(y, m) {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  }

  function saveSettings(data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  }

  function getCurrentEntries() {
    const all = loadAll();
    return all[monthKey(currentYear, currentMonth)] || [];
  }

  function saveCurrentEntries(entries) {
    const all = loadAll();
    all[monthKey(currentYear, currentMonth)] = entries;
    saveAll(all);
  }

  function fmt(num) {
    return '₱' + Number(num).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtShort(num) {
    if (num >= 1000) return '₱' + (num / 1000).toFixed(1) + 'k';
    return fmt(num);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function formatDateDisplay(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[+m - 1].slice(0, 3)} ${y}`;
  }

  // ── Category color helper ──────────────────────────────────────────────────
  const CAT_COLORS = {
    'Health':             '#8B7355',
    'Beauty':             '#A0627A',
    'Food / Groceries':   '#B8860B',
    'Vacation / Eating Out': '#6B8E6B',
    'House':              '#7B6B4A',
    'Self Improvement':   '#7A6BAD',
    'Gadgets':            '#5B7B8E',
    'Clothing':           '#C4869A',
    'Transportation':     '#6B7B5A',
    'Gifts':              '#AD6B7A',
    'Government Savings': '#6B7BAD',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const entries = getCurrentEntries();
    const key = monthKey(currentYear, currentMonth);

    // Month label
    document.getElementById('month-label').textContent =
      `${MONTHS[currentMonth]} ${currentYear}`;

    // Summaries
    const total   = entries.reduce((s, e) => s + +e.amount, 0);
    const count   = entries.length;
    const avg     = count ? total / count : 0;
    const biggest = count ? Math.max(...entries.map(e => +e.amount)) : 0;

    document.getElementById('sum-total').textContent   = fmt(total);
    document.getElementById('sum-entries').textContent = count;
    document.getElementById('sum-avg').textContent     = fmt(avg);
    document.getElementById('sum-biggest').textContent = fmt(biggest);
    document.getElementById('foot-total').textContent  = fmt(total);

    // Hero stats
    const topCatEntry = (() => {
      if (!count) return '—';
      const tally = {};
      entries.forEach(e => { tally[e.category] = (tally[e.category] || 0) + +e.amount; });
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0].split(' ')[0];
    })();
    document.getElementById('hero-total').textContent    = fmtShort(total);
    document.getElementById('hero-entries').textContent  = count;
    document.getElementById('hero-top-cat').textContent  = topCatEntry;

    // Table body
    const tbody = document.getElementById('expense-tbody');
    const empty = document.getElementById('empty-state');
    const table = document.getElementById('expense-table');

    if (!count) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      table.style.display = 'none';
    } else {
      empty.style.display = 'none';
      table.style.display = '';

      // Sort by date descending
      const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

      tbody.innerHTML = sorted.map(e => `
        <tr data-id="${e.id}">
          <td class="--date">${formatDateDisplay(e.date)}</td>
          <td><span class="cat-badge" data-cat="${e.category}">${e.category}</span></td>
          <td class="--right">${fmt(e.amount)}</td>
          <td class="--notes">${e.notes ? escHtml(e.notes) : '<span style="opacity:0.35">—</span>'}</td>
          <td class="--actions">
            <button class="btn-edit" data-id="${e.id}" title="Edit">✎</button>
            <button class="btn-delete" data-id="${e.id}" title="Delete">✕</button>
          </td>
        </tr>
      `).join('');
    }

    // Category breakdown
    renderBreakdown(entries);


  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderBreakdown(entries) {
    const container = document.getElementById('cat-bars');
    if (!entries.length) {
      container.innerHTML = '<p style="color: var(--fog); font-size: 0.85rem;">No data yet for this month.</p>';
      return;
    }

    const total = entries.reduce((s, e) => s + +e.amount, 0);
    const tally = {};
    entries.forEach(e => {
      tally[e.category] = (tally[e.category] || 0) + +e.amount;
    });

    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);

    container.innerHTML = sorted.map(([cat, amount]) => {
      const pct = total ? (amount / total * 100).toFixed(1) : 0;
      const color = CAT_COLORS[cat] || '#7B2D42';
      return `
        <div class="cat-bar">
          <span class="cat-bar__name">${cat}</span>
          <div class="cat-bar__track">
            <div class="cat-bar__fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
          <span class="cat-bar__value">${fmt(amount)}</span>
        </div>
      `;
    }).join('');
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function openModal(id) {
    editingId = id || null;
    const overlay = document.getElementById('modal-overlay');
    const title   = document.getElementById('modal-title');

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];

    if (editingId) {
      const entries = getCurrentEntries();
      const e = entries.find(x => x.id === editingId);
      if (e) {
        document.getElementById('f-amount').value   = e.amount;
        document.getElementById('f-category').value = e.category;
        document.getElementById('f-date').value     = e.date;
        document.getElementById('f-notes').value    = e.notes || '';
      }
      title.innerHTML = 'Edit <span>Expense</span>';
    } else {
      document.getElementById('f-amount').value   = '';
      document.getElementById('f-category').value = '';
      document.getElementById('f-date').value     = today;
      document.getElementById('f-notes').value    = '';
      title.innerHTML = 'New <span>Expense</span>';
    }

    overlay.classList.add('--open');
    document.getElementById('f-amount').focus();
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('--open');
    editingId = null;
  }

  function saveExpense() {
    const amount   = parseFloat(document.getElementById('f-amount').value);
    const category = document.getElementById('f-category').value;
    const date     = document.getElementById('f-date').value;
    const notes    = document.getElementById('f-notes').value.trim();

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount.');
      document.getElementById('f-amount').focus();
      return;
    }
    if (!category) {
      alert('Please choose a category.');
      document.getElementById('f-category').focus();
      return;
    }
    if (!date) {
      alert('Please select a date.');
      document.getElementById('f-date').focus();
      return;
    }

    let entries = getCurrentEntries();

    if (editingId) {
      const idx = entries.findIndex(e => e.id === editingId);
      if (idx !== -1) {
        entries[idx] = { ...entries[idx], amount, category, date, notes };
      }
    } else {
      entries.push({ id: uid(), amount, category, date, notes });
    }

    saveCurrentEntries(entries);
    closeModal();
    render();
  }

  function deleteExpense(id) {
    if (!confirm('Remove this expense?')) return;
    let entries = getCurrentEntries().filter(e => e.id !== id);
    saveCurrentEntries(entries);
    render();
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; }
    else currentMonth--;
    render();
  }

  function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; }
    else currentMonth++;
    render();
  }

  // ── Event delegation for table buttons ────────────────────────────────────
  document.getElementById('expense-tbody').addEventListener('click', function (e) {
    const editBtn   = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');
    if (editBtn)   openModal(editBtn.dataset.id);
    if (deleteBtn) deleteExpense(deleteBtn.dataset.id);
  });

  // ── Wire up controls ───────────────────────────────────────────────────────
  document.getElementById('btn-add-expense').addEventListener('click', () => openModal());
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-save-expense').addEventListener('click', saveExpense);
  document.getElementById('prev-month').addEventListener('click', prevMonth);
  document.getElementById('next-month').addEventListener('click', nextMonth);

  // Close modal on overlay click
  document.getElementById('modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Keyboard: Escape closes modal, Enter in modal saves
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('--open')) {
      if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveExpense();
      }
    }
  });

  // ── Seed demo data (only on first load) ───────────────────────────────────
  function seedDemo() {
    const existing = loadAll();
    const key = monthKey(currentYear, currentMonth);
    if (existing[key] && existing[key].length) return; // already have data

    const demos = [
      { id: uid(), date: toIso(1),  category: 'Food / Groceries',  amount: 2340.50, notes: 'SM supermarket weekly haul' },
      { id: uid(), date: toIso(3),  category: 'Beauty',            amount: 1850.00, notes: 'Hair treatment + new lipstick' },
      { id: uid(), date: toIso(5),  category: 'Transportation',    amount: 480.00,  notes: 'Grab rides this week' },
      { id: uid(), date: toIso(7),  category: 'Vacation / Eating Out', amount: 3200.00, notes: 'Dinner at Gallery & drinks' },
      { id: uid(), date: toIso(9),  category: 'Health',            amount: 1200.00, notes: 'Vitamins + pharmacy' },
      { id: uid(), date: toIso(12), category: 'Clothing',          amount: 4500.00, notes: 'That dress I've been eyeing' },
      { id: uid(), date: toIso(14), category: 'Government Savings',amount: 5000.00, notes: 'Pag-IBIG contribution' },
    ];

    function toIso(day) {
      return `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    existing[key] = demos;
    saveAll(existing);
  }

  function toIso(day) {
    return `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  seedDemo();
  render();

})();
