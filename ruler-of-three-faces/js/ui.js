/* The Ruler of Three Faces — UI layer
 * Screen routing, log rendering, side panels, settings, save slots.
 */
window.ROTF = window.ROTF || {};

ROTF.UI = (function () {
  const S = () => ROTF.State;
  const D = () => ROTF.DATA;
  const E = () => ROTF.Engine;

  let state = null;           // active game state
  const $ = id => document.getElementById(id);

  /* ---------------- settings ---------------- */

  const defaultSettings = {
    fontScale: 'md',      // sm | md | lg
    highContrast: false,
    reducedMotion: false,
    dyslexiaFont: false
  };
  let settings = { ...defaultSettings };

  function loadSettings() {
    try {
      const raw = localStorage.getItem('rotf.settings');
      if (raw) settings = { ...defaultSettings, ...JSON.parse(raw) };
    } catch (e) { /* fall back to defaults */ }
    applySettings();
  }

  function saveSettings() {
    try { localStorage.setItem('rotf.settings', JSON.stringify(settings)); } catch (e) {}
    applySettings();
  }

  function applySettings() {
    const b = document.body;
    b.dataset.font = settings.fontScale;
    b.classList.toggle('high-contrast', settings.highContrast);
    b.classList.toggle('reduced-motion', settings.reducedMotion);
    b.classList.toggle('dyslexia-font', settings.dyslexiaFont);
    $('set-font').value = settings.fontScale;
    $('set-contrast').checked = settings.highContrast;
    $('set-motion').checked = settings.reducedMotion;
    $('set-dyslexia').checked = settings.dyslexiaFont;
  }

  /* ---------------- screens ---------------- */

  function show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
  }

  function openModal(id) { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }

  /* ---------------- welcome ---------------- */

  function refreshWelcome() {
    const auto = S().slotMeta('autosave');
    $('btn-continue').disabled = !auto;
    $('btn-continue').title = auto
      ? auto.name + ' — ' + auto.location
      : 'No story in progress yet';
  }

  /* ---------------- character creation ---------------- */

  function buildCreation() {
    const bgWrap = $('cc-backgrounds');
    bgWrap.innerHTML = '';
    D().backgrounds.forEach((b, i) => {
      bgWrap.insertAdjacentHTML('beforeend',
        `<label class="cc-card"><input type="radio" name="cc-bg" value="${b.id}" ${i === 0 ? 'checked' : ''}>
          <span class="cc-card-body"><strong>${b.name}</strong><small>${b.blurb}</small></span></label>`);
    });
    const pWrap = $('cc-personalities');
    pWrap.innerHTML = '';
    D().personalities.forEach((p, i) => {
      pWrap.insertAdjacentHTML('beforeend',
        `<label class="cc-card"><input type="radio" name="cc-pers" value="${p.id}" ${p.id === 'curious' ? 'checked' : ''}>
          <span class="cc-card-body"><strong>${p.name}</strong><small>${p.blurb}</small></span></label>`);
    });
    const prSel = $('cc-pronouns');
    prSel.innerHTML = D().pronounOptions.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  function startNewGame(skip) {
    const profile = skip ? {} : {
      name: $('cc-name').value,
      pronouns: $('cc-pronouns').value,
      title: $('cc-title').value,
      background: (document.querySelector('input[name="cc-bg"]:checked') || {}).value,
      personality: (document.querySelector('input[name="cc-pers"]:checked') || {}).value
    };
    state = S().newGame(profile);
    show('screen-game');
    clearLog();
    const out = E().begin(state);
    renderTurn(out);
    persist();
  }

  /* ---------------- log rendering ---------------- */

  function clearLog() { $('story-log').innerHTML = ''; }

  function entryHTML(e) {
    switch (e.type) {
      case 'scene':      return `<h2 class="log-scene">${esc(e.text)}</h2>`;
      case 'narrative':  return `<p class="log-narrative">${esc(e.text)}</p>`;
      case 'dialogue':   return `<p class="log-dialogue"><span class="speaker">${esc(e.speaker)}</span>${esc(e.text)}</p>`;
      case 'system':     return `<p class="log-system">${esc(e.text)}</p>`;
      case 'player':     return `<p class="log-player"><span class="speaker">You</span>${esc(e.text)}</p>`;
      case 'achievement':return `<p class="log-achievement">&#10022; Achievement unlocked — ${esc(e.text)}</p>`;
      default:           return `<p class="log-narrative">${esc(e.text)}</p>`;
    }
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function appendEntry(e, animate) {
    const log = $('story-log');
    log.insertAdjacentHTML('beforeend', entryHTML(e));
    const el = log.lastElementChild;
    if (animate && !settings.reducedMotion) el.classList.add('fade-in');
  }

  function renderTurn(out) {
    out.entries.forEach(e => {
      appendEntry(e, true);
      S().pushLog(state, e);
      if (e.type === 'achievement') toast('Achievement unlocked: ' + e.text);
    });
    state.pendingUnlocks = [];
    renderChoices(out.choices);
    renderSidebars();
    const wrap = $('story-scroll');
    wrap.scrollTop = wrap.scrollHeight;
  }

  function renderChoices(choices) {
    const wrap = $('choices');
    wrap.innerHTML = '';
    (choices || []).forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = c.label;
      btn.addEventListener('click', () => act({ type: 'choice', id: c.id }));
      wrap.appendChild(btn);
    });
  }

  function act(action) {
    if (!state) return;
    const out = E().turn(state, action);
    renderTurn(out);
    persist();
  }

  /* ---------------- sidebars ---------------- */

  function renderSidebars() {
    const p = state.player;
    $('hud-name').textContent = p.name;
    $('hud-title').textContent = p.title || cap(p.background) + ' · ' + cap(p.personality);
    $('hud-location').textContent = D().locations[state.location].name;
    $('hud-chapter').textContent = 'Chapter ' + state.world.chapter + ' — ' + state.world.chapterTitle;
    setMeter('hud-health', p.health);
    setMeter('hud-energy', p.energy);
    $('hud-gold').textContent = p.gold;
    $('hud-influence').textContent = p.influence;

    renderRelationships();
    renderTab(currentTab);
  }

  function setMeter(id, val) {
    const el = $(id);
    el.querySelector('.meter-fill').style.width = val + '%';
    el.querySelector('.meter-val').textContent = val;
  }

  function relWord(rel) {
    const score = rel.trust + rel.respect + rel.affection;
    if (score >= 5) return 'Warm';
    if (score >= 2) return 'Favourable';
    if (score <= -2) return 'Wary';
    return 'Neutral';
  }

  function renderRelationships() {
    const wrap = $('hud-relationships');
    const ids = Object.keys(state.characters);
    wrap.innerHTML = ids.length ? '' : '<p class="muted">No one knows you yet.</p>';
    ids.forEach(id => {
      const ch = D().characters[id];
      wrap.insertAdjacentHTML('beforeend',
        `<div class="rel-row"><span>${esc(ch.name)}</span><span class="rel-word">${relWord(state.characters[id])}</span></div>`);
    });
  }

  /* ---------------- right panel tabs ---------------- */

  let currentTab = 'inventory';

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    renderTab(tab);
  }

  function renderTab(tab) {
    const wrap = $('tab-content');
    if (!state) { wrap.innerHTML = ''; return; }
    switch (tab) {
      case 'inventory': return renderInventory(wrap);
      case 'characters': return renderCharacters(wrap);
      case 'quests': return renderQuests(wrap);
      case 'journal': return renderJournal(wrap);
      case 'codex': return renderCodex(wrap);
      case 'achievements': return renderAchievements(wrap);
    }
  }

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

  function renderInventory(wrap) {
    if (!state.inventory.length) {
      wrap.innerHTML = '<p class="muted">Your pockets contain optimism and little else.</p>';
      return;
    }
    wrap.innerHTML = '';
    [...state.inventory]
      .sort((a, b) => RARITY_ORDER.indexOf(D().items[b.id].rarity) - RARITY_ORDER.indexOf(D().items[a.id].rarity))
      .forEach(row => {
        const item = D().items[row.id];
        const div = document.createElement('div');
        div.className = 'inv-item rarity-' + item.rarity;
        div.innerHTML = `<div class="inv-head"><strong>${esc(item.name)}</strong>` +
          (row.qty > 1 ? `<span class="qty">×${row.qty}</span>` : '') +
          `<span class="rarity">${item.rarity}</span></div>` +
          `<p>${esc(item.description)}</p>`;
        if (item.usable) {
          const btn = document.createElement('button');
          btn.className = 'mini-btn';
          btn.textContent = 'Use';
          btn.addEventListener('click', () => act({ type: 'choice', id: 'use_' + item.id }));
          div.appendChild(btn);
        }
        wrap.appendChild(div);
      });
  }

  function renderCharacters(wrap) {
    const ids = Object.keys(state.characters);
    if (!ids.length) { wrap.innerHTML = '<p class="muted">You have met no one — yet.</p>'; return; }
    wrap.innerHTML = '';
    ids.forEach(id => {
      const ch = D().characters[id];
      const rel = state.characters[id];
      wrap.insertAdjacentHTML('beforeend',
        `<div class="panel-card"><div class="inv-head"><strong>${esc(ch.name)}</strong><span class="rel-word">${relWord(rel)}</span></div>
         <p class="muted">${esc(ch.role)}</p><p>${esc(ch.codex)}</p></div>`);
    });
  }

  function renderQuests(wrap) {
    const ids = Object.keys(state.quests).filter(id => state.quests[id] !== 'hidden');
    if (!ids.length) { wrap.innerHTML = '<p class="muted">No quests yet.</p>'; return; }
    wrap.innerHTML = '';
    const order = { active: 0, completed: 1, failed: 2 };
    ids.sort((a, b) => (order[state.quests[a]] || 0) - (order[state.quests[b]] || 0));
    ids.forEach(id => {
      const q = D().quests[id];
      if (!q) return;
      const status = state.quests[id];
      wrap.insertAdjacentHTML('beforeend',
        `<div class="panel-card quest-${status}"><div class="inv-head"><strong>${esc(q.title)}</strong><span class="quest-status">${status}</span></div>
         <p class="muted">${esc(q.category)}</p><p>${esc(q.description)}</p>
         <ul>${q.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>`);
    });
  }

  function renderJournal(wrap) {
    if (!state.journal.length) { wrap.innerHTML = '<p class="muted">The chronicle awaits its first line.</p>'; return; }
    wrap.innerHTML = '';
    [...state.journal].reverse().forEach(j => {
      wrap.insertAdjacentHTML('beforeend',
        `<div class="panel-card journal-entry"><span class="muted">Day ${j.day}</span><p>${esc(j.text)}</p></div>`);
    });
  }

  function renderCodex(wrap) {
    if (!state.codex.length) { wrap.innerHTML = '<p class="muted">Knowledge, once discovered, gathers here.</p>'; return; }
    wrap.innerHTML = '';
    state.codex.forEach(id => {
      let title, category, text;
      if (id.startsWith('char:')) {
        const ch = D().characters[id.slice(5)];
        if (!ch) return;
        title = ch.name; category = 'Character'; text = ch.codex;
      } else if (id.startsWith('loc:')) {
        const loc = D().locations[id.slice(4)];
        if (!loc) return;
        title = loc.name; category = 'Location'; text = loc.brief;
      } else if (id.startsWith('item:')) {
        const item = D().items[id.slice(5)];
        if (!item) return;
        title = item.name; category = 'Item'; text = item.description;
      } else {
        const entry = D().codex[id];
        if (!entry) return;
        title = entry.title; category = entry.category; text = entry.text;
      }
      wrap.insertAdjacentHTML('beforeend',
        `<div class="panel-card"><div class="inv-head"><strong>${esc(title)}</strong><span class="muted">${esc(category)}</span></div><p>${esc(text)}</p></div>`);
    });
  }

  function renderAchievements(wrap) {
    wrap.innerHTML = '';
    Object.values(D().achievements).forEach(a => {
      const got = state.achievements.includes(a.id);
      if (a.hidden && !got) {
        wrap.insertAdjacentHTML('beforeend',
          `<div class="panel-card ach-locked"><strong>???</strong><p class="muted">A hidden achievement.</p></div>`);
        return;
      }
      wrap.insertAdjacentHTML('beforeend',
        `<div class="panel-card ${got ? 'ach-unlocked' : 'ach-locked'}"><strong>${got ? '&#10022; ' : ''}${esc(a.name)}</strong><p class="muted">${esc(a.description)}</p></div>`);
    });
  }

  /* ---------------- toast ---------------- */

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  /* ---------------- persistence ---------------- */

  function persist() {
    if (!S().storageAvailable()) return;
    try { S().saveToSlot(state, 'autosave'); refreshWelcome(); } catch (e) { /* quota */ }
  }

  function renderSaveSlots() {
    const wrap = $('save-slots');
    wrap.innerHTML = '';
    ['slot1', 'slot2', 'slot3'].forEach((slot, i) => {
      const meta = S().slotMeta(slot);
      const div = document.createElement('div');
      div.className = 'save-slot';
      div.innerHTML = meta
        ? `<div><strong>Slot ${i + 1}</strong> — ${esc(meta.name)}${meta.title ? ', ' + esc(meta.title) : ''}<br>
           <span class="muted">${esc(meta.chapter)} · ${esc(meta.location)} · ${new Date(meta.savedAt).toLocaleString()}</span></div>`
        : `<div><strong>Slot ${i + 1}</strong> — <span class="muted">empty</span></div>`;
      const actions = document.createElement('div');
      actions.className = 'save-actions';
      if (state) {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'mini-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => { S().saveToSlot(state, slot); renderSaveSlots(); toast('Story saved.'); });
        actions.appendChild(saveBtn);
      }
      if (meta) {
        const loadBtn = document.createElement('button');
        loadBtn.className = 'mini-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => { loadGame(slot); });
        actions.appendChild(loadBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'mini-btn danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
          if (confirm('Delete this save? This cannot be undone.')) { S().deleteSlot(slot); renderSaveSlots(); }
        });
        actions.appendChild(delBtn);
      }
      div.appendChild(actions);
      wrap.appendChild(div);
    });
  }

  function loadGame(slot) {
    try {
      const loaded = S().loadFromSlot(slot);
      if (!loaded) { toast('That slot is empty.'); return; }
      state = loaded;
      closeModal('modal-saves');
      show('screen-game');
      clearLog();
      state.log.forEach(e => appendEntry(e, false));
      const out = E().resume(state);
      out.entries.forEach(e => { appendEntry(e, true); S().pushLog(state, e); });
      renderChoices(out.choices);
      renderSidebars();
      $('story-scroll').scrollTop = $('story-scroll').scrollHeight;
      persist();
    } catch (err) {
      toast('Could not load save: ' + err.message);
    }
  }

  function exportSave() {
    if (!state) return;
    download('ruler-of-three-faces-save.json', S().serialize(state), 'application/json');
  }

  function importSave(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = S().deserialize(reader.result);
        closeModal('modal-saves');
        show('screen-game');
        clearLog();
        state.log.forEach(e => appendEntry(e, false));
        const out = E().resume(state);
        out.entries.forEach(e => { appendEntry(e, true); S().pushLog(state, e); });
        renderChoices(out.choices);
        renderSidebars();
        persist();
        toast('Save imported.');
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function exportTranscript() {
    if (!state) return;
    const lines = ['# The Ruler of Three Faces — Story Transcript', '',
      '*' + state.player.name + (state.player.title ? ', ' + state.player.title : '') + '*', ''];
    state.log.forEach(e => {
      if (e.type === 'scene') lines.push('', '## ' + e.text, '');
      else if (e.type === 'dialogue') lines.push('**' + e.speaker + ':** ' + e.text, '');
      else if (e.type === 'player') lines.push('> **You:** ' + e.text, '');
      else if (e.type === 'system') lines.push('*' + e.text + '*', '');
      else if (e.type === 'achievement') lines.push('*Achievement unlocked — ' + e.text + '*', '');
      else lines.push(e.text, '');
    });
    download('ruler-of-three-faces-transcript.md', lines.join('\n'), 'text/markdown');
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- mobile drawers ---------------- */

  function toggleDrawer(which) {
    const panel = which === 'left' ? $('panel-left') : $('panel-right');
    const other = which === 'left' ? $('panel-right') : $('panel-left');
    other.classList.remove('drawer-open');
    panel.classList.toggle('drawer-open');
  }

  /* ---------------- helpers & boot ---------------- */

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function bind() {
    // welcome
    $('btn-new').addEventListener('click', () => { buildCreation(); show('screen-create'); });
    $('btn-continue').addEventListener('click', () => loadGame('autosave'));
    $('btn-load').addEventListener('click', () => { renderSaveSlots(); openModal('modal-saves'); });
    $('btn-howto').addEventListener('click', () => openModal('modal-howto'));
    $('btn-settings').addEventListener('click', () => openModal('modal-settings'));

    // creation
    $('cc-begin').addEventListener('click', () => startNewGame(false));
    $('cc-skip').addEventListener('click', () => startNewGame(true));
    $('cc-back').addEventListener('click', () => show('screen-welcome'));

    // game input
    $('action-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const input = $('action-input');
      const text = input.value;
      input.value = '';
      act({ type: 'free', text });
    });

    // tabs
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // game menu
    $('btn-game-menu').addEventListener('click', () => { renderSaveSlots(); openModal('modal-saves'); });
    $('btn-game-settings').addEventListener('click', () => openModal('modal-settings'));
    $('btn-game-home').addEventListener('click', () => {
      persist();
      show('screen-welcome');
      refreshWelcome();
    });

    // saves modal extras
    $('btn-export-save').addEventListener('click', exportSave);
    $('btn-export-transcript').addEventListener('click', exportTranscript);
    $('import-save').addEventListener('change', ev => {
      if (ev.target.files[0]) importSave(ev.target.files[0]);
      ev.target.value = '';
    });

    // settings
    $('set-font').addEventListener('change', ev => { settings.fontScale = ev.target.value; saveSettings(); });
    $('set-contrast').addEventListener('change', ev => { settings.highContrast = ev.target.checked; saveSettings(); });
    $('set-motion').addEventListener('change', ev => { settings.reducedMotion = ev.target.checked; saveSettings(); });
    $('set-dyslexia').addEventListener('change', ev => { settings.dyslexiaFont = ev.target.checked; saveSettings(); });

    // modal close buttons
    document.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', () => closeModal(b.dataset.close)));
    document.querySelectorAll('.modal').forEach(m =>
      m.addEventListener('click', ev => { if (ev.target === m) m.classList.remove('open'); }));

    // mobile drawers
    $('mob-character').addEventListener('click', () => toggleDrawer('left'));
    $('mob-panels').addEventListener('click', () => toggleDrawer('right'));
  }

  function init() {
    loadSettings();
    bind();
    refreshWelcome();
    show('screen-welcome');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', ROTF.UI.init);
