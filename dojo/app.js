/* The Dojo — app layer.
 *
 * Owns persistence, the lock, the session, and all rendering. The crypto lives
 * in store.js and the cards in deck.js.
 *
 * Threat model, stated plainly so it does not drift:
 *   - The page is public. The data is not: localStorage is per origin, per
 *     browser, per device, and nothing is ever sent anywhere.
 *   - The realistic risk is someone opening this page on an unlocked device,
 *     so the store is encrypted at rest with a passphrase and auto-locks.
 *   - The derived key lives in memory only, never in storage.
 *   - Encryption cannot protect data from someone who has both the device and
 *     the passphrase, and a forgotten passphrase means the data is gone. Both
 *     are said out loud in the UI rather than buried here.
 */
(function () {
  'use strict';

  var Store = window.DojoStore;
  var CATS = window.DojoDeck.CATS;
  var BASE_DECK = window.DojoDeck.DECK;

  var KEY = 'dojo:v1';
  var DAY = 86400000;

  /* ------------------------------------------------------------------ state */
  var blank = function () {
    return {
      reps: [], sched: {}, bank: [], custom: [],
      timerLen: 0, lastRepDay: null, streak: 0, lockMins: 15
    };
  };

  var state = blank();
  var session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
  var current = null, scores = {}, verdict = null, kept = false;
  var timerId = null, remaining = 0;
  var idleTimer = null, lastActive = Date.now();
  var editingCardId = null;

  var $ = function (id) { return document.getElementById(id); };
  var today = function () { return new Date().toISOString().slice(0, 10); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function deck() { return BASE_DECK.concat(state.custom || []); }
  function cardById(id) {
    var all = deck();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ------------------------------------------------------------ persistence */
  function readRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeRaw(envelope) {
    try {
      localStorage.setItem(KEY, JSON.stringify(envelope));
      return true;
    } catch (e) {
      toast('Could not save. Storage may be full or blocked.');
      return false;
    }
  }

  /* Saves are fire and forget from the UI's point of view, but they must not
     interleave: two encrypts finishing out of order would persist stale data. */
  var savePending = Promise.resolve();
  function save() {
    savePending = savePending.then(function () {
      if (!session.encrypted) {
        writeRaw(Store.plainEnvelope(state));
        return;
      }
      if (!session.key) return;
      return Store.reseal(state, session.key, session.salt, session.iter)
        .then(writeRaw)
        .catch(function () { toast('Could not save.'); });
    });
    return savePending;
  }

  /* ------------------------------------------------------------------- lock */
  function showLock(mode) {
    ['viewLock', 'viewHome', 'viewRep', 'viewReview', 'viewBank', 'viewCards'].forEach(function (id) {
      $(id).hidden = (id !== 'viewLock');
    });
    $('appNav').hidden = true;
    $('lockMode').value = mode;

    var isNew = mode === 'new';
    $('lockTitle').textContent = isNew ? 'Set a passphrase' : 'Locked';
    $('lockBlurb').innerHTML = isNew
      ? 'This page is public. Your answers are not: they stay in this browser and are never sent anywhere. A passphrase encrypts them at rest, so someone picking up your unlocked laptop still cannot read them.<br><br><strong>There is no recovery.</strong> Forget it and the data is gone, which is the point of it working.'
      : 'Enter your passphrase to unlock this browser’s store.';
    $('lockPass2Wrap').hidden = !isNew;
    $('lockSkipWrap').hidden = !isNew;
    $('lockPass').value = '';
    $('lockPass2').value = '';
    $('lockErr').textContent = '';
    $('lockGo').textContent = isNew ? 'Encrypt and start' : 'Unlock';
    setTimeout(function () { $('lockPass').focus(); }, 60);
  }

  function lock() {
    stopTimer();
    session.key = null;
    session.unlocked = false;
    current = null;
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    showLock('unlock');
  }

  function enterApp() {
    session.unlocked = true;
    $('viewLock').hidden = true;
    $('appNav').hidden = false;
    $('btnLock').hidden = !session.encrypted;
    renderHome();
    renderBank();
    renderCards();
    show('viewHome');
    startIdleWatch();
  }

  function startIdleWatch() {
    if (idleTimer) clearInterval(idleTimer);
    if (!session.encrypted || !state.lockMins) return;
    lastActive = Date.now();
    idleTimer = setInterval(function () {
      if (Date.now() - lastActive > state.lockMins * 60000) lock();
    }, 15000);
  }
  function poke() { lastActive = Date.now(); }

  function handleLockSubmit() {
    var mode = $('lockMode').value;
    var pass = $('lockPass').value;
    var err = $('lockErr');
    err.textContent = '';

    if (mode === 'new') {
      if (pass.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      if (pass !== $('lockPass2').value) { err.textContent = 'The two passphrases do not match.'; return; }
      busy(true);
      Store.seal(state, pass).then(function (res) {
        session.key = res.key; session.salt = res.salt; session.iter = res.iter;
        session.encrypted = true;
        writeRaw(res.envelope);
        busy(false);
        enterApp();
        toast('Encrypted');
      }).catch(function (e) { busy(false); err.textContent = e.message; });
      return;
    }

    if (!pass) { err.textContent = 'Enter your passphrase.'; return; }
    busy(true);
    Store.unseal(readRaw(), pass).then(function (res) {
      state = Object.assign(blank(), res.data);
      session.key = res.key; session.salt = res.salt; session.iter = res.iter;
      session.encrypted = true;
      busy(false);
      enterApp();
    }).catch(function (e) {
      busy(false);
      err.textContent = e.message;
      $('lockPass').select();
    });
  }

  function busy(on) {
    $('lockGo').disabled = on;
    $('lockGo').textContent = on ? 'Working…' : ($('lockMode').value === 'new' ? 'Encrypt and start' : 'Unlock');
  }

  /* --------------------------------------------------------------- schedule */
  /* SM-2, simplified. Fumbled resets to tomorrow; the rest grow. Capped at 120
     days so nothing silently disappears for good. */
  function schedule(cardId, v) {
    var s = state.sched[cardId] || { interval: 0, reps: 0, lapses: 0 };
    s.reps++;
    if (v === 'fumbled') { s.interval = 1; s.lapses++; }
    else if (v === 'ok') { s.interval = Math.max(3, Math.round((s.interval || 2) * 1.7)); }
    else { s.interval = Math.max(6, Math.round((s.interval || 3) * 2.4)); }
    s.interval = Math.min(s.interval, 120);
    s.due = Date.now() + s.interval * DAY;
    s.last = v;
    state.sched[cardId] = s;
    return s;
  }

  function dueCards() {
    return deck().filter(function (c) {
      var s = state.sched[c.id];
      return !s || !s.due || s.due <= Date.now();
    });
  }

  function pickCard(cat) {
    var pool = dueCards();
    if (cat) pool = pool.filter(function (c) { return c.cat === cat; });
    if (!pool.length) {
      pool = cat ? deck().filter(function (c) { return c.cat === cat; }) : deck().slice();
      if (!pool.length) return null;
      return pool.reduce(function (a, c) {
        var d = (state.sched[c.id] && state.sched[c.id].due) || 0;
        var ad = (state.sched[a.id] && state.sched[a.id].due) || 0;
        return d < ad ? c : a;
      }, pool[0]);
    }
    var unseen = pool.filter(function (c) { return !state.sched[c.id]; });
    var list = unseen.length ? unseen : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ------------------------------------------------------------------ views */
  var VIEWS = ['viewHome', 'viewRep', 'viewReview', 'viewBank', 'viewCards'];
  function show(v) {
    VIEWS.forEach(function (id) { $(id).hidden = (id !== v); });
    $('viewLock').hidden = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderHome() {
    var due = dueCards().length;
    $('duePill').innerHTML = due
      ? '<span class="due-pill">' + due + ' card' + (due === 1 ? '' : 's') + ' ready for you</span>'
      : '<span class="due-pill">All caught up. Anything now is a bonus rep.</span>';

    var total = state.reps.length;
    var last7 = state.reps.filter(function (r) { return Date.now() - r.ts < 7 * DAY; }).length;
    var avg = total ? (state.reps.reduce(function (a, r) { return a + r.total; }, 0) / total).toFixed(1) : '0';
    $('stats').innerHTML = [
      [total, 'reps'], [last7, 'this week'], [state.streak || 0, 'day streak'], [avg + '/9', 'avg score']
    ].map(function (p) {
      return '<div class="stat"><b>' + p[0] + '</b><span>' + p[1] + '</span></div>';
    }).join('');

    document.querySelectorAll('[data-timer]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.timer) === state.timerLen));
    });

    $('cats').innerHTML = Object.keys(CATS).map(function (id) {
      var c = CATS[id];
      var rs = state.reps.filter(function (r) { return r.cat === id; });
      var cards = deck().filter(function (k) { return k.cat === id; }).length;
      var dueN = dueCards().filter(function (k) { return k.cat === id; }).length;
      var avgS = rs.length ? rs.reduce(function (a, r) { return a + r.total; }, 0) / rs.length : 0;
      var pct = rs.length ? Math.round((avgS / 9) * 100) : 0;
      return '<button class="cat" data-cat="' + id + '" style="--c:' + c.colour + '">' +
        '<span><span class="cat-name">' + c.label + '</span><br>' +
        '<span class="cat-sub">' + cards + ' cards' + (dueN ? ' · ' + dueN + ' due' : '') +
        (rs.length ? ' · ' + rs.length + ' rep' + (rs.length === 1 ? '' : 's') : ' · not started') +
        '</span></span>' +
        '<span class="bar-track"' + (rs.length ? '' : ' style="visibility:hidden"') +
        '><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="cat-score">' + (rs.length ? avgS.toFixed(1) : '') + '</span></button>';
    }).join('');
  }

  /* -------------------------------------------------------------------- rep */
  function startRep(cat) {
    var card = pickCard(cat);
    if (!card) { toast('No cards in that category yet.'); return; }
    current = card;
    scores = {}; verdict = null; kept = false;
    var c = CATS[current.cat];
    $('repCat').textContent = c.label;
    $('repCat').style.setProperty('--c', c.colour);
    $('repPrompt').textContent = current.prompt;
    $('repSetting').textContent = current.setting || '';
    $('answer').value = '';
    show('viewRep');
    startTimer();
    setTimeout(function () { $('answer').focus(); }, 60);
  }

  function startTimer() {
    stopTimer();
    var t = $('timer');
    if (!state.timerLen) { t.hidden = true; return; }
    remaining = state.timerLen;
    t.hidden = false;
    t.className = 'timer';
    paint();
    timerId = setInterval(function () {
      remaining--;
      paint();
      if (remaining <= 0) { stopTimer(); t.classList.add('out'); t.textContent = 'Time'; }
    }, 1000);

    function paint() {
      var m = Math.floor(Math.max(remaining, 0) / 60);
      var s = Math.max(remaining, 0) % 60;
      t.textContent = m + ':' + String(s).padStart(2, '0');
      t.classList.toggle('low', remaining <= 15 && remaining > 0);
    }
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  /* ----------------------------------------------------------------- review */
  function reveal() {
    stopTimer();
    var c = CATS[current.cat];
    $('revCat').textContent = c.label;
    $('revCat').style.setProperty('--c', c.colour);

    $('shape').innerHTML =
      '<h3>The shape of a good answer</h3><ol>' +
      current.shape.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol><p class="watch"><b>Watch for:</b> ' + esc(current.watch) + '</p>';

    var ans = $('answer').value.trim();
    $('yours').hidden = !ans;
    $('yourText').textContent = ans;
    $('btnKeep').disabled = !ans;
    $('keepHint').textContent = ans
      ? 'Keep the answer if it is one you would use again.'
      : 'Nothing typed this time, so there is nothing to keep. That is a valid rep.';

    document.querySelectorAll('.scale').forEach(function (sc) {
      sc.innerHTML = [1, 2, 3].map(function (n) {
        return '<button class="sc" data-score="' + n + '" aria-pressed="false" aria-label="' +
          sc.dataset.axis + ' ' + n + ' of 3">' + n + '</button>';
      }).join('');
    });
    document.querySelectorAll('.vb').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    $('btnNext').disabled = true;
    $('nextNote').textContent = '';
    $('btnKeep').textContent = 'Keep this answer';
    show('viewReview');
  }

  function commit() {
    var total = (scores.clarity || 0) + (scores.evidence || 0) + (scores.control || 0);
    var s = schedule(current.id, verdict);
    state.reps.push({ id: current.id, cat: current.cat, ts: Date.now(), total: total, verdict: verdict,
                      clarity: scores.clarity, evidence: scores.evidence, control: scores.control });

    var d = today();
    if (state.lastRepDay !== d) {
      var yest = new Date(Date.now() - DAY).toISOString().slice(0, 10);
      state.streak = (state.lastRepDay === yest) ? (state.streak || 0) + 1 : 1;
      state.lastRepDay = d;
    }
    save();
    $('nextNote').textContent = 'Back in ' + s.interval + ' day' + (s.interval === 1 ? '' : 's') + '.';
    $('btnNext').disabled = false;
  }

  function keepAnswer() {
    var text = $('answer').value.trim();
    if (!text || kept) return;
    state.bank = state.bank.filter(function (b) { return !(b.cardId === current.id && b.text === text); });
    state.bank.unshift({ id: uid(), cardId: current.id, cat: current.cat,
                         prompt: current.prompt, text: text, ts: Date.now() });
    kept = true;
    $('btnKeep').textContent = 'Kept';
    save();
    renderBank();
    toast('Added to your answer bank');
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ------------------------------------------------------------------- bank */
  function renderBank() {
    if (!state.bank.length) {
      $('bankList').innerHTML =
        '<div class="empty"><h3>Nothing kept yet</h3>' +
        '<p>When a rep produces an answer you would genuinely use again, keep it. Those answers become the thing you take with you.</p></div>';
      return;
    }
    $('bankList').innerHTML = state.bank.map(function (b) {
      var c = CATS[b.cat] || { colour: '#6c63ff', label: 'Card' };
      return '<article class="bank-item" style="--c:' + c.colour + '">' +
        '<div class="bank-q">' + esc(b.prompt) + '</div>' +
        '<div class="bank-a">' + esc(b.text) + '</div>' +
        '<div class="bank-meta"><span>' + c.label + '</span>' +
        '<button class="icon danger" data-delbank="' + b.id + '">Remove</button></div></article>';
    }).join('');
  }

  function buildPack() {
    var lines = [
      '# My answer bank', '',
      state.bank.length + ' answer' + (state.bank.length === 1 ? '' : 's') +
        ' I have practised and would use again. Exported ' + today() + '.', '',
      'These are my own positions, in my own words, tested in practice. When drafting',
      'anything customer facing, match this voice and reuse these arguments. Do not',
      'invent product claims, statistics or competitor gaps that do not appear here.', ''
    ];
    Object.keys(CATS).forEach(function (id) {
      var group = state.bank.filter(function (b) { return b.cat === id; });
      if (!group.length) return;
      lines.push('## ' + CATS[id].label, '');
      group.forEach(function (b) { lines.push('**' + b.prompt + '**', '', b.text.trim(), ''); });
    });
    if (!state.bank.length) lines.push('_Nothing kept yet._');
    return lines.join('\n');
  }

  /* ------------------------------------------------------------ custom cards */
  function renderCards() {
    var list = state.custom || [];
    $('cardCount').textContent = list.length
      ? list.length + ' of your own, on top of the ' + BASE_DECK.length + ' built in'
      : 'You have ' + BASE_DECK.length + ' built-in cards and none of your own yet';
    if (!list.length) {
      $('cardList').innerHTML =
        '<div class="empty"><h3>Add the ones that actually happen to you</h3>' +
        '<p>The built-in deck is vendor neutral on purpose. Your own cards are where the real objections go: the ones with your product, your competitors and your accounts in them.</p></div>';
      return;
    }
    $('cardList').innerHTML = list.map(function (c) {
      var cat = CATS[c.cat] || { colour: '#6c63ff', label: 'Card' };
      return '<article class="bank-item" style="--c:' + cat.colour + '">' +
        '<div class="bank-q">' + esc(c.prompt) + '</div>' +
        (c.setting ? '<div class="bank-a" style="color:var(--muted)">' + esc(c.setting) + '</div>' : '') +
        '<div class="bank-meta"><span>' + cat.label + '</span>' +
        '<button class="icon" data-editcard="' + c.id + '">Edit</button>' +
        '<button class="icon danger" data-delcard="' + c.id + '">Delete</button></div></article>';
    }).join('');
  }

  function openCardDialog(id) {
    editingCardId = id || null;
    var c = id ? cardById(id) : null;
    $('cardDlgTitle').textContent = c ? 'Edit card' : 'Add a card';
    $('cPrompt').value = c ? c.prompt : '';
    $('cSetting').value = c ? (c.setting || '') : '';
    $('cShape').value = c ? (c.shape || []).join('\n') : '';
    $('cWatch').value = c ? (c.watch || '') : '';
    var cat = c ? c.cat : 'objection';
    $('cCat').innerHTML = Object.keys(CATS).map(function (k) {
      return '<option value="' + k + '"' + (k === cat ? ' selected' : '') + '>' + CATS[k].label + '</option>';
    }).join('');
    $('btnDelCard').hidden = !c;
    $('dlgCard').showModal();
    setTimeout(function () { $('cPrompt').focus(); }, 50);
  }

  function saveCard() {
    var prompt = $('cPrompt').value.trim();
    if (!prompt) { $('cPrompt').focus(); return; }
    var shape = $('cShape').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!shape.length) shape = ['Answer it in your own structure, then write down what that structure was.'];
    var card = {
      id: editingCardId || ('u' + uid()),
      cat: $('cCat').value,
      prompt: prompt,
      setting: $('cSetting').value.trim(),
      shape: shape,
      watch: $('cWatch').value.trim() || 'Whatever you usually get wrong here.'
    };
    if (editingCardId) {
      state.custom = state.custom.map(function (c) { return c.id === editingCardId ? card : c; });
    } else {
      state.custom.push(card);
    }
    save();
    $('dlgCard').close();
    renderCards();
    renderHome();
    toast(editingCardId ? 'Card updated' : 'Card added');
  }

  function deleteCard(id) {
    var c = cardById(id);
    if (!c || !confirm('Delete this card?\n\n' + c.prompt)) return;
    state.custom = state.custom.filter(function (x) { return x.id !== id; });
    delete state.sched[id];
    state.reps = state.reps.filter(function (r) { return r.id !== id; });
    save();
    renderCards();
    renderHome();
    toast('Deleted');
  }

  /* ------------------------------------------------------------------- data */
  function download(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function exportEncrypted() {
    if (!session.encrypted || !session.key) { toast('Set a passphrase first.'); return; }
    Store.reseal(state, session.key, session.salt, session.iter).then(function (env) {
      download(env, 'dojo-encrypted-' + today() + '.json');
      toast('Encrypted backup saved');
    });
  }

  function exportPlain() {
    if (!confirm('This file is NOT encrypted.\n\nAnyone who opens it can read every kept answer. Only do this if you are putting it somewhere you trust.\n\nContinue?')) return;
    download(Store.plainEnvelope(state), 'dojo-plain-' + today() + '.json');
    toast('Plain backup saved');
  }

  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var env;
      try { env = JSON.parse(r.result); } catch (e) { toast('That file could not be read'); return; }
      if (!Store.isEnvelope(env)) { toast('That is not a Dojo backup'); return; }

      if (Store.isEncrypted(env)) {
        var pass = prompt('That backup is encrypted. Enter the passphrase it was saved with:');
        if (!pass) return;
        Store.unseal(env, pass).then(function (res) { merge(res.data); })
          .catch(function (e) { toast(e.message); });
      } else {
        Store.unseal(env).then(function (res) { merge(res.data); })
          .catch(function () { toast('That file could not be read'); });
      }
    };
    r.readAsText(file);
  }

  /* Merge rather than replace, so importing a backup onto a device that has
     been used since does not throw away the newer reps. */
  function merge(incoming) {
    if (!incoming || typeof incoming !== 'object') { toast('Nothing to import'); return; }
    var added = 0;

    var haveReps = {};
    state.reps.forEach(function (r) { haveReps[r.id + '|' + r.ts] = true; });
    (incoming.reps || []).forEach(function (r) {
      if (r && !haveReps[r.id + '|' + r.ts]) { state.reps.push(r); added++; }
    });
    state.reps.sort(function (a, b) { return a.ts - b.ts; });

    Object.keys(incoming.sched || {}).forEach(function (k) {
      var mine = state.sched[k], theirs = incoming.sched[k];
      if (!mine || (theirs.reps || 0) > (mine.reps || 0)) state.sched[k] = theirs;
    });

    var haveBank = {};
    state.bank.forEach(function (b) { haveBank[b.cardId + '|' + b.text] = true; });
    (incoming.bank || []).forEach(function (b) {
      if (b && b.text && !haveBank[b.cardId + '|' + b.text]) { state.bank.push(b); added++; }
    });

    var haveCards = {};
    state.custom.forEach(function (c) { haveCards[c.id] = true; });
    (incoming.custom || []).forEach(function (c) {
      if (c && c.id && !haveCards[c.id]) { state.custom.push(c); added++; }
    });

    if (typeof incoming.streak === 'number') state.streak = Math.max(state.streak || 0, incoming.streak);
    save();
    renderHome(); renderBank(); renderCards();
    toast(added ? 'Imported ' + added + ' item' + (added === 1 ? '' : 's') : 'Nothing new to import');
  }

  /* ---------------------------------------------------- passphrase changes */
  function setPassphrase(newPass) {
    return Store.seal(state, newPass).then(function (res) {
      session.key = res.key; session.salt = res.salt; session.iter = res.iter;
      session.encrypted = true;
      writeRaw(res.envelope);
      $('btnLock').hidden = false;
      startIdleWatch();
    });
  }

  function removePassphrase() {
    if (!confirm('Remove encryption?\n\nYour answers will be stored in this browser as readable text. Anyone with access to this device and browser profile could read them.\n\nContinue?')) return;
    session.encrypted = false;
    session.key = null; session.salt = null; session.iter = null;
    writeRaw(Store.plainEnvelope(state));
    $('btnLock').hidden = true;
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    $('dlgData').close();
    renderSecurity();
    toast('Encryption removed');
  }

  function renderSecurity() {
    $('secState').innerHTML = session.encrypted
      ? '<span class="ok-dot"></span>Encrypted at rest with your passphrase. Auto-locks after ' + state.lockMins + ' minutes idle.'
      : '<span class="warn-dot"></span>Not encrypted. Stored as readable text in this browser.';
    $('btnSetPass').textContent = session.encrypted ? 'Change passphrase' : 'Set a passphrase';
    $('btnDropPass').hidden = !session.encrypted;
    $('lockMinsWrap').hidden = !session.encrypted;
    document.querySelectorAll('[data-lockmins]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.lockmins) === state.lockMins));
    });
    $('btnExportEnc').disabled = !session.encrypted;
  }

  /* ------------------------------------------------------------------ toast */
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2100);
  }

  function copy(text) {
    var done = function () { toast('Copied'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* ------------------------------------------------------------------- boot */
  function boot() {
    var raw = readRaw();

    if (!raw) {
      showLock('new');                       // first run: offer encryption up front
    } else if (Store.isEncrypted(raw)) {
      session.encrypted = true;
      showLock('unlock');
    } else {
      Store.unseal(raw).then(function (res) {
        state = Object.assign(blank(), res.data);
        session.encrypted = false;
        enterApp();
      }).catch(function () {
        showLock('new');
      });
    }
    wire();
  }

  function wire() {
    $('lockGo').addEventListener('click', handleLockSubmit);
    $('lockForm').addEventListener('submit', function (e) { e.preventDefault(); handleLockSubmit(); });
    $('lockSkip').addEventListener('click', function () {
      session.encrypted = false;
      writeRaw(Store.plainEnvelope(state));
      enterApp();
    });
    $('btnLock').addEventListener('click', lock);

    $('btnStart').addEventListener('click', function () { startRep(null); });
    $('cats').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) startRep(b.dataset.cat);
    });
    document.querySelectorAll('[data-timer]').forEach(function (b) {
      b.addEventListener('click', function () { state.timerLen = Number(b.dataset.timer); save(); renderHome(); });
    });

    $('btnReveal').addEventListener('click', reveal);
    $('btnQuit').addEventListener('click', function () { stopTimer(); renderHome(); show('viewHome'); });
    $('answer').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); reveal(); }
    });

    document.querySelector('.rubric').addEventListener('click', function (e) {
      var b = e.target.closest('[data-score]');
      if (!b) return;
      var scale = b.closest('.scale');
      scale.querySelectorAll('.sc').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      scores[scale.dataset.axis] = Number(b.dataset.score);
      if (verdict) commit();
    });

    $('verdict').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (!b) return;
      document.querySelectorAll('.vb').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      verdict = b.dataset.v;
      commit();
    });

    $('btnKeep').addEventListener('click', keepAnswer);
    $('btnNext').addEventListener('click', function () { startRep(null); });

    $('navHome').addEventListener('click', function () { stopTimer(); renderHome(); show('viewHome'); });
    $('navBank').addEventListener('click', function () { stopTimer(); renderBank(); show('viewBank'); });
    $('navCards').addEventListener('click', function () { stopTimer(); renderCards(); show('viewCards'); });

    $('bankList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-delbank]');
      if (!b) return;
      state.bank = state.bank.filter(function (x) { return x.id !== b.dataset.delbank; });
      save(); renderBank(); toast('Removed');
    });

    $('btnAddCard').addEventListener('click', function () { openCardDialog(null); });
    $('cardList').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-editcard]');
      if (ed) { openCardDialog(ed.dataset.editcard); return; }
      var dl = e.target.closest('[data-delcard]');
      if (dl) deleteCard(dl.dataset.delcard);
    });
    $('btnSaveCard').addEventListener('click', saveCard);
    $('btnDelCard').addEventListener('click', function () {
      var id = editingCardId;
      $('dlgCard').close();
      if (id) deleteCard(id);
    });

    $('btnPack').addEventListener('click', function () { $('packOut').value = buildPack(); $('dlgPack').showModal(); });
    $('btnCopyPack').addEventListener('click', function () { copy($('packOut').value); });

    $('btnData').addEventListener('click', function () { renderSecurity(); $('dlgData').showModal(); });
    $('btnExportEnc').addEventListener('click', exportEncrypted);
    $('btnExportPlain').addEventListener('click', exportPlain);
    $('btnImport').addEventListener('click', function () { $('file').click(); });
    $('file').addEventListener('change', function (e) {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });

    $('btnSetPass').addEventListener('click', function () {
      var p1 = prompt(session.encrypted
        ? 'New passphrase (at least 8 characters). Your existing data is re-encrypted with it.'
        : 'Choose a passphrase (at least 8 characters).\n\nThere is no recovery: forget it and the data is gone.');
      if (!p1) return;
      if (p1.length < 8) { toast('Use at least 8 characters'); return; }
      var p2 = prompt('Type it again to confirm.');
      if (p1 !== p2) { toast('They did not match'); return; }
      setPassphrase(p1).then(function () { renderSecurity(); toast('Passphrase set'); });
    });
    $('btnDropPass').addEventListener('click', removePassphrase);
    document.querySelectorAll('[data-lockmins]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lockMins = Number(b.dataset.lockmins);
        save(); renderSecurity(); startIdleWatch();
      });
    });

    $('btnReset').addEventListener('click', function () {
      if (!confirm('Erase all reps, scores, schedule, kept answers and your own cards?\n\nThis clears only The Dojo. Nothing else in this browser is touched. It cannot be undone.')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
      state = blank();
      session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
      $('dlgData').close();
      showLock('new');
      toast('Erased');
    });

    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });

    ['click', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, poke, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && session.encrypted && session.unlocked &&
          state.lockMins && Date.now() - lastActive > state.lockMins * 60000) {
        lock();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
