/* =============================================================
   The Ruler of Three Faces — UI controller
   Built by John Saunders — https://jsip.uk
   Screens, rendering, tabs, saves, settings, modals.
   All state changes flow through RulerEngine; the UI only renders
   the events the engine returns.
   ============================================================= */
(function () {
  'use strict';

  var Data = window.RulerData;
  var Engine = window.RulerEngine;

  var LS_PREFIX = 'rot3_';
  var AUTOSAVE_KEY = LS_PREFIX + 'autosave';
  var SETTINGS_KEY = LS_PREFIX + 'settings';
  var SLOT_KEYS = [LS_PREFIX + 'slot_1', LS_PREFIX + 'slot_2', LS_PREFIX + 'slot_3'];

  var state = null;          // current game state
  var activeTab = 'inventory';
  var sessionStart = Date.now();

  var $ = function (id) { return document.getElementById(id); };

  /* =====================  Settings  ===================== */

  var settings = loadSettings();

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        fontSize: s.fontSize || 'normal',        // normal | large | xlarge
        highContrast: !!s.highContrast,
        reducedMotion: !!s.reducedMotion,
        dyslexiaFont: !!s.dyslexiaFont
      };
    } catch (e) { return { fontSize: 'normal', highContrast: false, reducedMotion: false, dyslexiaFont: false }; }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
    applySettings();
  }

  function applySettings() {
    var html = document.documentElement;
    html.classList.toggle('font-large', settings.fontSize === 'large');
    html.classList.toggle('font-xlarge', settings.fontSize === 'xlarge');
    html.classList.toggle('high-contrast', settings.highContrast);
    html.classList.toggle('reduced-motion', settings.reducedMotion);
    html.classList.toggle('font-dyslexia', settings.dyslexiaFont);
  }

  /* =====================  Persistence  ===================== */

  function persist(key, st) {
    try { localStorage.setItem(key, JSON.stringify(st)); return true; }
    catch (e) { toast('⚠️', 'Save failed', 'Browser storage is unavailable.'); return false; }
  }

  function readSave(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return Engine.validateState(JSON.parse(raw));
    } catch (e) { return null; }
  }

  function autosave() {
    if (!state) return;
    state.playtimeMs = (state.playtimeMs || 0) + (Date.now() - sessionStart);
    sessionStart = Date.now();
    persist(AUTOSAVE_KEY, state);
  }

  function saveMeta(st) {
    if (!st) return null;
    var d = new Date(st.updatedAt);
    return st.player.name + ' — ' + st.player.title + ' · ' + Data.LOCATIONS[st.location].name +
      ' · ' + (Data.LOCATIONS[st.location].chapter.split('—')[0].trim()) + ' · ' + d.toLocaleDateString();
  }

  /* =====================  Screens  ===================== */

  function show(screenId) {
    ['screen-welcome', 'screen-create', 'screen-game'].forEach(function (id) {
      $(id).hidden = (id !== screenId);
    });
    window.scrollTo(0, 0);
  }

  function refreshWelcome() {
    var auto = readSave(AUTOSAVE_KEY);
    $('btn-continue').hidden = !auto;
    $('continue-meta').hidden = !auto;
    if (auto) $('continue-meta').textContent = auto ? saveMeta(auto) : '';
  }

  /* =====================  Character creation  ===================== */

  var picked = { background: 'traveller', personality: 'curious' };

  function buildCreate() {
    var bgWrap = $('create-backgrounds');
    var pWrap = $('create-personalities');
    bgWrap.innerHTML = ''; pWrap.innerHTML = '';
    Object.keys(Data.BACKGROUNDS).forEach(function (k) {
      bgWrap.appendChild(pickCard(k, Data.BACKGROUNDS[k], 'background'));
    });
    Object.keys(Data.PERSONALITIES).forEach(function (k) {
      pWrap.appendChild(pickCard(k, Data.PERSONALITIES[k], 'personality'));
    });
    syncPicked();
  }

  function pickCard(key, def, group) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-card';
    b.dataset.key = key;
    b.dataset.group = group;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="pick-name"></span><span class="pick-blurb"></span>';
    b.querySelector('.pick-name').textContent = def.name;
    b.querySelector('.pick-blurb').textContent = def.blurb;
    b.addEventListener('click', function () {
      picked[group] = key;
      syncPicked();
    });
    return b;
  }

  function syncPicked() {
    document.querySelectorAll('.pick-card').forEach(function (el) {
      var sel = picked[el.dataset.group] === el.dataset.key;
      el.classList.toggle('selected', sel);
      el.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
  }

  function startGame(opts) {
    state = Engine.newGame(opts);
    sessionStart = Date.now();
    $('story-log').innerHTML = '';
    show('screen-game');
    renderEvents(Engine.openingEvents(state), true);
    syncAll();
    autosave();
    focusInput();
  }

  /* =====================  Scene art (inline SVG)  ===================== */

  var ART = {
    gate: art('#0b0e1a', '#141b33',
      '<path d="M0 120 L0 84 L40 52 L78 86 L120 40 L165 82 L210 58 L260 96 L300 66 L340 92 L400 60 L400 120 Z" fill="#101528"/>' +
      '<rect x="170" y="46" width="10" height="74" fill="#05060c"/><rect x="220" y="46" width="10" height="74" fill="#05060c"/>' +
      '<path d="M170 46 L175 34 L180 46 Z" fill="#05060c"/><path d="M220 46 L225 34 L230 46 Z" fill="#05060c"/>' +
      '<path d="M180 120 V64 Q200 48 220 64 V120" fill="none" stroke="#c9a353" stroke-opacity="0.5" stroke-width="2"/>' +
      '<line x1="190" y1="58" x2="190" y2="120" stroke="#c9a353" stroke-opacity="0.35"/><line x1="200" y1="54" x2="200" y2="120" stroke="#c9a353" stroke-opacity="0.35"/><line x1="210" y1="58" x2="210" y2="120" stroke="#c9a353" stroke-opacity="0.35"/>' +
      '<circle cx="330" cy="26" r="9" fill="#e8e2d2" opacity="0.55"/>'),
    hall: art('#120e0a', '#241a10',
      '<path d="M60 120 V50 Q80 26 100 50 V120 Z" fill="#0a0705"/><path d="M300 120 V50 Q320 26 340 50 V120 Z" fill="#0a0705"/>' +
      '<path d="M170 120 V40 Q200 12 230 40 V120 Z" fill="#0a0705"/>' +
      '<rect x="188" y="70" width="24" height="50" fill="#c9a353" opacity="0.22"/>' +
      '<rect x="120" y="34" width="8" height="40" fill="#5a2222" opacity="0.8"/><rect x="272" y="34" width="8" height="40" fill="#22335a" opacity="0.8"/>' +
      '<circle cx="200" cy="96" r="26" fill="#e8974f" opacity="0.13"/>'),
    corridor: art('#100c14', '#1d1526',
      '<path d="M0 120 L150 60 L250 60 L400 120 Z" fill="#0b0810"/>' +
      '<rect x="60" y="30" width="30" height="40" fill="#31241a" stroke="#c9a353" stroke-opacity="0.4"/>' +
      '<rect x="130" y="24" width="30" height="44" fill="#2a1e2e" stroke="#c9a353" stroke-opacity="0.4"/>' +
      '<rect x="240" y="24" width="30" height="44" fill="#1e2430" stroke="#c9a353" stroke-opacity="0.4"/>' +
      '<rect x="310" y="30" width="30" height="40" fill="#302030" stroke="#c9a353" stroke-opacity="0.4"/>' +
      '<circle cx="200" cy="46" r="5" fill="#e8974f" opacity="0.5"/><rect x="198" y="52" width="4" height="14" fill="#3a2c1c"/>'),
    library: art('#0e1210', '#1a241e',
      '<rect x="30" y="16" width="70" height="104" fill="#0a0f0c"/><rect x="150" y="8" width="90" height="112" fill="#0a0f0c"/><rect x="290" y="20" width="80" height="100" fill="#0a0f0c"/>' +
      '<g fill="#c9a353" opacity="0.35"><rect x="38" y="26" width="54" height="5"/><rect x="38" y="44" width="54" height="5"/><rect x="38" y="62" width="54" height="5"/><rect x="158" y="20" width="74" height="5"/><rect x="158" y="38" width="74" height="5"/><rect x="158" y="56" width="74" height="5"/><rect x="158" y="74" width="74" height="5"/><rect x="298" y="30" width="64" height="5"/><rect x="298" y="48" width="64" height="5"/></g>' +
      '<circle cx="255" cy="100" r="16" fill="#e8c877" opacity="0.14"/>'),
    gardens: art('#0a1210', '#12241c',
      '<path d="M0 120 Q100 88 200 100 Q300 112 400 92 L400 120 Z" fill="#0c1a12"/>' +
      '<circle cx="90" cy="70" r="26" fill="#10241a"/><rect x="86" y="86" width="8" height="34" fill="#0a130d"/>' +
      '<circle cx="320" cy="60" r="32" fill="#10241a"/><rect x="316" y="84" width="8" height="36" fill="#0a130d"/>' +
      '<circle cx="205" cy="84" r="12" fill="#5c1e2e"/><circle cx="205" cy="84" r="6" fill="#8f3049"/><rect x="203" y="94" width="4" height="26" fill="#1d3323"/>' +
      '<circle cx="205" cy="84" r="20" fill="none" stroke="#e8c877" stroke-opacity="0.25"/>'),
    alchemy: art('#120f14', '#231a2b',
      '<rect x="40" y="80" width="320" height="8" fill="#0c0910"/>' +
      '<path d="M110 80 V56 L98 80 Z" fill="#3f7c6a" opacity="0.8"/><rect x="106" y="46" width="8" height="14" fill="#182420"/>' +
      '<circle cx="200" cy="66" r="14" fill="#7c5a3f" opacity="0.8"/><rect x="196" y="44" width="8" height="12" fill="#241c18"/>' +
      '<path d="M290 80 V52 L302 80 Z" fill="#7c3f5c" opacity="0.8"/>' +
      '<circle cx="200" cy="60" r="3" fill="#e8c877" opacity="0.8"/><circle cx="110" cy="50" r="2.5" fill="#7ce8c8" opacity="0.7"/>'),
    dungeon: art('#0c0c10', '#16161e',
      '<path d="M120 120 L120 40 Q200 4 280 40 L280 120 Z" fill="#08080c"/>' +
      '<g stroke="#3a3a48" stroke-width="5"><line x1="150" y1="34" x2="150" y2="120"/><line x1="180" y1="24" x2="180" y2="120"/><line x1="210" y1="22" x2="210" y2="120"/><line x1="240" y1="28" x2="240" y2="120"/></g>' +
      '<circle cx="90" cy="50" r="5" fill="#e8974f" opacity="0.55"/><rect x="88" y="56" width="4" height="16" fill="#2c2118"/>' +
      '<circle cx="316" cy="50" r="5" fill="#e8974f" opacity="0.55"/><rect x="314" y="56" width="4" height="16" fill="#2c2118"/>'),
    throne: art('#14100a', '#2b2010',
      '<rect x="150" y="20" width="100" height="100" fill="#0b0805"/>' +
      '<rect x="150" y="20" width="48" height="100" fill="#0e0a06"/>' +
      '<circle cx="200" cy="52" r="20" fill="none" stroke="#c9a353" stroke-opacity="0.5" stroke-width="2"/>' +
      '<path d="M188 46 L194 56 L200 44 L206 56 L212 46 L212 60 L188 60 Z" fill="#c9a353" opacity="0.55"/>' +
      '<rect x="120" y="30" width="10" height="90" fill="#0e0a06"/><rect x="270" y="30" width="10" height="90" fill="#0e0a06"/>')
  };

  function art(sky, ground, inner) {
    return '<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">' +
      '<defs><linearGradient id="g' + sky.slice(1) + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + sky + '"/><stop offset="1" stop-color="' + ground + '"/></linearGradient></defs>' +
      '<rect width="400" height="120" fill="url(#g' + sky.slice(1) + ')"/>' + inner + '</svg>';
  }

  function renderArt() {
    var scene = Engine.currentScene(state);
    $('scene-art').innerHTML = ART[scene.art] || '';
  }

  /* =====================  Event rendering  ===================== */

  function renderEvents(events, fresh) {
    var log = $('story-log');
    events.forEach(function (e, i) {
      var el = eventElement(e);
      if (!el) return;
      if (fresh && !settings.reducedMotion) {
        el.classList.add('fresh');
        el.style.animationDelay = Math.min(i * 90, 700) + 'ms';
      }
      log.appendChild(el);
      if (fresh && e.kind === 'achievement') {
        var a = Data.ACHIEVEMENTS[e.achievementId];
        toast(a.icon, 'Achievement unlocked', a.name);
      }
    });
    log.scrollTop = log.scrollHeight;
  }

  function eventElement(e) {
    var div = document.createElement('div');
    div.className = 'log-entry';
    if (e.kind === 'scene') {
      div.classList.add('log-scene');
      div.innerHTML = '<span class="scene-chapter"></span><div class="scene-name"></div><div class="scene-rule"></div>';
      div.querySelector('.scene-chapter').textContent = e.chapter || '';
      div.querySelector('.scene-name').textContent = e.title || '';
    } else if (e.kind === 'narrative') {
      div.classList.add('log-narrative');
      div.textContent = e.text;
    } else if (e.kind === 'dialogue') {
      div.classList.add('log-dialogue');
      div.innerHTML = '<span class="speaker"></span><span class="line"></span>';
      div.querySelector('.speaker').textContent = e.speaker;
      div.querySelector('.line').textContent = e.text;
    } else if (e.kind === 'thought') {
      div.classList.add('log-thought');
      div.textContent = e.text;
    } else if (e.kind === 'system') {
      div.classList.add('log-system');
      div.textContent = e.text;
    } else if (e.kind === 'player') {
      div.classList.add('log-player');
      div.textContent = e.text;
    } else if (e.kind === 'item') {
      var item = Data.ITEMS[e.itemId];
      if (!item) return null;
      div.classList.add('log-item');
      div.innerHTML = '<span class="emblem"></span><span><span class="what">Item acquired</span><span class="name"></span><div class="desc"></div></span>';
      div.querySelector('.emblem').textContent = item.icon;
      div.querySelector('.name').textContent = item.name;
      div.querySelector('.desc').textContent = item.category + ' · ' + item.rarity;
    } else if (e.kind === 'achievement') {
      var a = Data.ACHIEVEMENTS[e.achievementId];
      if (!a) return null;
      div.classList.add('log-achievement');
      div.innerHTML = '<span class="emblem"></span><span><span class="what">Achievement unlocked</span><span class="name"></span><div class="desc"></div></span>';
      div.querySelector('.emblem').textContent = a.icon;
      div.querySelector('.name').textContent = a.name;
      div.querySelector('.desc').textContent = a.description;
    } else if (e.kind === 'quest') {
      var q = Data.QUESTS[e.questId];
      if (!q) return null;
      div.classList.add('log-quest');
      div.innerHTML = '<span class="emblem">' + (e.status === 'completed' ? '✦' : '❖') + '</span><span><span class="what"></span><span class="name"></span></span>';
      div.querySelector('.what').textContent = e.status === 'completed' ? 'Quest completed' : 'New quest';
      div.querySelector('.name').textContent = q.title;
    } else {
      return null;
    }
    return div;
  }

  function toast(emblem, what, name) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span class="emblem"></span><span><span class="what"></span><span class="name"></span></span>';
    t.querySelector('.emblem').textContent = emblem;
    t.querySelector('.what').textContent = what;
    t.querySelector('.name').textContent = name;
    $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 5200);
  }

  /* =====================  Sync panels  ===================== */

  function syncAll() {
    if (!state) return;
    var scene = Engine.currentScene(state);
    $('topbar-chapter').textContent = scene.chapter;
    $('topbar-place').textContent = scene.title;
    $('char-name').textContent = state.player.name;
    $('char-title').textContent = state.player.title;
    $('bar-health').style.width = state.player.health + '%';
    $('bar-energy').style.width = state.player.energy + '%';
    $('stat-gold').textContent = state.player.gold + ' gp';
    $('stat-influence').textContent = String(state.player.influence);
    $('stat-day').textContent = 'Day ' + state.world.day + ', ' + state.world.timeOfDay;

    var bg = Data.BACKGROUNDS[state.player.background];
    var pe = Data.PERSONALITIES[state.player.personality];
    $('char-background').innerHTML = '';
    var p1 = document.createElement('p');
    p1.textContent = bg.name + ' · ' + pe.name + ' · ' + state.player.pronouns;
    var p2 = document.createElement('p');
    p2.style.fontStyle = 'italic';
    p2.textContent = bg.blurb;
    $('char-background').append(p1, p2);

    var skills = $('char-skills');
    skills.innerHTML = '';
    Object.keys(state.player.skills).forEach(function (k) {
      var row = document.createElement('div');
      row.className = 'skill-row';
      row.innerHTML = '<span></span><b></b>';
      row.querySelector('span').textContent = k.charAt(0).toUpperCase() + k.slice(1);
      row.querySelector('b').textContent = state.player.skills[k];
      skills.appendChild(row);
    });

    renderArt();
    renderChoices();
    renderTab();
  }

  function renderChoices() {
    var wrap = $('choices');
    wrap.innerHTML = '';
    Engine.getChoices(state).forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'choice-btn';
      b.textContent = c.label;
      b.addEventListener('click', function () { act({ type: 'choice', id: c.id }, c.label); });
      wrap.appendChild(b);
    });
  }

  /* =====================  Actions  ===================== */

  function act(action, echoLabel) {
    if (!state) return;
    if (echoLabel) {
      var echo = { kind: 'player', text: echoLabel };
      state.transcript.push(echo);
      renderEvents([echo], true);
    }
    var events = Engine.perform(state, action);
    renderEvents(events, true);
    syncAll();
    autosave();
    refreshWelcome();
  }

  function focusInput() {
    if (window.matchMedia('(min-width: 761px)').matches) $('action-input').focus();
  }

  /* =====================  Tabs  ===================== */

  function renderTab() {
    var c = $('tab-content');
    c.innerHTML = '';
    var render = {
      inventory: tabInventory, characters: tabCharacters, quests: tabQuests,
      journal: tabJournal, codex: tabCodex, achievements: tabAchievements,
      map: tabMap, kingdom: tabKingdom
    }[activeTab];
    if (render) render(c);
  }

  function emptyNote(c, text) {
    var d = document.createElement('div');
    d.className = 'empty-note';
    d.textContent = text;
    c.appendChild(d);
  }

  function recordCard(opts) {
    var d = document.createElement('div');
    d.className = 'record-card' + (opts.locked ? ' locked' : '') + (opts.extraClass ? ' ' + opts.extraClass : '');
    var head = document.createElement('div');
    head.className = 'rc-head';
    if (opts.icon) {
      var ic = document.createElement('span');
      ic.className = 'rc-icon'; ic.textContent = opts.icon;
      head.appendChild(ic);
    }
    var names = document.createElement('div');
    var n = document.createElement('div'); n.className = 'rc-name'; n.textContent = opts.name;
    names.appendChild(n);
    if (opts.sub) { var s = document.createElement('div'); s.className = 'rc-sub'; s.textContent = opts.sub; names.appendChild(s); }
    head.appendChild(names);
    d.appendChild(head);
    if (opts.body) { var b = document.createElement('div'); b.className = 'rc-body'; b.textContent = opts.body; d.appendChild(b); }
    if (opts.tag) { var t = document.createElement('span'); t.className = 'rc-tag'; t.textContent = opts.tag; d.appendChild(t); }
    return d;
  }

  function tabInventory(c) {
    if (!state.inventory.length) return emptyNote(c, 'Your pack is empty. The road provides — eventually.');
    state.inventory.forEach(function (id) {
      var it = Data.ITEMS[id];
      c.appendChild(recordCard({ icon: it.icon, name: it.name, sub: it.category + ' · ' + it.rarity, body: it.description, tag: it.questItem ? 'Story item' : null }));
    });
  }

  function tabCharacters(c) {
    var met = Object.keys(state.characters).filter(function (id) { return state.characters[id].met && Data.CHARACTERS[id]; });
    if (!met.length) return emptyNote(c, 'You have met no one of note. The palace will fix that.');
    met.forEach(function (id) {
      var ch = Data.CHARACTERS[id];
      c.appendChild(recordCard({ icon: ch.portrait, name: ch.name, sub: ch.role, body: ch.blurb }));
    });
  }

  function tabQuests(c) {
    var ids = Object.keys(state.quests);
    if (!ids.length) return emptyNote(c, 'No quests yet.');
    ids.forEach(function (id) {
      var q = Data.QUESTS[id];
      var qs = state.quests[id];
      var card = recordCard({
        icon: qs.status === 'completed' ? '✦' : '❖',
        name: q.title,
        sub: q.category + (qs.status === 'completed' ? ' · Completed' : ' · Active'),
        body: q.description,
        extraClass: qs.status === 'completed' ? 'quest-completed' : ''
      });
      c.appendChild(card);
    });
  }

  function tabJournal(c) {
    if (!state.journal.length) return emptyNote(c, 'The chronicle awaits its first line.');
    state.journal.slice().reverse().forEach(function (j) {
      var d = document.createElement('div');
      d.className = 'journal-entry';
      d.innerHTML = '<div class="journal-day"></div><div class="journal-text"></div>';
      d.querySelector('.journal-day').textContent = 'Day ' + j.day;
      d.querySelector('.journal-text').textContent = j.text;
      c.appendChild(d);
    });
  }

  function tabCodex(c) {
    if (!state.codex.length) return emptyNote(c, 'The codex fills as you discover the world. It records only what you truly know.');
    state.codex.forEach(function (id) {
      var e = Data.CODEX[id];
      c.appendChild(recordCard({ icon: '❦', name: e.title, sub: e.category, body: e.text }));
    });
  }

  function tabAchievements(c) {
    Object.keys(Data.ACHIEVEMENTS).forEach(function (id) {
      var a = Data.ACHIEVEMENTS[id];
      var unlocked = !!state.achievements[id];
      if (a.hidden && !unlocked) {
        c.appendChild(recordCard({ icon: '❓', name: 'Hidden honour', sub: 'Undiscovered', body: 'Some deeds reveal themselves only when done.', locked: true }));
        return;
      }
      c.appendChild(recordCard({ icon: a.icon, name: a.name, sub: unlocked ? 'Unlocked' : 'Locked', body: a.description, locked: !unlocked }));
    });
  }

  function tabMap(c) {
    var note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'The full map of the realm — Aelthorn, Valoria, Luthyria, the Cradle of Storms — unlocks in later acts. For now, the palace:';
    c.appendChild(note);
    Object.keys(Data.LOCATIONS).forEach(function (id) {
      var visited = !!state.flags['visited_' + id] || id === state.location || (id === 'gate');
      var here = id === state.location;
      c.appendChild(recordCard({
        icon: here ? '➤' : (visited ? '·' : '?'),
        name: visited ? Data.LOCATIONS[id].name : 'Unexplored',
        sub: here ? 'You are here' : (visited ? 'Visited' : 'Not yet found'),
        locked: !visited
      }));
    });
  }

  function tabKingdom(c) {
    emptyNote(c, 'The kingdom does not yet answer to you. Governance — treasury, food, approval, armies, factions — arrives with Act III, when (and if) you rise. The realm is patient. So is the prophecy.');
  }

  /* =====================  Modals  ===================== */

  function openModal(title, buildBody) {
    $('modal-title').textContent = title;
    var body = $('modal-body');
    body.innerHTML = '';
    buildBody(body);
    $('modal-backdrop').hidden = false;
    $('modal-close').focus();
  }
  function closeModal() { $('modal-backdrop').hidden = true; }

  function modalHowTo() {
    openModal('How to Play', function (b) {
      b.innerHTML =
        '<p><b>This is a story you talk to.</b> Every scene offers suggested choices, but you can always type your own action in the “What do you do?” box — speak to people, examine things, go places, try ideas.</p>' +
        '<h3>Examples</h3>' +
        '<p>“Ask the guard for a clue” · “Look behind the portrait” · “Go to the gardens” · “Offer to help with the weeding”</p>' +
        '<p>The world responds to what you try — and it does not always say yes. Impossible or unwise actions meet believable resistance.</p>' +
        '<h3>The world remembers</h3>' +
        '<p>People remember how you treat them. Your journal records your deeds like a chronicle. The codex fills with what you have genuinely discovered — nothing more.</p>' +
        '<h3>Saving</h3>' +
        '<p>The game autosaves after every action. Use the 💾 Saves menu for named slots, exporting your save as a file, or downloading your story so far as a transcript.</p>' +
        '<h3>At the gate</h3>' +
        '<p>The knight needs a password, and his oath forbids him to reveal it. Persuade, deceive, reason, guess… or listen very carefully to how he talks about it. There is more than one way through every door in this game — even the first one.</p>';
    });
  }

  function modalSettings() {
    openModal('Settings', function (b) {
      b.appendChild(settingSelect('Text size', 'fontSize', [['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large']]));
      b.appendChild(settingSwitch('High contrast', 'highContrast'));
      b.appendChild(settingSwitch('Reduced motion', 'reducedMotion'));
      b.appendChild(settingSwitch('Dyslexia-friendly font', 'dyslexiaFont'));
      var note = document.createElement('p');
      note.style.marginTop = '0.9rem';
      note.textContent = 'Sound design (ambience, chimes) is on the roadmap and will ship with independent volume controls, off by default.';
      b.appendChild(note);
    });
  }

  function settingSwitch(label, key) {
    var row = document.createElement('div');
    row.className = 'setting-row';
    var id = 'set-' + key;
    row.innerHTML = '<label for="' + id + '"></label><span class="switch"><input type="checkbox" id="' + id + '"><span class="track"></span></span>';
    row.querySelector('label').textContent = label;
    var input = row.querySelector('input');
    input.checked = !!settings[key];
    input.addEventListener('change', function () { settings[key] = input.checked; saveSettings(); });
    return row;
  }

  function settingSelect(label, key, options) {
    var row = document.createElement('div');
    row.className = 'setting-row';
    var id = 'set-' + key;
    var lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    var sel = document.createElement('select'); sel.id = id;
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      sel.appendChild(opt);
    });
    sel.value = settings[key];
    sel.addEventListener('change', function () { settings[key] = sel.value; saveSettings(); });
    row.append(lab, sel);
    return row;
  }

  function modalSaves() {
    openModal('Saves', function (b) {
      var inGame = !!state && !$('screen-game').hidden;

      SLOT_KEYS.forEach(function (key, i) {
        var st = readSave(key);
        var row = document.createElement('div');
        row.className = 'save-slot';
        var meta = document.createElement('div');
        meta.className = 'ss-meta';
        meta.innerHTML = '<div class="ss-name"></div><div class="ss-sub"></div>';
        meta.querySelector('.ss-name').textContent = 'Slot ' + (i + 1);
        meta.querySelector('.ss-sub').textContent = st ? saveMeta(st) : 'Empty';
        var actions = document.createElement('div');
        actions.className = 'ss-actions';
        if (inGame) {
          var save = document.createElement('button');
          save.className = 'btn btn-outline'; save.textContent = st ? 'Overwrite' : 'Save';
          save.addEventListener('click', function () {
            if (st && !confirm('Overwrite Slot ' + (i + 1) + '?\n' + saveMeta(st))) return;
            autosave();
            persist(key, state);
            toast('💾', 'Game saved', 'Slot ' + (i + 1));
            modalSaves();
          });
          actions.appendChild(save);
        }
        if (st) {
          var load = document.createElement('button');
          load.className = 'btn btn-gold'; load.textContent = 'Load';
          load.addEventListener('click', function () { loadState(st); closeModal(); });
          actions.appendChild(load);
          var del = document.createElement('button');
          del.className = 'btn btn-ghost'; del.textContent = '✕'; del.title = 'Delete save';
          del.setAttribute('aria-label', 'Delete slot ' + (i + 1));
          del.addEventListener('click', function () {
            if (!confirm('Delete the save in Slot ' + (i + 1) + '? This cannot be undone.')) return;
            localStorage.removeItem(key);
            modalSaves();
          });
          actions.appendChild(del);
        }
        row.append(meta, actions);
        b.appendChild(row);
      });

      var h = document.createElement('h3'); h.textContent = 'Files';
      b.appendChild(h);
      var fileRow = document.createElement('div');
      fileRow.style.display = 'flex'; fileRow.style.flexWrap = 'wrap'; fileRow.style.gap = '0.5rem';

      if (inGame) {
        fileRow.appendChild(fileBtn('Export save (JSON)', function () {
          autosave();
          download(slug(state.player.name) + '-save.json', JSON.stringify(state, null, 2), 'application/json');
        }));
        fileRow.appendChild(fileBtn('Export transcript (Markdown)', function () {
          download(slug(state.player.name) + '-story.md', transcriptMarkdown(state), 'text/markdown');
        }));
      }
      fileRow.appendChild(fileBtn('Import save (JSON)', function () {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = '.json,application/json';
        input.addEventListener('change', function () {
          var f = input.files[0];
          if (!f) return;
          f.text().then(function (txt) {
            var st = null;
            try { st = Engine.validateState(JSON.parse(txt)); } catch (e) { /* fallthrough */ }
            if (!st) { alert('That file is not a valid save for this version of the game.'); return; }
            loadState(st);
            closeModal();
          });
        });
        input.click();
      }));
      b.appendChild(fileRow);
    });
  }

  function fileBtn(label, fn) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.textContent = label;
    btn.addEventListener('click', fn);
    return btn;
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'traveller'; }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function transcriptMarkdown(st) {
    var lines = ['# The Ruler of Three Faces — Story Transcript', '',
      '**' + st.player.name + '**, ' + st.player.title + ' · exported ' + new Date().toLocaleString(), ''];
    st.transcript.forEach(function (e) {
      if (e.kind === 'scene') lines.push('', '## ' + e.title, '*' + (e.chapter || '') + '*', '');
      else if (e.kind === 'narrative') lines.push(e.text, '');
      else if (e.kind === 'dialogue') lines.push('**' + e.speaker + ':** ' + e.text, '');
      else if (e.kind === 'thought') lines.push('*' + e.text + '*', '');
      else if (e.kind === 'player') lines.push('> ' + e.text, '');
      else if (e.kind === 'system') lines.push('`' + e.text + '`', '');
      else if (e.kind === 'item' && Data.ITEMS[e.itemId]) lines.push('`Item acquired: ' + Data.ITEMS[e.itemId].name + '`', '');
      else if (e.kind === 'achievement' && Data.ACHIEVEMENTS[e.achievementId]) lines.push('`Achievement: ' + Data.ACHIEVEMENTS[e.achievementId].name + '`', '');
    });
    lines.push('', '---', '', '### Chronicle');
    st.journal.forEach(function (j) { lines.push('- **Day ' + j.day + ':** ' + j.text); });
    return lines.join('\n');
  }

  /* =====================  Load game  ===================== */

  function loadState(st) {
    state = st;
    sessionStart = Date.now();
    show('screen-game');
    var log = $('story-log');
    log.innerHTML = '';
    // Re-render the recent transcript so the player lands mid-story, not in a void.
    renderEvents(state.transcript.slice(-40), false);
    var note = document.createElement('div');
    note.className = 'log-entry log-system';
    note.textContent = '— Story resumed. Welcome back, ' + state.player.name + '. —';
    log.appendChild(note);
    log.scrollTop = log.scrollHeight;
    syncAll();
    autosave();
    focusInput();
  }

  /* =====================  Debug (append ?debug=1)  ===================== */

  function setupDebug() {
    if (!/[?&]debug=1/.test(location.search)) return;
    var btn = document.createElement('button');
    btn.className = 'topbar-btn';
    btn.textContent = '🐞';
    btn.title = 'Debug: inspect state';
    btn.addEventListener('click', function () {
      openModal('Debug — Game State', function (b) {
        var pre = document.createElement('pre');
        pre.style.cssText = 'font-size:0.72rem;white-space:pre-wrap;word-break:break-all;font-family:monospace;color:var(--ink-dim)';
        pre.textContent = state ? JSON.stringify(state, null, 2) : 'No active game.';
        b.appendChild(pre);
      });
    });
    document.querySelector('.topbar-actions').appendChild(btn);
  }

  /* =====================  Wiring  ===================== */

  function wire() {
    // Welcome
    $('btn-new').addEventListener('click', function () { buildCreate(); show('screen-create'); });
    $('btn-continue').addEventListener('click', function () {
      var st = readSave(AUTOSAVE_KEY);
      if (st) loadState(st);
    });
    $('btn-load').addEventListener('click', modalSaves);
    $('btn-howto').addEventListener('click', modalHowTo);
    $('btn-settings-welcome').addEventListener('click', modalSettings);

    // Create
    $('create-pronouns').addEventListener('change', function () {
      $('create-pronouns-custom').hidden = this.value !== 'custom';
    });
    $('btn-begin').addEventListener('click', function () {
      var pron = $('create-pronouns').value;
      if (pron === 'custom') pron = $('create-pronouns-custom').value || 'they/them';
      startGame({
        name: $('create-name').value,
        pronouns: pron,
        background: picked.background,
        personality: picked.personality
      });
    });
    $('btn-skip').addEventListener('click', function () { startGame({}); });
    $('btn-create-back').addEventListener('click', function () { show('screen-welcome'); refreshWelcome(); });

    // Game topbar
    $('btn-home').addEventListener('click', function () {
      autosave();
      show('screen-welcome');
      refreshWelcome();
    });
    $('btn-saves').addEventListener('click', modalSaves);
    $('btn-settings').addEventListener('click', modalSettings);

    // Action input
    $('action-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = $('action-input').value.trim();
      if (!text) return;
      $('action-input').value = '';
      act({ type: 'text', text: text }, text);
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        activeTab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === t); });
        renderTab();
      });
    });

    // Mobile drawers
    document.querySelectorAll('.mobile-nav button').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.dataset.drawer;
        $('panel-left').classList.toggle('open', which === 'left' && !$('panel-left').classList.contains('open'));
        $('panel-right').classList.toggle('open', which === 'right' && !$('panel-right').classList.contains('open'));
        document.querySelectorAll('.mobile-nav button').forEach(function (x) {
          x.classList.toggle('active', x === b || (which !== 'left' && which !== 'right' && x.dataset.drawer === 'story'));
        });
        if (which === 'story') {
          $('panel-left').classList.remove('open');
          $('panel-right').classList.remove('open');
        }
      });
    });

    // Modal
    $('modal-close').addEventListener('click', closeModal);
    $('modal-backdrop').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal-backdrop').hidden) closeModal();
    });

    window.addEventListener('beforeunload', autosave);
    setupDebug();
  }

  applySettings();
  wire();
  refreshWelcome();
})();
