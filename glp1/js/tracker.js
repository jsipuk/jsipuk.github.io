/* =============================================================================
 * MY MOUNJARO PROGRESS TRACKER — tracker.js
 * -----------------------------------------------------------------------------
 * A private, browser-only progress log. Nothing leaves the device: all data is
 * kept in localStorage. Companion to the guide (index.html).
 *
 * No build step, no dependencies — plain ES5-ish JavaScript so it runs anywhere.
 * ========================================================================== */
(function () {
  'use strict';

  var KEY = 'glp1-tracker-v1';

  // Columns. `unit` ties a field to the chosen weight/length unit for labels.
  var FIELDS = [
    { k: 'date',   label: 'Date',        type: 'date' },
    { k: 'week',   label: 'Week',        type: 'number', step: '1',    min: '0' },
    { k: 'dose',   label: 'Dose',        type: 'number', step: '0.25', min: '0', suffix: 'mg' },
    { k: 'weight', label: 'Weight',      type: 'number', step: '0.1',  min: '0', unit: 'weight' },
    { k: 'waist',  label: 'Waist',       type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'chest',  label: 'Chest',       type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'hips',   label: 'Hips',        type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'neck',   label: 'Neck',        type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'thigh',  label: 'Thigh',       type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'arm',    label: 'Arm',         type: 'number', step: '0.1',  min: '0', unit: 'length' },
    { k: 'site',   label: 'Inj. site',   type: 'text' },
    { k: 'notes',  label: 'Side effects / notes', type: 'text', wide: true }
  ];

  /* ---- tiny DOM helper ---------------------------------------------------- */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---- state -------------------------------------------------------------- */
  function defaults() {
    return {
      settings: { name: '', medication: 'Mounjaro (tirzepatide)', weightUnit: 'kg', lengthUnit: 'cm' },
      entries: [],
      // Bookkeeping for backup reminders + dismissed tips (not user data as such).
      meta: { lastBackupAt: null, dirty: false, homeTipDismissed: false }
    };
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== 'object') return defaults();
      var d = defaults();
      raw.settings = Object.assign(d.settings, raw.settings || {});
      raw.entries = Array.isArray(raw.entries) ? raw.entries : [];
      raw.meta = Object.assign(d.meta, raw.meta || {});
      return raw;
    } catch (e) { return defaults(); }
  }
  // Mark that user data changed since the last backup.
  function markDirty() { state.meta.dirty = true; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { alert('Could not save — this browser may be blocking storage (private mode?).'); }
  }

  var state = load();
  var editingId = null;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function wUnit() { return state.settings.weightUnit; }
  function lUnit() { return state.settings.lengthUnit; }
  function unitFor(f) { return f.unit === 'weight' ? wUnit() : f.unit === 'length' ? lUnit() : f.suffix || ''; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

  // Entries sorted oldest → newest (diary order; also drives the chart).
  function sorted() {
    return state.entries.slice().sort(function (a, b) {
      return (a.date || '').localeCompare(b.date || '') || (a.week || 0) - (b.week || 0);
    });
  }
  function firstWith(key) {
    var s = sorted();
    for (var i = 0; i < s.length; i++) if (num(s[i][key]) != null) return s[i];
    return null;
  }
  function lastWith(key) {
    var s = sorted();
    for (var i = s.length - 1; i >= 0; i--) if (num(s[i][key]) != null) return s[i];
    return null;
  }

  /* ---- settings ----------------------------------------------------------- */
  function renderSettings() {
    var box = document.getElementById('settings');
    clear(box);
    box.appendChild(el('h2', { class: 'card-h' }, ['Your details']));

    function field(labelText, input) {
      return el('label', { class: 'set-field' }, [el('span', null, [labelText]), input]);
    }
    var name = el('input', { type: 'text', value: state.settings.name, placeholder: 'optional',
      oninput: function () { state.settings.name = this.value; save(); renderPrintTitle(); } });
    var med = el('input', { type: 'text', value: state.settings.medication,
      oninput: function () { state.settings.medication = this.value; save(); renderPrintTitle(); } });

    function unitSelect(current, opts, onset) {
      var sel = el('select', { onchange: function () { onset(this.value); save(); renderAll(); } },
        opts.map(function (o) {
          var op = el('option', { value: o }, [o]);
          if (o === current) op.setAttribute('selected', 'selected');
          return op;
        }));
      return sel;
    }
    var weightSel = unitSelect(wUnit(), ['kg', 'lb', 'st'], function (v) { state.settings.weightUnit = v; });
    var lenSel = unitSelect(lUnit(), ['cm', 'in'], function (v) { state.settings.lengthUnit = v; });

    box.appendChild(el('div', { class: 'set-grid' }, [
      field('Name', name),
      field('Medication', med),
      field('Weight in', weightSel),
      field('Measurements in', lenSel)
    ]));
    box.appendChild(el('p', { class: 'muted small' }, ['Units only change the labels — they don\'t convert numbers you\'ve already entered.']));
  }

  /* ---- summary ------------------------------------------------------------ */
  function statCard(label, value, sub) {
    return el('div', { class: 'stat' }, [
      el('div', { class: 'stat-val' }, [value]),
      el('div', { class: 'stat-label' }, [label]),
      sub ? el('div', { class: 'stat-sub' }, [sub]) : null
    ]);
  }
  function delta(key, unit) {
    var a = firstWith(key), b = lastWith(key);
    if (!a || !b || a === b) return null;
    var d = num(b[key]) - num(a[key]);
    var sign = d > 0 ? '+' : '';
    var arrow = d < 0 ? '▼' : d > 0 ? '▲' : '–';
    return { text: sign + d.toFixed(1) + ' ' + unit, arrow: arrow, dir: d < 0 ? 'down' : d > 0 ? 'up' : 'flat' };
  }
  function renderSummary() {
    var box = document.getElementById('summary');
    clear(box);
    var s = sorted();
    if (!s.length) {
      box.appendChild(el('div', { class: 'empty' }, ['No entries yet — add your first one below to see your progress here.']));
      return;
    }
    var lastW = lastWith('weight'), firstW = firstWith('weight');
    var wd = delta('weight', wUnit());
    var weeks = s.reduce(function (m, e) { return Math.max(m, num(e.week) || 0); }, 0) || s.length;

    box.appendChild(statCard('Entries', String(s.length)));
    box.appendChild(statCard('Weeks tracked', String(weeks)));
    if (lastW) box.appendChild(statCard('Current weight', num(lastW.weight).toFixed(1) + ' ' + wUnit(),
      firstW ? 'Started ' + num(firstW.weight).toFixed(1) + ' ' + wUnit() : null));
    if (wd) {
      var c = statCard('Weight change', wd.arrow + ' ' + wd.text, 'since first entry');
      c.classList.add('stat-' + wd.dir);
      box.appendChild(c);
    }
    var waistD = delta('waist', lUnit());
    if (waistD) {
      var cw = statCard('Waist change', waistD.arrow + ' ' + waistD.text, 'since first entry');
      cw.classList.add('stat-' + waistD.dir);
      box.appendChild(cw);
    }
    var lastDose = lastWith('dose');
    if (lastDose) box.appendChild(statCard('Current dose', num(lastDose.dose) + ' mg'));
  }

  /* ---- weight trend chart (inline SVG) ------------------------------------ */
  function renderChart() {
    var box = document.getElementById('chart');
    clear(box);
    var pts = sorted().filter(function (e) { return num(e.weight) != null; })
      .map(function (e) { return { x: e.date || '', y: num(e.weight) }; });
    box.appendChild(el('h2', { class: 'card-h' }, ['Weight trend']));
    if (pts.length < 2) {
      box.appendChild(el('p', { class: 'muted small' }, ['Add at least two weigh-ins to see the trend line.']));
      return;
    }
    var W = 640, H = 200, pad = 28;
    var ys = pts.map(function (p) { return p.y; });
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    if (minY === maxY) { minY -= 1; maxY += 1; }
    var sx = function (i) { return pad + i * (W - pad * 2) / (pts.length - 1); };
    var sy = function (v) { return H - pad - (v - minY) / (maxY - minY) * (H - pad * 2); };

    var svgNS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs, kids) {
      var n = document.createElementNS(svgNS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'trend', role: 'img',
      'aria-label': 'Line chart of weight over time' });
    // gridlines + min/max labels
    [minY, (minY + maxY) / 2, maxY].forEach(function (v) {
      svg.appendChild(s('line', { x1: pad, x2: W - pad, y1: sy(v), y2: sy(v), class: 'grid' }));
      var t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', 4); t.setAttribute('y', sy(v) + 4); t.setAttribute('class', 'axis');
      t.textContent = v.toFixed(1);
      svg.appendChild(t);
    });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(i) + ' ' + sy(p.y); }).join(' ');
    svg.appendChild(s('path', { d: d, class: 'line' }));
    pts.forEach(function (p, i) { svg.appendChild(s('circle', { cx: sx(i), cy: sy(p.y), r: 3.5, class: 'dot' })); });
    box.appendChild(svg);
    box.appendChild(el('p', { class: 'muted small' }, ['Weight in ' + wUnit() + ', oldest to newest. A trend over weeks tells the truth; one morning does not.']));
  }

  /* ---- add / edit form ---------------------------------------------------- */
  function renderForm() {
    var box = document.getElementById('entry');
    clear(box);
    box.appendChild(el('h2', { class: 'card-h' }, [editingId ? 'Edit entry' : 'Add an entry']));

    var inputs = {};
    var grid = el('div', { class: 'form-grid' }, FIELDS.map(function (f) {
      var u = unitFor(f);
      var attrs = { type: f.type, id: 'f-' + f.k };
      if (f.step) attrs.step = f.step;
      if (f.min != null) attrs.min = f.min;
      if (f.type === 'text') attrs.autocomplete = 'off';
      var input = el('input', attrs);
      inputs[f.k] = input;
      var labelText = f.label + (u ? ' (' + u + ')' : '');
      return el('label', { class: 'form-field' + (f.wide ? ' wide' : '') }, [
        el('span', null, [labelText]), input
      ]);
    }));
    box.appendChild(grid);

    // sensible defaults for a fresh entry
    if (!editingId) {
      inputs.date.value = new Date().toISOString().slice(0, 10);
      var nextWeek = state.entries.reduce(function (m, e) { return Math.max(m, num(e.week) || 0); }, 0) + 1;
      inputs.week.value = String(nextWeek);
      var ld = lastWith('dose');
      if (ld) inputs.dose.value = ld.dose;
    } else {
      var entry = state.entries.filter(function (e) { return e.id === editingId; })[0];
      if (entry) FIELDS.forEach(function (f) { if (entry[f.k] != null) inputs[f.k].value = entry[f.k]; });
    }

    function commit() {
      var rec = { id: editingId || uid() };
      FIELDS.forEach(function (f) {
        var v = inputs[f.k].value.trim();
        rec[f.k] = v;
      });
      if (!rec.date) { alert('Please add a date.'); inputs.date.focus(); return; }
      if (editingId) {
        state.entries = state.entries.map(function (e) { return e.id === editingId ? rec : e; });
      } else {
        state.entries.push(rec);
      }
      editingId = null;
      markDirty();
      save();
      renderAll();
      document.getElementById('entry').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var actions = el('div', { class: 'form-actions' }, [
      el('button', { type: 'button', class: 'pill-btn primary', onclick: commit },
        [editingId ? '✓ Update entry' : '+ Add entry']),
      editingId ? el('button', { type: 'button', class: 'pill-btn',
        onclick: function () { editingId = null; renderForm(); } }, ['Cancel']) : null
    ]);
    box.appendChild(actions);
  }

  /* ---- history table ------------------------------------------------------ */
  function renderTable() {
    var box = document.getElementById('log');
    clear(box);

    var head = el('div', { class: 'log-head no-print' }, [
      el('h2', { class: 'card-h' }, ['History']),
      el('span', { class: 'muted small' }, [state.entries.length + ' entr' + (state.entries.length === 1 ? 'y' : 'ies')])
    ]);
    box.appendChild(head);

    var headers = FIELDS.map(function (f) {
      var u = unitFor(f);
      return el('th', { class: f.wide ? 'col-wide' : '' }, [
        el('span', null, [f.label]), u ? el('small', null, [' (' + u + ')']) : null
      ]);
    });
    headers.push(el('th', { class: 'no-print col-act' }, ['']));

    var s = sorted();
    var rows = s.map(function (e) {
      var cells = FIELDS.map(function (f) {
        return el('td', { class: (f.wide ? 'col-wide' : '') + (f.type === 'number' ? ' num' : '') }, [e[f.k] || '']);
      });
      cells.push(el('td', { class: 'no-print col-act' }, [
        el('button', { type: 'button', class: 'mini', title: 'Edit',
          onclick: function () { editingId = e.id; renderForm(); document.getElementById('entry').scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, ['✎']),
        el('button', { type: 'button', class: 'mini danger', title: 'Delete',
          onclick: function () {
            if (confirm('Delete the entry for ' + (e.date || 'this row') + '?')) {
              state.entries = state.entries.filter(function (x) { return x.id !== e.id; });
              markDirty(); save(); renderAll();
            }
          } }, ['✕'])
      ]));
      return el('tr', null, cells);
    });

    // Print-only blank rows so a printed sheet is always usable as a paper log.
    var blanks = Math.max(0, 16 - s.length);
    for (var i = 0; i < blanks; i++) {
      var bc = FIELDS.map(function (f) { return el('td', { class: 'blank ' + (f.wide ? 'col-wide' : '') }, [' ']); });
      bc.push(el('td', { class: 'no-print col-act' }, []));
      rows.push(el('tr', { class: 'print-only' }, bc));
    }

    var table = el('table', { class: 'log-table' }, [
      el('thead', null, [el('tr', null, headers)]),
      el('tbody', null, rows)
    ]);
    box.appendChild(el('div', { class: 'table-scroll' }, [table]));

    if (!s.length) {
      box.querySelector('.table-scroll').appendChild(
        el('p', { class: 'muted small no-print', style: 'padding:0.6rem' },
          ['Nothing logged yet. Add an entry above, or just hit Print for a blank sheet to fill in by hand.']));
    }
  }

  /* ---- print header ------------------------------------------------------- */
  function renderPrintTitle() {
    var box = document.getElementById('print-title');
    clear(box);
    var st = state.settings;
    box.appendChild(el('h1', null, [(st.name ? st.name + ' — ' : '') + 'Progress Tracker']));
    box.appendChild(el('p', null, [
      (st.medication || '') +
      '   ·   weight in ' + wUnit() + ', measurements in ' + lUnit()
    ]));
  }

  /* ---- data menu: export / import / clear --------------------------------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function csvCell(v) {
    v = v == null ? '' : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV() {
    var header = FIELDS.map(function (f) { var u = unitFor(f); return f.label + (u ? ' (' + u + ')' : ''); });
    var lines = [header.map(csvCell).join(',')];
    sorted().forEach(function (e) {
      lines.push(FIELDS.map(function (f) { return csvCell(e[f.k]); }).join(','));
    });
    download('mounjaro-tracker.csv', lines.join('\r\n'), 'text/csv');
  }
  function exportJSON() {
    state.meta.lastBackupAt = new Date().toISOString();
    state.meta.dirty = false;
    save();
    download('mounjaro-tracker-backup.json', JSON.stringify(state, null, 2), 'application/json');
    renderBanners();
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.entries)) throw new Error('not a tracker backup');
        if (!confirm('Restore this backup? It will replace your current ' + state.entries.length + ' entr' +
          (state.entries.length === 1 ? 'y' : 'ies') + ' with ' + data.entries.length + '.')) return;
        state = data;
        state.settings = Object.assign(defaults().settings, data.settings || {});
        state.entries = data.entries.map(function (e) { return Object.assign({ id: uid() }, e); });
        state.meta = Object.assign(defaults().meta, data.meta || {});
        state.meta.dirty = false; // a freshly restored backup is, by definition, backed up
        editingId = null; save(); renderAll();
        alert('Backup restored.');
      } catch (err) {
        alert('That file does not look like a tracker backup.');
      }
    };
    reader.readAsText(file);
  }
  function clearAll() {
    if (!confirm('Delete ALL tracker data on this device? Export a backup first if you want to keep it. This cannot be undone.')) return;
    state = defaults(); editingId = null; save(); renderAll();
  }

  function wireMenu() {
    var btn = document.getElementById('data-btn');
    var dd = document.getElementById('data-dropdown');
    var fileInput = document.getElementById('import-file');
    function close() { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) { if (!dd.contains(e.target) && e.target !== btn) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    dd.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-action');
      if (!act) return;
      close();
      if (act === 'csv') exportCSV();
      else if (act === 'json') exportJSON();
      else if (act === 'import') fileInput.click();
      else if (act === 'clear') clearAll();
    });
    fileInput.addEventListener('change', function () {
      if (this.files && this.files[0]) importJSON(this.files[0]);
      this.value = '';
    });
    document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
  }

  /* ---- durability: persistence + reminders -------------------------------- */
  function isIOS() {
    return /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
  }
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function daysSince(iso) {
    if (!iso) return Infinity;
    return (Date.now() - new Date(iso).getTime()) / 86400000;
  }

  // Ask the browser not to auto-evict our data; reflect the result in the intro.
  function applyStorage() {
    var line = document.getElementById('storage-status');
    function set(txt) { if (line) line.textContent = txt; }
    if (!navigator.storage || !navigator.storage.persist) {
      set('Storage: standard — back up now and then so you don\'t lose anything.');
      return;
    }
    navigator.storage.persisted().then(function (already) {
      if (already) { set('Storage: persistent ✓ — your browser has been asked not to clear this automatically.'); return; }
      navigator.storage.persist().then(function (granted) {
        set(granted
          ? 'Storage: persistent ✓ — your browser has been asked not to clear this automatically.'
          : 'Storage: standard — back up now and then, and on iPhone add this to your Home Screen (see below).');
      }).catch(function () { set('Storage: standard — back up now and then so you don\'t lose anything.'); });
    }).catch(function () { set('Storage: standard — back up now and then so you don\'t lose anything.'); });
  }

  var backupDismissed = false; // per page-load
  function renderBanners() {
    var box = document.getElementById('banners');
    if (!box) return;
    clear(box);

    // 1. Backup reminder: shown when there are unsaved-since-backup changes.
    if (state.entries.length && state.meta.dirty && !backupDismissed) {
      var never = !state.meta.lastBackupAt;
      var d = Math.floor(daysSince(state.meta.lastBackupAt));
      var msg = never
        ? 'Your progress is saved on this device only. Save a backup so a browser clear-out can\'t wipe it.'
        : 'You\'ve made changes since your last backup (' + d + ' day' + (d === 1 ? '' : 's') + ' ago). Save a fresh one?';
      box.appendChild(el('div', { class: 'banner backup' }, [
        el('span', { class: 'banner-ico', 'aria-hidden': 'true' }, ['💾']),
        el('span', { class: 'banner-text' }, [msg]),
        el('button', { class: 'pill-btn primary', type: 'button', onclick: exportJSON }, ['Save a backup']),
        el('button', { class: 'banner-x', type: 'button', 'aria-label': 'Dismiss',
          onclick: function () { backupDismissed = true; renderBanners(); } }, ['✕'])
      ]));
    }

    // 2. iOS tip: Add to Home Screen exempts the site from Safari's ~7-day wipe.
    if (isIOS() && !isStandalone() && !state.meta.homeTipDismissed) {
      box.appendChild(el('div', { class: 'banner tip' }, [
        el('span', { class: 'banner-ico', 'aria-hidden': 'true' }, ['📲']),
        el('span', { class: 'banner-text' }, [
          'On iPhone, tap Share then ', el('strong', null, ['Add to Home Screen']),
          ', and open the tracker from there. It keeps your data safe — Safari can otherwise clear ordinary web data after about a week.'
        ]),
        el('button', { class: 'banner-x', type: 'button', 'aria-label': 'Dismiss',
          onclick: function () { state.meta.homeTipDismissed = true; save(); renderBanners(); } }, ['✕'])
      ]));
    }
  }

  /* ---- boot --------------------------------------------------------------- */
  function renderAll() {
    renderSettings();
    renderSummary();
    renderChart();
    renderForm();
    renderTable();
    renderPrintTitle();
    renderBanners();
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireMenu();
    renderAll();
    applyStorage();
  });
})();
