/**
 * Anna's Money Tracker ~ AGB
 * Features: Supabase sync, budgets, trend chart, recurring, installment, insights, CSV, bulk delete
 */
(function () {
  'use strict';

  // ─── Supabase ────────────────────────────────────────────────────────────────

  var SB_URL = 'https://vvqjrysccdondikgrsey.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cWpyeXNjY2RvbmRpa2dyc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTQ5ODQsImV4cCI6MjA5ODk5MDk4NH0.LBkBp7TbcUEgcJtZCF6_VD0stCV9ZjFJMhZzZlDUaic';
  var TABLE = 'expenses';

  var CLIENT_ID = (function () {
    var k = 'agb_client_id', id = localStorage.getItem(k);
    if (!id) { id = 'agb_' + Date.now() + '_' + Math.random().toString(36).slice(2,9); localStorage.setItem(k, id); }
    return id;
  })();

  function sbH() { return { 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Prefer':'return=representation' }; }
  function sbU(p) { return SB_URL+'/rest/v1/'+p; }

  function sbFetch() {
    return fetch(sbU(TABLE+'?client_id=eq.'+encodeURIComponent(CLIENT_ID)+'&order=expense_date.desc'), { headers: sbH() })
      .then(function(r){ return r.json(); })
      .then(function(rows){ return rows.map(sbRow); });
  }
  function sbRow(r) {
    return { id:r.id, amount:parseFloat(r.amount), category:r.category, payment:r.payment||'', notes:r.notes||'', date:r.expense_date+'T00:00:00', isRecurring:!!r.is_recurring, isInstallment:!!r.is_installment, installmentMonths:r.installment_months||null, installmentCurrent:r.installment_current||null };
  }
  function sbInsert(e) {
    return fetch(sbU(TABLE), { method:'POST', headers:sbH(), body:JSON.stringify({ client_id:CLIENT_ID, amount:e.amount, category:e.category, payment:e.payment||null, notes:e.notes||null, expense_date:e.date.slice(0,10), is_recurring:!!e.isRecurring, is_installment:!!e.isInstallment, installment_months:e.installmentMonths||null, installment_current:e.installmentCurrent||null }) })
      .then(function(r){ return r.json(); })
      .then(function(rows){ if(!Array.isArray(rows)||!rows[0]) throw new Error('Insert failed'); return rows[0].id; });
  }
  function sbUpdate(id, f) {
    return fetch(sbU(TABLE+'?id=eq.'+id+'&client_id=eq.'+encodeURIComponent(CLIENT_ID)), { method:'PATCH', headers:sbH(), body:JSON.stringify({ amount:f.amount, category:f.category, payment:f.payment||null, notes:f.notes||null, is_recurring:!!f.isRecurring, is_installment:!!f.isInstallment, installment_months:f.installmentMonths||null, installment_current:f.installmentCurrent||null }) })
      .then(function(r){ if(!r.ok) throw new Error('Update failed'); });
  }
  function sbDelete(id) {
    return fetch(sbU(TABLE+'?id=eq.'+id+'&client_id=eq.'+encodeURIComponent(CLIENT_ID)), { method:'DELETE', headers:Object.assign({},sbH(),{Prefer:''}) })
      .then(function(r){ if(!r.ok) throw new Error('Delete failed'); });
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  var AUTH_KEY = 'agb_auth';

  // ─── Constants ───────────────────────────────────────────────────────────────

  var STORAGE_KEY   = 'agb_expenses';
  var BUDGETS_KEY   = 'agb_budgets';
  var ANNUAL_KEY    = 'agb_annual_budgets';
  var CARRYOVER_KEY = 'agb_carryover_dismissed';

  var MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var CATEGORIES   = ['Health','Beauty','Food / Groceries','Vacation / Relaxation / Eating Out','House','Self Improvement','Gadgets','Clothing','Transportation','Gifts','Government Savings'];
  var CAT_EMOJI    = {'Health':'🩺','Beauty':'💄','Food / Groceries':'🛒','Vacation / Relaxation / Eating Out':'🌴','House':'🏠','Self Improvement':'📚','Gadgets':'💻','Clothing':'👗','Transportation':'🚗','Gifts':'🎁','Government Savings':'🏛️'};

  var CHART_COLORS = ['#7A9E80','#C49460','#C47A6E','#4E6B54','#D4AE7A','#D49C94','#94B49A','#9E5A52','#B4D0BA','#5C5852','#A09C96'];

  // ─── State ───────────────────────────────────────────────────────────────────

  var today         = new Date();
  var viewYear      = today.getFullYear();
  var viewMonth     = today.getMonth();
  var expenses      = loadLocal();
  var budgets       = loadBudgets();
  var annualBudgets = loadAnnual();
  var selectMode    = false;
  var selectedIds   = {};

  // ─── DOM ─────────────────────────────────────────────────────────────────────

  var $ = function(id){ return document.getElementById(id); };

  var elTabTracker = $('tab-tracker'), elTabDashboard = $('tab-dashboard');
  var elViewTracker = $('view-tracker'), elViewDash = $('view-dashboard');
  var elMonthLabel = $('month-label'), elMonthName = $('month-name'), elMonthYear = $('month-year');
  var elPrevMonth = $('prev-month'), elNextMonth = $('next-month');
  var elTotalSpent = $('total-spent'), elBudgetLeft = $('budget-left'), elBudgetLeftLabel = $('budget-left-label'), elTopCat = $('top-cat');
  var elAmt = $('amt'), elCat = $('cat'), elPayment = $('payment'), elNotes = $('notes');
  var elCatPills = $('cat-pills');
  var elIsRecurring = $('is-recurring'), elIsInstallment = $('is-installment');
  var elInstallmentMonthsRow = $('installment-months-row'), elInstallmentMonths = $('installment-months');
  var elAddBtn = $('add-btn'), elFormError = $('form-error'), elCancelEdit = $('cancel-edit-btn'), elFormTitle = $('form-title');
  var elInsightsPanel = $('insights-panel'), elInsightsInner = $('insights-inner');
  var elCarryoverBar = $('carryover-bar'), elCarryoverList = $('carryover-list');
  var elCarryoverConfirmAll = $('carryover-confirm-all'), elCarryoverDismiss = $('carryover-dismiss');
  var elBudgetBtn = $('budget-btn'), elBudgetSection = $('budget-section'), elBudgetList = $('budget-list');
  var elChartSection = $('chart-section'), elCatChart = $('cat-chart'), elExpenseList = $('expense-list');
  var elSelectBtn = $('select-btn'), elBulkBar = $('bulk-bar'), elBulkCount = $('bulk-count');
  var elBulkDeleteBtn = $('bulk-delete-btn'), elBulkCancelBtn = $('bulk-cancel-btn'), elSelectAllCheck = $('select-all-check');
  var elModalOverlay = $('modal-overlay'), elModalClose = $('modal-close'), elModalCancel = $('modal-cancel'), elModalSave = $('modal-save');
  var elModalId = $('modal-id'), elModalAmt = $('modal-amt'), elModalCat = $('modal-cat'), elModalPayment = $('modal-payment'), elModalNotes = $('modal-notes');
  var elModalRecurring = $('modal-recurring'), elModalInstallment = $('modal-installment');
  var elModalInstallmentMonthsRow = $('modal-installment-months-row'), elModalInstallmentMonths = $('modal-installment-months');
  var elModalError = $('modal-error');
  var elBudgetModalOverlay = $('budget-modal-overlay'), elBudgetModalClose = $('budget-modal-close'), elBudgetModalCancel = $('budget-modal-cancel'), elBudgetModalSave = $('budget-modal-save'), elBudgetInputs = $('budget-inputs');
  var elAnnualBudgetBtn = $('annual-budget-btn'), elAnnualBudgetContent = $('annual-budget-content');
  var elAnnualBudgetModalOverlay = $('annual-budget-modal-overlay'), elAnnualBudgetModalClose = $('annual-budget-modal-close');
  var elAnnualBudgetModalCancel = $('annual-budget-modal-cancel'), elAnnualBudgetModalSave = $('annual-budget-modal-save');
  var elAnnualBudgetInputs = $('annual-budget-inputs');
  var elDashMonth = $('dash-month'), elDashYear = $('dash-year');
  var elDashTotal = $('dash-total'), elDashCount = $('dash-count'), elDashAvg = $('dash-avg');
  var elDashChartSec = $('dash-chart-section'), elDashCatChart = $('dash-cat-chart');
  var elDashTbody = $('dash-tbody'), elDashEmpty = $('dash-empty'), elDashTfoot = $('dash-tfoot'), elDashTfootTotal = $('dash-tfoot-total');
  var elTrendChart = $('trend-chart'), elCsvExportBtn = $('csv-export-btn'), elDashGoTracker = $('dash-go-tracker');

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function loadLocal()   { try { var p=JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(p)?p:[]; } catch(e){ return []; } }
  function saveLocal()   { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses)); } catch(e){} }
  function loadBudgets() { try { return JSON.parse(localStorage.getItem(BUDGETS_KEY))||{}; } catch(e){ return {}; } }
  function saveBudgets() { try { localStorage.setItem(BUDGETS_KEY,JSON.stringify(budgets)); } catch(e){} }
  function loadAnnual()  { try { return JSON.parse(localStorage.getItem(ANNUAL_KEY))||{}; } catch(e){ return {}; } }
  function saveAnnual()  { try { localStorage.setItem(ANNUAL_KEY,JSON.stringify(annualBudgets)); } catch(e){} }

  // ─── Sync ────────────────────────────────────────────────────────────────────

  function syncFromSupabase() {
    setStatus('syncing');
    return sbFetch()
      .then(function(rows){ expenses=rows; saveLocal(); setStatus('online'); populateYears(); renderTracker(); })
      .catch(function(){ setStatus('offline'); });
  }
  function setStatus(s) {
    var el=$('sync-status'); if(!el) return;
    el.textContent={syncing:'Syncing...',online:'Synced',offline:'Offline'}[s]||'';
    el.className='sync-status sync-status--'+s;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function peso(n){ return '₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fmtDate(iso){ var d=new Date(iso); return MONTHS_SHORT[d.getMonth()]+' '+d.getDate(); }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function monthlyExp(y,m){ return expenses.filter(function(e){ var d=new Date(e.date); return d.getFullYear()===y&&d.getMonth()===m; }); }
  function catTotals(list){ var t={}; list.forEach(function(e){ t[e.category]=(t[e.category]||0)+e.amount; }); return Object.entries(t).sort(function(a,b){return b[1]-a[1];}); }
  function totalBudget(){ return Object.values(budgets).reduce(function(s,v){return s+(parseFloat(v)||0);},0); }

  // ─── Donut chart ─────────────────────────────────────────────────────────────

  function buildDonutChart(container, sorted, total) {
    if (!sorted.length) { container.innerHTML = ''; return; }
    var R = 48, CX = 60, CY = 60, SW = 13;
    var circ = 2 * Math.PI * R;
    var segs = '', legend = '';
    var offset = circ / 4;

    sorted.forEach(function(pair, i) {
      var cat = pair[0], val = pair[1];
      var frac = val / total;
      var len = frac * circ;
      var gap = Math.min(1.5, len * 0.04);
      var drawLen = Math.max(0, len - gap);
      var color = CHART_COLORS[i % CHART_COLORS.length];
      var pct = (frac * 100).toFixed(0);

      segs += '<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none"'+
        ' stroke="'+esc(color)+'"'+
        ' stroke-width="'+SW+'"'+
        ' stroke-dasharray="'+drawLen.toFixed(2)+' '+(circ-drawLen).toFixed(2)+'"'+
        ' stroke-dashoffset="'+offset.toFixed(2)+'"'+
      '/>';
      offset -= len;

      legend += '<div class="donut-chart__legend-item">'+
        '<span class="donut-chart__legend-dot" style="background:'+esc(color)+'"></span>'+
        '<span class="donut-chart__legend-name" title="'+esc(cat)+'">'+esc(cat.split('/')[0].trim())+'</span>'+
        '<span class="donut-chart__legend-pct">'+pct+'%</span>'+
        '<span class="donut-chart__legend-val">'+peso(val)+'</span>'+
      '</div>';
    });

    container.innerHTML =
      '<div class="donut-chart__svg-wrap">'+
        '<svg class="donut-chart__svg" viewBox="0 0 120 120" aria-hidden="true">'+
          '<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="#DDD0BE" stroke-width="'+SW+'"/>'+
          segs+
          '<text x="'+CX+'" y="'+(CY-5)+'" text-anchor="middle"'+
            ' font-family="Albert Sans, sans-serif" font-size="5.5" font-weight="500"'+
            ' fill="#5E6A50" letter-spacing="1">TOTAL</text>'+
          '<text x="'+CX+'" y="'+(CY+7)+'" text-anchor="middle"'+
            ' font-family="Unbounded, sans-serif" font-size="6.5" font-weight="700"'+
            ' fill="#1C1409">'+peso(total)+'</text>'+
        '</svg>'+
      '</div>'+
      '<div class="donut-chart__legend">'+legend+'</div>';
  }

  // ─── Cat chart (dashboard only) ───────────────────────────────────────────────

  function buildCatChart(container, sorted) {
    if (!sorted.length) { container.innerHTML = ''; return; }
    var max = sorted[0][1], fills = ['','--alt','--faint'];
    container.innerHTML = sorted.map(function(pair, i) {
      var cat=pair[0], val=pair[1], pct=((val/max)*100).toFixed(1), mod=fills[i%fills.length];
      return '<div class="cat-chart__row">'+
        '<span class="cat-chart__label" title="'+esc(cat)+'">'+(CAT_EMOJI[cat]||'')+' '+esc(cat.split('/')[0].trim())+'</span>'+
        '<div class="cat-chart__track"><div class="cat-chart__fill'+(mod?' cat-chart__fill'+mod:'')+'" style="width:'+pct+'%"></div></div>'+
        '<span class="cat-chart__value">'+peso(val)+'</span></div>';
    }).join('');
  }

  // ─── Spending insights ────────────────────────────────────────────────────────

  function renderInsights(monthly) {
    var nowYear = today.getFullYear(), nowMonth = today.getMonth();
    if (viewYear > nowYear || (viewYear === nowYear && viewMonth > nowMonth)) {
      elInsightsPanel.hidden = true;
      return;
    }

    var prevMonth = viewMonth - 1, prevYear = viewYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
    var prev = monthlyExp(prevYear, prevMonth);

    var insights = [];
    var curTotal  = monthly.reduce(function(s,e){return s+e.amount;},0);
    var prevTotal = prev.reduce(function(s,e){return s+e.amount;},0);

    if (prevTotal > 0) {
      var diff = curTotal - prevTotal;
      var pct  = Math.abs(Math.round((diff / prevTotal) * 100));
      if (pct >= 5) {
        insights.push(diff > 0
          ? '📈 You spent '+pct+'% more this month compared to '+MONTHS_SHORT[prevMonth]+'.'
          : '📉 You spent '+pct+'% less this month compared to '+MONTHS_SHORT[prevMonth]+'. Nice work.');
      } else {
        insights.push('✓ Your spending this month is similar to '+MONTHS_SHORT[prevMonth]+'.');
      }
    }

    var curCats = {}, prevCats = {};
    monthly.forEach(function(e){ curCats[e.category]=(curCats[e.category]||0)+e.amount; });
    prev.forEach(function(e){ prevCats[e.category]=(prevCats[e.category]||0)+e.amount; });

    var biggestIncrease = null, biggestPct = 0;
    CATEGORIES.forEach(function(c) {
      var cur = curCats[c]||0, prv = prevCats[c]||0;
      if (prv > 0 && cur > 0) {
        var p = Math.round(((cur-prv)/prv)*100);
        if (p > biggestPct) { biggestPct = p; biggestIncrease = { cat: c, pct: p, amt: cur }; }
      }
    });
    if (biggestIncrease && biggestPct >= 20) {
      insights.push('⚠️ '+biggestIncrease.cat.split('/')[0].trim()+' spending jumped '+biggestPct+'% vs last month ('+peso(biggestIncrease.amt)+').');
    }

    var tb = totalBudget();
    if (tb > 0) {
      var left = tb - curTotal;
      if (left < 0) {
        insights.push('🚨 You\'re '+peso(Math.abs(left))+' over your monthly budget.');
      } else if (left < tb * 0.15) {
        insights.push('⚡ Only '+peso(left)+' left in your monthly budget ~ spend carefully.');
      }
    }

    var recurCount = monthly.filter(function(e){ return e.isRecurring; }).length;
    if (recurCount > 0) {
      insights.push('↻ '+recurCount+' recurring expense'+(recurCount>1?'s':'')+' logged this month.');
    }

    var instCount = monthly.filter(function(e){ return e.isInstallment; }).length;
    if (instCount > 0) {
      insights.push('📅 '+instCount+' installment payment'+(instCount>1?'s':'')+' logged this month.');
    }

    if (!insights.length) { elInsightsPanel.hidden = true; return; }

    elInsightsInner.innerHTML = insights.map(function(txt){
      return '<p class="insights-panel__item">'+esc(txt)+'</p>';
    }).join('');
    elInsightsPanel.hidden = false;
  }

  // ─── Sparkline ───────────────────────────────────────────────────────────────

  function buildSparkline(catName) {
    var data = [];
    for (var i = 5; i >= 0; i--) {
      var m = viewMonth - i, y = viewYear;
      if (m < 0) { m += 12; y -= 1; }
      var total = monthlyExp(y, m).filter(function(e){ return e.category === catName; })
        .reduce(function(s, e){ return s + e.amount; }, 0);
      data.push(total);
    }
    var max = Math.max.apply(null, data) || 1;
    var W = 54, H = 20, PAD = 2;
    var points = data.map(function(v, i) {
      var x = PAD + (i / 5) * (W - PAD * 2);
      var y = H - PAD - ((v / max) * (H - PAD * 2));
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var last = data[5], prev = data[4];
    var trend = last > prev * 1.1 ? 'sparkline--rising' : last < prev * 0.9 ? 'sparkline--falling' : 'sparkline--flat';
    return '<svg class="sparkline '+trend+'" viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'+
      '<polyline fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="'+points+'"/>'+
      '<circle cx="'+data.map(function(v,i){return (PAD+(i/5)*(W-PAD*2)).toFixed(1);}).slice(-1)[0]+'" cy="'+(H-PAD-((last/max)*(H-PAD*2))).toFixed(1)+'" r="2.2" fill="currentColor"/>'+
    '</svg>';
  }

  // ─── Budget progress ─────────────────────────────────────────────────────────

  function renderBudgetSection(monthly) {
    var hasBudget = Object.keys(budgets).some(function(k){ return parseFloat(budgets[k])>0; });
    elBudgetSection.hidden = false;
    if (!hasBudget) { elBudgetList.innerHTML='<p class="budget-list__empty">No budgets set yet. Use the button above to set monthly limits.</p>'; return; }
    var catSpend={};
    monthly.forEach(function(e){ catSpend[e.category]=(catSpend[e.category]||0)+e.amount; });
    elBudgetList.innerHTML = CATEGORIES.filter(function(c){ return parseFloat(budgets[c])>0; }).map(function(c){
      var budget=parseFloat(budgets[c])||0, spent=catSpend[c]||0;
      var pct=Math.min((spent/budget)*100,100).toFixed(1), over=spent>budget;
      var cls=over?'budget-bar__fill--over':pct>80?'budget-bar__fill--warn':'';
      return '<div class="budget-bar">'+
        '<div class="budget-bar__header">'+
          '<span class="budget-bar__cat">'+(CAT_EMOJI[c]||'')+' '+esc(c.split('/')[0].trim())+'</span>'+
          buildSparkline(c)+
          '<span class="budget-bar__amounts">'+peso(spent)+' <span class="budget-bar__of">of</span> '+peso(budget)+'</span>'+
        '</div>'+
        '<div class="budget-bar__track"><div class="budget-bar__fill '+cls+'" style="width:'+pct+'%"></div></div>'+
        (over?'<p class="budget-bar__warning">Over by '+peso(spent-budget)+'</p>':'')+
      '</div>';
    }).join('');
  }

  // ─── Recurring carry-over ────────────────────────────────────────────────────

  function checkCarryover() {
    var dismissedKey = CARRYOVER_KEY+'_'+viewYear+'_'+viewMonth;
    if (localStorage.getItem(dismissedKey)) { elCarryoverBar.hidden=true; return; }

    var currentEntries = monthlyExp(viewYear, viewMonth);
    if (currentEntries.length > 0) { elCarryoverBar.hidden=true; return; }

    var prevMonth=viewMonth-1, prevYear=viewYear;
    if (prevMonth<0){prevMonth=11;prevYear-=1;}
    var prevEntries = monthlyExp(prevYear, prevMonth);

    var suggestions = prevEntries.filter(function(e){
      if (e.isRecurring) return true;
      if (e.isInstallment && e.installmentMonths && e.installmentCurrent) {
        return e.installmentCurrent < e.installmentMonths;
      }
      return false;
    });

    if (!suggestions.length) { elCarryoverBar.hidden=true; return; }

    elCarryoverList.innerHTML = suggestions.map(function(e){
      var label = e.isInstallment
        ? esc(e.category)+' ~ Installment '+(e.installmentCurrent+1)+'/'+e.installmentMonths
        : esc(e.category);
      return '<label class="carryover-item">'+
        '<input type="checkbox" class="carryover-item__check" checked data-id="'+e.id+'">'+
        '<span class="carryover-item__info">'+
          '<span class="carryover-item__cat">'+(CAT_EMOJI[e.category]||'')+' '+label+'</span>'+
          '<span class="carryover-item__amt">'+peso(e.amount)+'</span>'+
        '</span>'+
      '</label>';
    }).join('');

    elCarryoverBar.hidden = false;
  }

  function confirmCarryover() {
    var checked = elCarryoverList.querySelectorAll('.carryover-item__check:checked');
    var prevMonth=viewMonth-1, prevYear=viewYear;
    if (prevMonth<0){prevMonth=11;prevYear-=1;}
    var prevEntries = monthlyExp(prevYear, prevMonth);
    var idMap = {};
    prevEntries.forEach(function(e){ idMap[e.id]=e; });

    var promises = [];
    checked.forEach(function(cb){
      var orig = idMap[Number(cb.dataset.id)];
      if (!orig) return;
      var newEntry = {
        id: null,
        amount: orig.amount,
        category: orig.category,
        payment: orig.payment,
        notes: orig.notes,
        date: new Date(viewYear, viewMonth, 1).toISOString(),
        isRecurring: orig.isRecurring,
        isInstallment: orig.isInstallment,
        installmentMonths: orig.installmentMonths,
        installmentCurrent: orig.isInstallment ? (orig.installmentCurrent||1)+1 : null,
      };
      promises.push(
        sbInsert(newEntry).then(function(id){ newEntry.id=id; }).catch(function(){ newEntry.id=Date.now()+Math.random(); })
          .then(function(){ expenses.unshift(newEntry); })
      );
    });

    Promise.all(promises).then(function(){
      saveLocal();
      dismissCarryover();
      renderTracker();
    });
  }

  function dismissCarryover() {
    var dismissedKey = CARRYOVER_KEY+'_'+viewYear+'_'+viewMonth;
    localStorage.setItem(dismissedKey, '1');
    elCarryoverBar.hidden = true;
  }

  // ─── Trend chart ─────────────────────────────────────────────────────────────

  function renderTrendChart(baseYear, baseMonth) {
    var months=[];
    for(var i=5;i>=0;i--){
      var m=baseMonth-i,y=baseYear;
      if(m<0){m+=12;y-=1;}
      var total=monthlyExp(y,m).reduce(function(s,e){return s+e.amount;},0);
      months.push({label:MONTHS_SHORT[m],total:total,isCurrent:(m===baseMonth&&y===baseYear)});
    }
    var max=Math.max.apply(null,months.map(function(x){return x.total;}))||1;
    elTrendChart.innerHTML='<div class="trend-chart__bars">'+
      months.map(function(m){
        var pct=((m.total/max)*100).toFixed(1);
        return '<div class="trend-chart__col">'+
          '<span class="trend-chart__val">'+(m.total>0?peso(m.total):'')+'</span>'+
          '<div class="trend-chart__bar-wrap"><div class="trend-chart__bar'+(m.isCurrent?' trend-chart__bar--current':'')+'" style="height:'+pct+'%"></div></div>'+
          '<span class="trend-chart__label">'+m.label+'</span></div>';
      }).join('')+
    '</div>';
  }

  // ─── Annual budget ────────────────────────────────────────────────────────────

  function renderAnnualBudget(year) {
    var key=String(year), ab=annualBudgets[key]||{};
    var hasBudget=Object.keys(ab).some(function(k){return parseFloat(ab[k])>0;});
    if(!hasBudget){elAnnualBudgetContent.innerHTML='<p class="budget-list__empty">No annual budget set for '+year+'. Use the button above to set yearly limits.</p>';return;}
    var yearExp=expenses.filter(function(e){return new Date(e.date).getFullYear()===year;});
    var catSpend={};
    yearExp.forEach(function(e){catSpend[e.category]=(catSpend[e.category]||0)+e.amount;});
    var totalBudgeted=0, totalSpent=0;
    var rows=CATEGORIES.filter(function(c){return parseFloat(ab[c])>0;}).map(function(c){
      var budget=parseFloat(ab[c])||0, spent=catSpend[c]||0;
      totalBudgeted+=budget; totalSpent+=spent;
      var pct=Math.min((spent/budget)*100,100).toFixed(1), over=spent>budget;
      var cls=over?'budget-bar__fill--over':pct>80?'budget-bar__fill--warn':'';
      return '<div class="budget-bar">'+
        '<div class="budget-bar__header"><span class="budget-bar__cat">'+(CAT_EMOJI[c]||'')+' '+esc(c.split('/')[0].trim())+'</span>'+
        '<span class="budget-bar__amounts">'+peso(spent)+' <span class="budget-bar__of">of</span> '+peso(budget)+'</span></div>'+
        '<div class="budget-bar__track"><div class="budget-bar__fill '+cls+'" style="width:'+pct+'%"></div></div>'+
        (over?'<p class="budget-bar__warning">Over by '+peso(spent-budget)+'</p>':'')+
      '</div>';
    }).join('');
    var op=Math.min((totalSpent/totalBudgeted)*100,100).toFixed(1), oo=totalSpent>totalBudgeted;
    var oc=oo?'budget-bar__fill--over':op>80?'budget-bar__fill--warn':'';
    elAnnualBudgetContent.innerHTML=rows+
      '<div class="budget-bar budget-bar--total">'+
        '<div class="budget-bar__header"><span class="budget-bar__cat">Total '+year+'</span>'+
        '<span class="budget-bar__amounts">'+peso(totalSpent)+' <span class="budget-bar__of">of</span> '+peso(totalBudgeted)+'</span></div>'+
        '<div class="budget-bar__track"><div class="budget-bar__fill '+oc+'" style="width:'+op+'%"></div></div>'+
        (oo?'<p class="budget-bar__warning">Over annual budget by '+peso(totalSpent-totalBudgeted)+'</p>':'')+
      '</div>';
  }

  function openAnnualBudgetModal(year) {
    var key=String(year), ab=annualBudgets[key]||{};
    var hint=$('annual-budget-modal-hint');
    if(hint) hint.textContent='Set spending limits per category for Jan 1 ~ Dec 31, '+year+'. Leave blank to skip a category.';
    elAnnualBudgetInputs.innerHTML=CATEGORIES.map(function(c){
      return '<div class="expense-form__row"><div class="expense-form__group expense-form__group--full">'+
        '<label class="expense-form__label" for="ab-'+esc(c)+'">'+(CAT_EMOJI[c]||'')+' '+esc(c)+'</label>'+
        '<input class="expense-form__input" type="number" id="ab-'+esc(c)+'" data-cat="'+esc(c)+'" placeholder="Annual budget..." min="0" step="1" value="'+esc(String(ab[c]||''))+'">'+
      '</div></div>';
    }).join('');
    elAnnualBudgetModalOverlay.hidden=false; document.body.style.overflow='hidden';
  }
  function closeAnnualBudgetModal(){ elAnnualBudgetModalOverlay.hidden=true; document.body.style.overflow=''; }
  function saveAnnualBudgetModal(year){
    var key=String(year), ab={};
    elAnnualBudgetInputs.querySelectorAll('input[data-cat]').forEach(function(inp){
      var val=parseFloat(inp.value); if(val>0) ab[inp.dataset.cat]=val;
    });
    annualBudgets[key]=ab; saveAnnual(); closeAnnualBudgetModal(); renderAnnualBudget(year);
  }

  // ─── CSV export ───────────────────────────────────────────────────────────────

  function exportCSV() {
    var m=parseInt(elDashMonth.value,10), y=parseInt(elDashYear.value,10);
    var list=monthlyExp(y,m);
    if(!list.length){alert('No entries to export for this period.');return;}
    var headers=['Date','Category','Payment','Notes','Amount','Recurring','Installment','Installment Month','Total Installments'];
    var rows=[headers].concat(list.slice().sort(function(a,b){return new Date(a.date)-new Date(b.date);}).map(function(e){
      return [e.date.slice(0,10),e.category,e.payment||'',e.notes||'',e.amount.toFixed(2),e.isRecurring?'Yes':'No',e.isInstallment?'Yes':'No',e.installmentCurrent||'',e.installmentMonths||''];
    }));
    var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='agb-expenses-'+MONTHS_SHORT[m]+'-'+y+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Year dropdown ────────────────────────────────────────────────────────────

  function populateYears() {
    var selected=elDashYear.value?parseInt(elDashYear.value,10):today.getFullYear();
    var yearSet={};
    expenses.forEach(function(e){yearSet[new Date(e.date).getFullYear()]=true;});
    yearSet[today.getFullYear()]=true;
    var years=Object.keys(yearSet).map(Number).sort(function(a,b){return b-a;});
    elDashYear.innerHTML=years.map(function(y){return '<option value="'+y+'">'+y+'</option>';}).join('');
    elDashYear.value=yearSet[selected]?selected:today.getFullYear();
  }

  // ─── Tab switching ────────────────────────────────────────────────────────────

  function showTab(tab) {
    elViewTracker.hidden=tab!=='tracker'; elViewDash.hidden=tab!=='dashboard';
    elTabTracker.classList.toggle('tracker__tab--active',tab==='tracker');
    elTabDashboard.classList.toggle('tracker__tab--active',tab==='dashboard');
    if(tab==='dashboard') renderDashboard();
  }

  // ─── Add expense ─────────────────────────────────────────────────────────────

  function addExpense() {
    clearError();
    var rawAmt=elAmt.value.trim(), notes=elNotes.value.trim();
    var activePill=elCatPills?elCatPills.querySelector('.quick-add__cat-pill--active'):null;
    var cat=activePill?activePill.dataset.cat:(elCat?elCat.value:'');
    var activePayBtn=document.querySelector('.quick-add__pay-btn--active');
    var payment=activePayBtn?activePayBtn.dataset.payment:(elPayment?elPayment.value:'Cash');
    var isRecurring=elIsRecurring.checked, isInstallment=elIsInstallment.checked;
    var installmentMonths=isInstallment?parseInt(elInstallmentMonths.value,10):null;
    var valid=true;

    if(!rawAmt||isNaN(rawAmt)||parseFloat(rawAmt)<=0){elAmt.classList.add('is-error');valid=false;}else{elAmt.classList.remove('is-error');}
    if(!cat){elCatPills.classList.add('is-error');valid=false;}else{elCatPills.classList.remove('is-error');}
    if(isInstallment&&(!installmentMonths||installmentMonths<2)){if(elInstallmentMonths)elInstallmentMonths.classList.add('is-error');valid=false;}else{if(elInstallmentMonths)elInstallmentMonths.classList.remove('is-error');}
    if(!valid){showError('Please choose a category and enter an amount.');return;}

    var monthlyAmt=isInstallment&&installmentMonths>0?parseFloat(rawAmt)/installmentMonths:parseFloat(rawAmt);
    var entry={id:null,amount:parseFloat(monthlyAmt.toFixed(2)),category:cat,payment:payment||'Cash',notes:notes,date:new Date(viewYear,viewMonth,today.getDate()).toISOString(),isRecurring:isRecurring,isInstallment:isInstallment,installmentMonths:isInstallment?installmentMonths:null,installmentCurrent:isInstallment?1:null};
    elAddBtn.disabled=true; elAddBtn.textContent='Adding...';
    sbInsert(entry).then(function(id){entry.id=id;}).catch(function(){entry.id=Date.now();})
      .then(function(){expenses.unshift(entry);saveLocal();populateYears();resetForm();renderTracker();elAddBtn.disabled=false;elAddBtn.textContent='Add';});
  }

  function resetForm(){
    elAmt.value=''; elCat.value=''; elPayment.value='Cash'; elNotes.value='';
    elIsRecurring.checked=false; elIsInstallment.checked=false;
    elInstallmentMonthsRow.hidden=true; if(elInstallmentMonths) elInstallmentMonths.value='';
    if(elCatPills){
      elCatPills.querySelectorAll('.quick-add__cat-pill').forEach(function(p){
        p.classList.remove('quick-add__cat-pill--active'); p.setAttribute('aria-selected','false');
      });
      elCatPills.classList.remove('is-error');
    }
    document.querySelectorAll('.quick-add__pay-btn').forEach(function(b){
      b.classList.toggle('quick-add__pay-btn--active', b.dataset.payment==='Cash');
    });
    elAmt.focus();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  function deleteExpense(id){
    if(!confirm('Remove this entry?')) return;
    sbDelete(id).catch(function(){});
    expenses=expenses.filter(function(e){return e.id!==id;});
    saveLocal(); renderTracker();
  }

  // ─── Bulk select ─────────────────────────────────────────────────────────────

  function enterSelectMode() {
    selectMode=true; selectedIds={};
    elBulkBar.hidden=true; elSelectBtn.textContent='Done';
    updateBulkBar(); renderTracker();
  }

  function exitSelectMode() {
    selectMode=false; selectedIds={};
    elBulkBar.hidden=true; elSelectBtn.textContent='Select';
    if(elSelectAllCheck) elSelectAllCheck.checked=false;
    renderTracker();
  }

  function updateBulkBar() {
    var count=Object.keys(selectedIds).length;
    if(elBulkCount) elBulkCount.textContent=count+' selected';
    elBulkBar.hidden=count===0;
  }

  function deleteSelected() {
    var ids=Object.keys(selectedIds).map(Number);
    if(!ids.length) return;
    if(!confirm('Delete '+ids.length+' expense'+(ids.length>1?'s':'')+'?')) return;
    ids.forEach(function(id){ sbDelete(id).catch(function(){}); });
    expenses=expenses.filter(function(e){return !selectedIds[e.id];});
    saveLocal();
    exitSelectMode();
  }

  // ─── Edit modal ───────────────────────────────────────────────────────────────

  function openEditModal(id){
    var e=expenses.find(function(x){return x.id===id;}); if(!e) return;
    elModalId.value=id; elModalAmt.value=e.amount; elModalCat.value=e.category;
    elModalPayment.value=e.payment||''; elModalNotes.value=e.notes||'';
    elModalRecurring.checked=!!e.isRecurring;
    elModalInstallment.checked=!!e.isInstallment;
    elModalInstallmentMonthsRow.hidden=!e.isInstallment;
    if(elModalInstallmentMonths) elModalInstallmentMonths.value=e.installmentMonths||'';
    elModalError.hidden=true; elModalOverlay.hidden=false; document.body.style.overflow='hidden'; elModalAmt.focus();
  }
  function closeEditModal(){elModalOverlay.hidden=true;document.body.style.overflow='';}
  function saveEdit(){
    var id=Number(elModalId.value),rawAmt=elModalAmt.value.trim(),cat=elModalCat.value,payment=elModalPayment.value,notes=elModalNotes.value.trim();
    var isRecurring=elModalRecurring.checked,isInstallment=elModalInstallment.checked;
    var installmentMonths=isInstallment?parseInt(elModalInstallmentMonths.value,10):null;
    var valid=true;
    if(!rawAmt||isNaN(rawAmt)||parseFloat(rawAmt)<=0){elModalAmt.classList.add('is-error');valid=false;}else{elModalAmt.classList.remove('is-error');}
    if(!cat){elModalCat.classList.add('is-error');valid=false;}else{elModalCat.classList.remove('is-error');}
    if(!valid){elModalError.textContent='Amount and category are required.';elModalError.hidden=false;return;}
    var fields={amount:parseFloat(parseFloat(rawAmt).toFixed(2)),category:cat,payment:payment,notes:notes,isRecurring:isRecurring,isInstallment:isInstallment,installmentMonths:isInstallment?installmentMonths:null};
    elModalSave.disabled=true; elModalSave.textContent='Saving...';
    sbUpdate(id,fields).catch(function(){});
    var idx=expenses.findIndex(function(e){return e.id===id;});
    if(idx!==-1){expenses[idx]=Object.assign({},expenses[idx],fields);saveLocal();}
    closeEditModal(); renderTracker(); elModalSave.disabled=false; elModalSave.textContent='Save Changes';
  }

  // ─── Budget modal ─────────────────────────────────────────────────────────────

  function openBudgetModal(){
    elBudgetInputs.innerHTML=CATEGORIES.map(function(c){
      return '<div class="expense-form__row"><div class="expense-form__group expense-form__group--full">'+
        '<label class="expense-form__label" for="budget-'+esc(c)+'">'+(CAT_EMOJI[c]||'')+' '+esc(c)+'</label>'+
        '<input class="expense-form__input" type="number" id="budget-'+esc(c)+'" data-cat="'+esc(c)+'" placeholder="Monthly budget..." min="0" step="1" value="'+esc(String(budgets[c]||''))+'">'+
      '</div></div>';
    }).join('');
    elBudgetModalOverlay.hidden=false; document.body.style.overflow='hidden';
  }
  function closeBudgetModal(){elBudgetModalOverlay.hidden=true;document.body.style.overflow='';}
  function saveBudgetModal(){
    elBudgetInputs.querySelectorAll('input[data-cat]').forEach(function(inp){
      var val=parseFloat(inp.value); if(val>0){budgets[inp.dataset.cat]=val;}else{delete budgets[inp.dataset.cat];}
    });
    saveBudgets(); closeBudgetModal(); renderTracker();
  }

  // ─── Error helpers ────────────────────────────────────────────────────────────

  function showError(msg){elFormError.textContent=msg;elFormError.hidden=false;}
  function clearError(){elFormError.textContent='';elFormError.hidden=true;}

  // ─── Render: Tracker ──────────────────────────────────────────────────────────

  function renderTracker(){
    elMonthName.textContent=MONTHS[viewMonth];
    elMonthYear.textContent=viewYear;
    var monthly=monthlyExp(viewYear,viewMonth);
    var total=monthly.reduce(function(s,e){return s+e.amount;},0);
    var sorted=catTotals(monthly);
    var tb=totalBudget();

    elTotalSpent.textContent=peso(total);
    elTopCat.textContent=sorted.length?sorted[0][0].split('/')[0].trim():'~';

    if(tb>0){
      var left=tb-total;
      elBudgetLeftLabel.textContent='Budget Left';
      elBudgetLeft.textContent=left>=0?peso(left)+' left':peso(Math.abs(left))+' over';
      elBudgetLeft.className='summary-card__value summary-card__value--sm'+(left<0?' summary-card__value--over':'');
    } else {
      elBudgetLeftLabel.textContent='Entries';
      elBudgetLeft.textContent=monthly.length;
      elBudgetLeft.className='summary-card__value summary-card__value--sm';
    }

    renderInsights(monthly);
    checkCarryover();
    renderBudgetSection(monthly);

    if(sorted.length){elChartSection.hidden=false;buildDonutChart(elCatChart,sorted,total);}
    else{elChartSection.hidden=true;elCatChart.innerHTML='';}

    if(!monthly.length){elExpenseList.innerHTML='<p class="expense-list__empty">No expenses logged yet.</p>';return;}

    var byDate=monthly.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    elExpenseList.className='expense-list'+(selectMode?' expense-list--select-mode':'');
    elExpenseList.innerHTML=byDate.map(function(e,i){
      var installBadge='';
      if(e.isInstallment&&e.installmentMonths){
        installBadge='<span class="badge badge--installment" title="Installment">'+
          (e.installmentCurrent||1)+'/'+e.installmentMonths+'</span>';
      }
      var checkboxHtml=selectMode
        ?'<div class="expense-item__checkbox"><input type="checkbox" class="expense-item__check" data-id="'+e.id+'"'+(selectedIds[e.id]?' checked':'')+' aria-label="Select"></div>'
        :'';
      return '<article class="expense-item'+(selectedIds[e.id]?' expense-item--selected':'')+'" data-id="'+e.id+'" style="animation-delay:'+(i*0.04)+'s">'+
        checkboxHtml+
        '<div class="expense-item__icon" aria-hidden="true">'+(CAT_EMOJI[e.category]||'•')+'</div>'+
        '<div class="expense-item__body">'+
          '<div class="expense-item__cat">'+esc(e.category)+
            (e.isRecurring?'<span class="badge badge--recurring" title="Recurring">↻</span>':'')+
            installBadge+
          '</div>'+
          (e.payment?'<div class="expense-item__payment">'+esc(e.payment)+'</div>':'')+
          (e.notes?'<div class="expense-item__note">'+esc(e.notes)+'</div>':'')+
          '<div class="expense-item__date">'+fmtDate(e.date)+'</div>'+
        '</div>'+
        '<div class="expense-item__right">'+
          '<span class="expense-item__amount">'+peso(e.amount)+'</span>'+
          (selectMode?'':
            '<div class="expense-item__actions">'+
              '<button class="expense-item__edit" data-id="'+e.id+'" aria-label="Edit">&#9998;</button>'+
              '<button class="expense-item__delete" data-id="'+e.id+'" aria-label="Delete">&#x2715;</button>'+
            '</div>')+
        '</div>'+
      '</article>';
    }).join('');
  }

  // ─── Render: Dashboard ────────────────────────────────────────────────────────

  function renderDashboard(){
    var m=parseInt(elDashMonth.value,10),y=parseInt(elDashYear.value,10);
    var list=monthlyExp(y,m);
    var total=list.reduce(function(s,e){return s+e.amount;},0);
    var sorted=catTotals(list);

    elDashTotal.textContent=peso(total);
    elDashCount.textContent=list.length;
    elDashAvg.textContent=list.length?peso(total/list.length):'~';

    renderAnnualBudget(y);
    renderTrendChart(y,m);

    if(sorted.length){elDashChartSec.hidden=false;buildCatChart(elDashCatChart,sorted);}
    else{elDashChartSec.hidden=true;elDashCatChart.innerHTML='';}

    if(!list.length){elDashTbody.innerHTML='';elDashEmpty.hidden=false;elDashTfoot.hidden=true;return;}
    elDashEmpty.hidden=true; elDashTfoot.hidden=false;
    elDashTfootTotal.textContent=peso(total);

    var byDate=list.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    elDashTbody.innerHTML=byDate.map(function(e){
      var installLabel=e.isInstallment&&e.installmentMonths?' ['+(e.installmentCurrent||1)+'/'+e.installmentMonths+']':'';
      return '<tr>'+
        '<td class="dash-table__date">'+fmtDate(e.date)+'</td>'+
        '<td>'+esc(e.category)+(e.isRecurring?'<span class="badge badge--recurring">↻</span>':'')+esc(installLabel)+'</td>'+
        '<td>'+esc(e.payment||'~')+'</td>'+
        '<td class="dash-table__note">'+esc(e.notes||'~')+'</td>'+
        '<td class="dash-table__num">'+peso(e.amount)+'</td>'+
      '</tr>';
    }).join('');
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  elTabTracker.addEventListener('click',function(){showTab('tracker');});
  elTabDashboard.addEventListener('click',function(){showTab('dashboard');});
  elPrevMonth.addEventListener('click',function(){viewMonth-=1;if(viewMonth<0){viewMonth=11;viewYear-=1;}renderTracker();});
  elNextMonth.addEventListener('click',function(){viewMonth+=1;if(viewMonth>11){viewMonth=0;viewYear+=1;}renderTracker();});

  elAddBtn.addEventListener('click',addExpense);
  elAmt.addEventListener('keydown',function(e){if(e.key==='Enter')addExpense();});
  elAmt.addEventListener('input',function(){elAmt.classList.remove('is-error');});

  elCatPills.addEventListener('click',function(e){
    var pill=e.target.closest('.quick-add__cat-pill');
    if(!pill) return;
    elCatPills.querySelectorAll('.quick-add__cat-pill').forEach(function(p){
      p.classList.remove('quick-add__cat-pill--active'); p.setAttribute('aria-selected','false');
    });
    pill.classList.add('quick-add__cat-pill--active'); pill.setAttribute('aria-selected','true');
    elCat.value=pill.dataset.cat;
    elCatPills.classList.remove('is-error');
  });

  document.querySelectorAll('.quick-add__pay-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.quick-add__pay-btn').forEach(function(b){b.classList.remove('quick-add__pay-btn--active');});
      btn.classList.add('quick-add__pay-btn--active');
      elPayment.value=btn.dataset.payment;
    });
  });

  if(elDashGoTracker) elDashGoTracker.addEventListener('click',function(){showTab('tracker');});

  elIsInstallment.addEventListener('change',function(){
    elInstallmentMonthsRow.hidden=!elIsInstallment.checked;
    if(elIsInstallment.checked){elIsRecurring.checked=false;}
  });
  elIsRecurring.addEventListener('change',function(){
    if(elIsRecurring.checked){elIsInstallment.checked=false;elInstallmentMonthsRow.hidden=true;}
  });

  elModalInstallment.addEventListener('change',function(){
    elModalInstallmentMonthsRow.hidden=!elModalInstallment.checked;
    if(elModalInstallment.checked) elModalRecurring.checked=false;
  });
  elModalRecurring.addEventListener('change',function(){
    if(elModalRecurring.checked){elModalInstallment.checked=false;elModalInstallmentMonthsRow.hidden=true;}
  });

  elCancelEdit.addEventListener('click',function(){elCancelEdit.hidden=true;elFormTitle.textContent='Add Expense';elAddBtn.textContent='Add';resetForm();});
  elBudgetBtn.addEventListener('click',openBudgetModal);

  elCarryoverConfirmAll.addEventListener('click',confirmCarryover);
  elCarryoverDismiss.addEventListener('click',dismissCarryover);

  elSelectBtn.addEventListener('click',function(){ if(selectMode) exitSelectMode(); else enterSelectMode(); });
  elBulkCancelBtn.addEventListener('click',exitSelectMode);
  elBulkDeleteBtn.addEventListener('click',deleteSelected);
  elSelectAllCheck.addEventListener('change',function(){
    var monthly=monthlyExp(viewYear,viewMonth);
    if(elSelectAllCheck.checked){ monthly.forEach(function(e){ selectedIds[e.id]=true; }); }
    else{ selectedIds={}; }
    updateBulkBar(); renderTracker();
  });

  elExpenseList.addEventListener('click',function(e){
    var check=e.target.closest('.expense-item__check');
    if(check){
      var id=Number(check.dataset.id);
      if(check.checked){ selectedIds[id]=true; }else{ delete selectedIds[id]; }
      updateBulkBar();
      var art=check.closest('.expense-item');
      if(art) art.classList.toggle('expense-item--selected',!!selectedIds[id]);
      return;
    }
    if(selectMode){
      var art2=e.target.closest('.expense-item'); if(!art2) return;
      var id2=Number(art2.dataset.id);
      if(selectedIds[id2]){ delete selectedIds[id2]; art2.classList.remove('expense-item--selected'); }
      else{ selectedIds[id2]=true; art2.classList.add('expense-item--selected'); }
      var chk=art2.querySelector('.expense-item__check'); if(chk) chk.checked=!!selectedIds[id2];
      updateBulkBar();
      return;
    }
    var btn=e.target.closest('button[data-id]'); if(!btn) return;
    var id3=Number(btn.dataset.id);
    if(btn.classList.contains('expense-item__delete')) deleteExpense(id3);
    if(btn.classList.contains('expense-item__edit'))   openEditModal(id3);
  });

  elModalClose.addEventListener('click',closeEditModal);
  elModalCancel.addEventListener('click',closeEditModal);
  elModalSave.addEventListener('click',saveEdit);
  elModalOverlay.addEventListener('click',function(e){if(e.target===elModalOverlay)closeEditModal();});

  elBudgetModalClose.addEventListener('click',closeBudgetModal);
  elBudgetModalCancel.addEventListener('click',closeBudgetModal);
  elBudgetModalSave.addEventListener('click',saveBudgetModal);
  elBudgetModalOverlay.addEventListener('click',function(e){if(e.target===elBudgetModalOverlay)closeBudgetModal();});

  elAnnualBudgetBtn.addEventListener('click',function(){openAnnualBudgetModal(parseInt(elDashYear.value,10)||today.getFullYear());});
  elAnnualBudgetModalClose.addEventListener('click',closeAnnualBudgetModal);
  elAnnualBudgetModalCancel.addEventListener('click',closeAnnualBudgetModal);
  elAnnualBudgetModalSave.addEventListener('click',function(){saveAnnualBudgetModal(parseInt(elDashYear.value,10)||today.getFullYear());});
  elAnnualBudgetModalOverlay.addEventListener('click',function(e){if(e.target===elAnnualBudgetModalOverlay)closeAnnualBudgetModal();});

  elCsvExportBtn.addEventListener('click',exportCSV);

  elDashMonth.addEventListener('change',renderDashboard);
  elDashYear.addEventListener('change',renderDashboard);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      if(!elModalOverlay.hidden) closeEditModal();
      if(!elBudgetModalOverlay.hidden) closeBudgetModal();
      if(!elAnnualBudgetModalOverlay.hidden) closeAnnualBudgetModal();
    }
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  var elLoginGate = $('login-gate');
  var elLoginUser = $('login-user');
  var elLoginPass = $('login-pass');
  var elLoginBtn  = $('login-btn');
  var elLoginError= $('login-error');
  var elApp       = $('tracker-app');

  function bootApp() {
    elDashMonth.value=today.getMonth();
    populateYears();
    renderTracker();
    syncFromSupabase();
  }

  function doLogin() {
    var u=elLoginUser.value.trim(), p=elLoginPass.value;
    if(u==='agb'&&p==='agb'){
      localStorage.setItem(AUTH_KEY,'1');
      elLoginGate.hidden=true;
      elApp.hidden=false;
      elLoginError.hidden=true;
      bootApp();
    }else{
      elLoginError.hidden=false;
      elLoginUser.classList.add('is-error');
      elLoginPass.classList.add('is-error');
      elLoginPass.value='';
      elLoginPass.focus();
    }
  }

  elLoginBtn.addEventListener('click',doLogin);
  elLoginPass.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
  elLoginUser.addEventListener('keydown',function(e){if(e.key==='Enter')elLoginPass.focus();});
  elLoginUser.addEventListener('input',function(){elLoginUser.classList.remove('is-error');elLoginError.hidden=true;});
  elLoginPass.addEventListener('input',function(){elLoginPass.classList.remove('is-error');elLoginError.hidden=true;});

  // ─── Init ─────────────────────────────────────────────────────────────────────

  if(localStorage.getItem(AUTH_KEY)==='1'){
    elLoginGate.hidden=true;
    elApp.hidden=false;
    bootApp();
  }

})();
