/* Account Brain — app layer.
 *
 * Owns persistence, the lock, and all rendering. The cryptography is in
 * store.js and every rule worth arguing about is in model.js, which is pure and
 * tested. This file should contain no business logic: if something here starts
 * deciding what counts as overdue, it belongs in the model.
 *
 * This app holds real customer names, roles, and things people said in
 * confidence. That is a step up in sensitivity from The Dojo, so encryption is
 * the default path and the copy says why.
 */
(function () {
  'use strict';

  var Store = window.SecureStore;
  var M = window.ABModel;
  var KEY = 'acctbrain:v1';

  var db = M.blankDb();
  var session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
  var currentId = null;
  var editing = { acct: null, person: null, thread: null };
  var pStance = 'neutral', tKind = 'promise', openKind = 'objection';
  var idleTimer = null, lastActive = Date.now();
  var showDone = false, packMode = 'account';

  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return Date.now(); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------------------ persistence */
  function readRaw() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function writeRaw(env) {
    try { localStorage.setItem(KEY, JSON.stringify(env)); return true; }
    catch (e) { toast('Could not save. Storage may be full or blocked.'); return false; }
  }

  /* Serialised so two encrypts cannot finish out of order and persist stale data. */
  var savePending = Promise.resolve();
  function save() {
    savePending = savePending.then(function () {
      if (!session.encrypted) { writeRaw(Store.plainEnvelope(db)); return; }
      if (!session.key) return;
      return Store.reseal(db, session.key, session.salt, session.iter)
        .then(writeRaw)
        .catch(function () { toast('Could not save.'); });
    });
    return savePending;
  }

  /* -------------------------------------------------------------- the lock */
  var VIEWS = ['viewToday', 'viewAccounts', 'viewDetail', 'viewBrief', 'viewCraft'];
  function show(v) {
    VIEWS.forEach(function (id) { $(id).hidden = (id !== v); });
    $('viewLock').hidden = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showLock(mode) {
    VIEWS.forEach(function (id) { $(id).hidden = true; });
    $('viewLock').hidden = false;
    $('appNav').hidden = true;
    $('lockMode').value = mode;
    var isNew = mode === 'new';
    $('lockTitle').textContent = isNew ? 'Set a passphrase' : 'Locked';
    $('lockBlurb').innerHTML = isNew
      ? 'This page is public. Your accounts are not: they stay in this browser and are never sent anywhere. This app holds real customer names and things people told you in confidence, so a passphrase is strongly recommended.<br><br><strong>There is no recovery.</strong> Forget it and the data is gone, which is what makes it work.'
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
    session.key = null;
    session.unlocked = false;
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    showLock('unlock');
  }

  function enterApp() {
    session.unlocked = true;
    $('appNav').hidden = false;
    $('btnLock').hidden = !session.encrypted;
    renderAll();
    show('viewToday');
    startIdleWatch();
  }

  function startIdleWatch() {
    if (idleTimer) clearInterval(idleTimer);
    if (!session.encrypted || !db.settings.lockMins) return;
    lastActive = Date.now();
    idleTimer = setInterval(function () {
      if (Date.now() - lastActive > db.settings.lockMins * 60000) lock();
    }, 15000);
  }

  function busy(on) {
    $('lockGo').disabled = on;
    $('lockGo').textContent = on ? 'Working…' : ($('lockMode').value === 'new' ? 'Encrypt and start' : 'Unlock');
  }

  function handleLockSubmit() {
    var mode = $('lockMode').value;
    var pass = $('lockPass').value;
    var err = $('lockErr');
    err.textContent = '';

    if (mode === 'new') {
      if (pass.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      if (pass !== $('lockPass2').value) { err.textContent = 'The two passphrases do not match.'; return; }
      busy(true);
      Store.seal(db, pass).then(function (res) {
        session.key = res.key; session.salt = res.salt; session.iter = res.iter;
        session.encrypted = true;
        writeRaw(res.envelope);
        busy(false); enterApp(); toast('Encrypted');
      }).catch(function (e) { busy(false); err.textContent = e.message; });
      return;
    }

    if (!pass) { err.textContent = 'Enter your passphrase.'; return; }
    busy(true);
    Store.unseal(readRaw(), pass).then(function (res) {
      db = M.sanitiseDb(res.data);
      session.key = res.key; session.salt = res.salt; session.iter = res.iter;
      session.encrypted = true;
      busy(false); enterApp();
    }).catch(function (e) {
      busy(false); err.textContent = e.message; $('lockPass').select();
    });
  }

  /* --------------------------------------------------------------- render */
  function renderAll() {
    renderToday();
    renderAccounts();
    renderCraft();
  }

  var ATT_LABEL = {
    overdue: 'Overdue', due: 'Due soon', cold: 'Gone cold',
    cooling: 'Cooling', nonext: 'No next step'
  };
  var ATT_COLOUR = { overdue: '#fb7185', due: '#fbbf24', cold: '#fb7185', cooling: '#fbbf24', nonext: '#8892a4' };

  function renderToday() {
    var items = M.attention(db, now());
    var c = M.attentionCounts(items);
    var accts = M.liveAccounts(db).length;

    $('todayLede').textContent = !accts
      ? 'Nothing here yet. Add the account you have a call with next.'
      : !items.length
        ? 'Nothing needs you. Every promise has a date in the future and nothing has gone quiet.'
        : c.overdue
          ? c.overdue + ' promise' + (c.overdue === 1 ? '' : 's') + ' overdue. Start there.'
          : 'Nothing overdue. These are worth a glance.';

    if (!items.length) { $('attention').innerHTML = ''; return; }

    $('attention').innerHTML = items.map(function (i) {
      return '<button class="att" data-goto="' + i.accountId + '" style="--c:' + ATT_COLOUR[i.kind] + '">' +
        '<span class="att-kind">' + ATT_LABEL[i.kind] + '</span>' +
        '<span class="att-main"><span class="att-acct">' + esc(i.accountName) + '</span>' +
        '<span class="att-text">' + esc(i.text) + '</span></span>' +
        '<span class="att-meta">' + esc(i.meta) + '</span></button>';
    }).join('');
  }

  function renderSearch(q) {
    if (!q.trim()) { $('searchResults').hidden = true; $('attention').hidden = false; return; }
    var hits = M.searchAll(db, q);
    $('attention').hidden = true;
    $('searchResults').hidden = false;
    $('searchResults').innerHTML = hits.length
      ? '<p class="count">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</p>' +
        hits.slice(0, 60).map(function (h) {
          return '<button class="hit" data-goto="' + h.accountId + '">' +
            '<span class="hit-type">' + h.type + '</span>' +
            '<span class="hit-text">' + esc(h.text) + '</span>' +
            '<span class="hit-acct">' + esc(h.accountName) + '</span></button>';
        }).join('')
      : '<div class="empty"><h3>No match</h3><p>Nothing in your accounts mentions that.</p></div>';
  }

  function renderAccounts() {
    var showArch = $('showArchived').checked;
    var list = (showArch ? db.accounts : M.liveAccounts(db)).slice()
      .sort(function (a, b) { return M.lastTouch(db, b.id) - M.lastTouch(db, a.id); });

    if (!list.length) {
      $('acctList').innerHTML =
        '<div class="empty"><h3>No accounts yet</h3>' +
        '<p>Add the one you have a call with next. It takes about a minute, and it pays for itself the first time you open the brief in a car park.</p></div>';
      return;
    }

    $('acctList').innerHTML = list.map(function (a) {
      var t = M.lastTouch(db, a.id);
      var d = M.daysSince(t, now());
      var w = M.warmth(d);
      var open = M.threadsOf(db, a.id, false);
      var promises = open.filter(function (x) { return x.kind === 'promise'; });
      var overdue = promises.filter(function (x) { return M.daysUntil(x.due, now()) < 0; }).length;
      var pill = overdue
        ? '<span class="pill hot">' + overdue + ' overdue</span>'
        : promises.length ? '<span class="pill warn">' + promises.length + ' promised</span>'
        : open.length ? '<span class="pill">' + open.length + ' open</span>' : '';
      return '<button class="acct' + (a.archived ? ' archived' : '') + '" data-id="' + a.id + '">' +
        '<span class="warm" style="background:' + w.colour + '" title="' + w.label + '"></span>' +
        '<span class="acct-main"><span class="acct-name">' + esc(a.name) +
        (a.archived ? ' <span class="tagx">archived</span>' : '') + '</span>' +
        '<span class="acct-sub">' + esc(a.stage) + ' · ' + M.peopleOf(db, a.id).length + ' people · last contact ' +
        M.ago(t, now()) + '</span></span>' + pill + '</button>';
    }).join('');
  }

  function renderDetail() {
    var a = M.account(db, currentId);
    if (!a) { show('viewAccounts'); return; }
    var t = M.lastTouch(db, currentId);
    $('dName').textContent = a.name;
    $('dMeta').textContent = [a.stage, a.sector, 'last contact ' + M.ago(t, now()), a.note]
      .filter(Boolean).join(' · ');

    var es = M.entriesOf(db, currentId);
    $('entries').innerHTML = es.length
      ? es.slice(0, 10).map(function (e) {
          var lines = [
            e.soWhat && ['So what', e.soWhat],
            e.theySaid && ['They said', '“' + e.theySaid + '”'],
            e.learned && ['I learned', e.learned],
            e.open && ['Still open', e.open],
            e.owe && ['I owe', e.owe]
          ].filter(Boolean);
          return '<div class="entry">' +
            '<div class="entry-when">' + M.ago(e.ts, now()) +
            (e.meeting ? ' · ' + esc(e.meeting) : '') +
            ' <button class="icon danger" data-delentry="' + e.id + '">remove</button></div>' +
            (lines.length
              ? '<dl class="five">' + lines.map(function (l) {
                  return '<dt>' + l[0] + '</dt><dd>' + esc(l[1]) + '</dd>';
                }).join('') + '</dl>'
              : '') +
            (e.text ? '<div class="entry-text">' + esc(e.text) + '</div>' : '') +
            '</div>';
        }).join('')
      : '<p class="none">Nothing logged yet. After the next call, write the five lines.</p>';

    var ps = M.peopleOf(db, currentId);
    $('people').innerHTML = ps.length
      ? ps.map(function (p) {
          var s = M.STANCES[p.stance] || M.STANCES.neutral;
          return '<div class="person">' +
            '<span class="stance" style="background:' + s.colour + '" title="' + s.label + '"></span>' +
            '<span class="person-main"><span class="person-name">' + esc(p.name) + '</span> ' +
            '<span class="person-role">' + esc(p.role) + (p.role ? ' · ' : '') + s.label + '</span>' +
            (p.cares ? '<div class="person-cares">' + esc(p.cares) + '</div>' : '') + '</span>' +
            '<button class="icon" data-editperson="' + p.id + '">edit</button></div>';
        }).join('')
      : '<p class="none">Nobody added yet.</p>';

    $('threads').innerHTML = renderThreads(M.threadsOf(db, currentId, false)) ||
      '<p class="none">Nothing open. Either you are on top of it, or you have not written it down.</p>';

    var done = M.threadsOf(db, currentId, true);
    $('threadsDone').innerHTML = renderThreads(done) || '<p class="none">Nothing closed yet.</p>';
    $('threadsDone').hidden = !showDone;
    $('btnToggleDone').textContent = showDone ? 'Hide' : ('Show' + (done.length ? ' (' + done.length + ')' : ''));
  }

  function renderThreads(list) {
    if (!list.length) return '';
    return list.map(function (t) {
      var k = M.KINDS[t.kind] || M.KINDS.action;
      var due = t.due ? M.dueLabel(t.due, now()) : '';
      var overdue = t.due && M.daysUntil(t.due, now()) < 0 && !t.done;
      return '<div class="thread' + (t.done ? ' done' : '') + '" style="--tc:' + k.colour + '">' +
        '<button class="tick" data-toggle="' + t.id + '" aria-label="' + (t.done ? 'Reopen' : 'Close') + '">' +
        (t.done ? '✓' : '') + '</button>' +
        '<span class="t-main"><span class="t-kind">' + k.label + '</span>' +
        '<div class="t-text">' + esc(t.text) + '</div>' +
        '<span class="t-age">opened ' + M.ago(t.created, now()) +
        (due ? ' · <span class="' + (overdue ? 'overdue' : 'due') + '">' + due + '</span>' : '') +
        '</span></span>' +
        '<button class="icon" data-editthread="' + t.id + '">edit</button></div>';
    }).join('');
  }

  function renderBrief() {
    var b = M.buildBrief(db, currentId, now());
    if (!b) return;
    var sec = function (title, items) {
      return items.length ? '<div class="bsec"><h3>' + title + '</h3><ul>' + items.join('') + '</ul></div>' : '';
    };
    var li = function (t) {
      var due = t.due ? ' <span class="dim">(' + M.dueLabel(t.due, now()) + ')</span>' : '';
      return '<li>' + esc(t.text) + due + '</li>';
    };

    var html = '<h2>' + esc(b.account.name) + '</h2>' +
      '<p class="sub">' + esc(b.account.stage) + ' · last contact ' + b.ago +
      ' · <span style="color:' + b.warmth.colour + '">' + b.warmth.label + '</span>' +
      (b.account.note ? ' · ' + esc(b.account.note) : '') + '</p>';

    if (b.promises.length) {
      html += '<div class="bsec">' + b.promises.map(function (p) {
        return '<div class="flag' + (p.overdue ? ' hot' : '') + '"><b>' +
          (p.overdue ? 'Overdue:' : 'You promised:') + '</b> ' + esc(p.text) +
          (p.dueLabel ? ' <span class="dim">(' + p.dueLabel + ')</span>' : '') + '</div>';
      }).join('') + '</div>';
    }

    if (b.people.length) {
      html += sec('Who you are dealing with', b.people.map(function (p) {
        var s = M.STANCES[p.stance] || M.STANCES.neutral;
        return '<li><b>' + esc(p.name) + '</b> <span class="dim">' + esc(p.role) +
          (p.role ? ', ' : '') + s.label.toLowerCase() + '</span>' +
          (p.cares ? '<br><span class="dim">Cares about: ' + esc(p.cares) + '</span>' : '') + '</li>';
      }));
    }

    html += sec('Still open against you', b.objections.map(li));
    html += sec('Risks', b.risks.map(li));
    html += sec('Ask this time', b.questions.map(li));
    html += sec('Next steps', b.actions.map(li));

    if (b.quotes.length) {
      html += sec('Their words', b.quotes.map(function (e) {
        return '<li>“' + esc(e.theySaid) + '” <span class="dim">(' + M.ago(e.ts, now()) + ')</span></li>';
      }));
    }
    if (b.recent.length) {
      html += sec('Where you left it', b.recent.map(function (e) {
        return '<li>' + esc(M.entrySummary(e)) + ' <span class="dim">(' + M.ago(e.ts, now()) + ')</span></li>';
      }));
    }
    if (b.empty) {
      html += '<p class="none">There is nothing in here yet. Add a person and log the last call, and this page becomes worth opening.</p>';
    } else if (b.gapNote) {
      html += '<div class="flag"><b>Note:</b> ' + esc(b.gapNote) + '</div>';
    }

    $('briefBody').innerHTML = html;
    show('viewBrief');
  }

  function renderCraft() {
    var items = M.craftItems(db);
    if (!items.length) {
      $('craftList').innerHTML =
        '<div class="empty"><h3>Nothing yet</h3>' +
        '<p>Fill in <em>I learned</em> when you log a meeting. Those lines collect here, and they are the ones that stay useful after the deal closes and after the job changes.</p></div>';
      return;
    }
    $('craftList').innerHTML = items.map(function (i) {
      return '<article class="craft">' +
        '<label class="craft-pick"><input type="checkbox" data-craft="' + i.id + '" checked></label>' +
        '<div class="craft-main"><div class="craft-learned">' + esc(i.learned) + '</div>' +
        (i.theySaid ? '<div class="craft-quote">“' + esc(i.theySaid) + '”</div>' : '') +
        '<div class="craft-meta"><button class="linky" data-goto="' + i.accountId + '">' +
        esc(i.accountName) + '</button> · ' + M.ago(i.ts, now()) + '</div></div></article>';
    }).join('');
  }

  function selectedCraft() {
    var picked = {};
    document.querySelectorAll('[data-craft]').forEach(function (cb) {
      if (cb.checked) picked[cb.dataset.craft] = true;
    });
    return M.craftItems(db).filter(function (i) { return picked[i.id]; });
  }

  /* ------------------------------------------------------------- mutations */
  function openAcctDialog(id) {
    editing.acct = id || null;
    var a = id ? M.account(db, id) : null;
    $('acctDlgTitle').textContent = a ? 'Edit account' : 'Add an account';
    $('aStage').innerHTML = M.STAGES.map(function (s) {
      return '<option' + (a && a.stage === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    $('aName').value = a ? a.name : '';
    $('aSector').value = a ? a.sector : '';
    $('aNote').value = a ? a.note : '';
    $('aArchived').checked = a ? !!a.archived : false;
    $('btnDelAcct').hidden = !a;
    $('dlgAcct').showModal();
    setTimeout(function () { $('aName').focus(); }, 50);
  }

  function saveAcct() {
    var name = $('aName').value.trim();
    if (!name) { $('aName').focus(); return; }
    if (editing.acct) {
      var a = M.account(db, editing.acct);
      a.name = name; a.stage = $('aStage').value; a.sector = $('aSector').value.trim();
      a.note = $('aNote').value.trim(); a.archived = $('aArchived').checked;
    } else {
      var id = uid();
      db.accounts.push({ id: id, name: name, stage: $('aStage').value,
                         sector: $('aSector').value.trim(), note: $('aNote').value.trim(),
                         created: Date.now(), archived: false });
      currentId = id;
    }
    save();
    $('dlgAcct').close();
    renderAll();
    renderDetail();
    show('viewDetail');
  }

  function openEntryDialog() {
    ['eMeeting', 'eSoWhat', 'eTheySaid', 'eLearned', 'eOpen', 'eOwe', 'eText'].forEach(function (id) { $(id).value = ''; });
    $('eOweDue').value = '';
    $('eOweDueWrap').hidden = true;
    $('eOpenKindWrap').hidden = true;
    openKind = 'objection';
    seg($('eOpenKind'), openKind, 'kind');
    $('dlgEntry').showModal();
    setTimeout(function () { $('eMeeting').focus(); }, 50);
  }

  /* Saving an entry is where the five lines become tracked work: what you owe
     becomes a promise with a date, what is still open becomes a thread. That
     conversion is the whole reason writing the note pays back. */
  function saveEntry() {
    var e = {
      id: uid(), accountId: currentId, ts: Date.now(),
      meeting: $('eMeeting').value.trim(),
      soWhat: $('eSoWhat').value.trim(),
      theySaid: $('eTheySaid').value.trim(),
      learned: $('eLearned').value.trim(),
      open: $('eOpen').value.trim(),
      owe: $('eOwe').value.trim(),
      text: $('eText').value.trim()
    };
    if (!e.soWhat && !e.theySaid && !e.learned && !e.open && !e.owe && !e.text) {
      toast('Nothing to save yet');
      return;
    }
    db.entries.push(e);

    var made = 0;
    if (e.owe) {
      db.threads.push({ id: uid(), accountId: currentId, kind: 'promise', text: e.owe,
                        due: $('eOweDue').value || null, created: Date.now(), done: false });
      made++;
    }
    if (e.open) {
      db.threads.push({ id: uid(), accountId: currentId, kind: openKind, text: e.open,
                        due: null, created: Date.now(), done: false });
      made++;
    }
    save();
    $('dlgEntry').close();
    renderAll();
    renderDetail();
    toast(made ? 'Logged, and ' + made + ' thread' + (made === 1 ? '' : 's') + ' tracked' : 'Logged');
  }

  function openPersonDialog(id) {
    editing.person = id || null;
    var p = id ? db.people.filter(function (x) { return x.id === id; })[0] : null;
    $('personDlgTitle').textContent = p ? 'Edit person' : 'Add a person';
    $('pName').value = p ? p.name : '';
    $('pRole').value = p ? p.role : '';
    $('pCares').value = p ? p.cares : '';
    pStance = p ? p.stance : 'neutral';
    $('pStance').innerHTML = Object.keys(M.STANCES).map(function (k) {
      return '<button type="button" data-stance="' + k + '">' + M.STANCES[k].label + '</button>';
    }).join('');
    seg($('pStance'), pStance, 'stance');
    $('btnDelPerson').hidden = !p;
    $('dlgPerson').showModal();
    setTimeout(function () { $('pName').focus(); }, 50);
  }

  function savePerson() {
    var name = $('pName').value.trim();
    if (!name) { $('pName').focus(); return; }
    if (editing.person) {
      var p = db.people.filter(function (x) { return x.id === editing.person; })[0];
      p.name = name; p.role = $('pRole').value.trim(); p.cares = $('pCares').value.trim(); p.stance = pStance;
    } else {
      db.people.push({ id: uid(), accountId: currentId, name: name, role: $('pRole').value.trim(),
                       cares: $('pCares').value.trim(), stance: pStance });
    }
    save(); $('dlgPerson').close(); renderDetail(); renderAccounts();
  }

  function openThreadDialog(id) {
    editing.thread = id || null;
    var t = id ? db.threads.filter(function (x) { return x.id === id; })[0] : null;
    $('threadDlgTitle').textContent = t ? 'Edit thread' : 'Add a thread';
    tKind = t ? t.kind : 'promise';
    $('tKind').innerHTML = Object.keys(M.KINDS).map(function (k) {
      return '<button type="button" data-kind="' + k + '">' + M.KINDS[k].label + '</button>';
    }).join('');
    seg($('tKind'), tKind, 'kind');
    $('tText').value = t ? t.text : '';
    $('tDue').value = t && t.due ? t.due : '';
    $('btnDelThread').hidden = !t;
    $('dlgThread').showModal();
    setTimeout(function () { $('tText').focus(); }, 50);
  }

  function saveThread() {
    var text = $('tText').value.trim();
    if (!text) { $('tText').focus(); return; }
    if (editing.thread) {
      var t = db.threads.filter(function (x) { return x.id === editing.thread; })[0];
      t.kind = tKind; t.text = text; t.due = $('tDue').value || null;
    } else {
      db.threads.push({ id: uid(), accountId: currentId, kind: tKind, text: text,
                        due: $('tDue').value || null, created: Date.now(), done: false });
    }
    save(); $('dlgThread').close(); renderDetail(); renderAll();
  }

  function seg(container, value, attr) {
    container.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    });
  }

  /* ------------------------------------------------------------------ data */
  function download(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var env;
      try { env = JSON.parse(r.result); } catch (e) { toast('That file could not be read'); return; }
      if (!Store.isEnvelope(env)) { toast('That is not an Account Brain backup'); return; }
      var go = function (data) { mergeDb(M.sanitiseDb(data)); };
      if (Store.isEncrypted(env)) {
        var pass = prompt('That backup is encrypted. Enter the passphrase it was saved with:');
        if (!pass) return;
        Store.unseal(env, pass).then(function (r2) { go(r2.data); }).catch(function (e) { toast(e.message); });
      } else {
        Store.unseal(env).then(function (r2) { go(r2.data); }).catch(function () { toast('That file could not be read'); });
      }
    };
    r.readAsText(file);
  }

  /* Merge by id so restoring an older backup cannot discard newer work. */
  function mergeDb(incoming) {
    var added = 0;
    ['accounts', 'people', 'threads', 'entries'].forEach(function (k) {
      var have = {};
      db[k].forEach(function (x) { have[x.id] = true; });
      incoming[k].forEach(function (x) { if (!have[x.id]) { db[k].push(x); added++; } });
    });
    save();
    renderAll();
    toast(added ? 'Imported ' + added + ' record' + (added === 1 ? '' : 's') : 'Nothing new to import');
  }

  function loadExample() {
    var id = uid(), n = Date.now(), DAY = M.DAY;
    var d = function (off) {
      var x = new Date(n + off * DAY);
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    db.accounts.push({ id: id, name: 'Northbank Group (example)', stage: 'Evaluation', sector: 'Banking',
                       note: 'Regulated, three sites, VPN estate at end of life', created: n - 70 * DAY, archived: false });
    db.people.push(
      { id: uid(), accountId: id, name: 'Priya Raman', role: 'Head of Infrastructure', stance: 'champion',
        cares: 'Getting off the VPN before the hardware refresh budget is spent elsewhere' },
      { id: uid(), accountId: id, name: 'Tom Aldridge', role: 'Security Architect', stance: 'sceptical',
        cares: 'Was burned by a DLP rollout at his last employer. Wants false positive rates, not accuracy claims' },
      { id: uid(), accountId: id, name: 'Dawn Whitfield', role: 'CFO', stance: 'neutral',
        cares: 'What comes off the bill, and when. Has asked twice and not had a straight answer' }
    );
    db.threads.push(
      { id: uid(), accountId: id, kind: 'promise', text: 'Send Priya the written answer on regional data handling', due: d(-4), created: n - 9 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'promise', text: 'Share the sizing sheet with Tom', due: d(2), created: n - 2 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'objection', text: 'Tom: inline inspection will break our trading applications. Not yet answered with a measurement.', created: n - 16 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'question', text: 'Who actually signs? Priya says finance, Dawn implies the CIO.', created: n - 16 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'risk', text: 'No executive has ever joined a call. Technical enthusiasm only.', created: n - 30 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'action', text: 'Agree the three decisive evaluation criteria before scope grows past twenty.', created: n - 5 * DAY, done: false },
      { id: uid(), accountId: id, kind: 'objection', text: 'We are a Microsoft shop. Handled by mapping the overlap honestly in week one.', created: n - 40 * DAY, done: true }
    );
    db.entries.push(
      { id: uid(), accountId: id, ts: n - 9 * DAY, meeting: 'Technical deep dive, Priya and Tom',
        soWhat: 'Tom moved from blocking to willing to test. First real progress.',
        theySaid: 'We turned the last one off after six weeks. I am not doing that again.',
        learned: 'Tom’s objection is not latency, it is being blamed for a rollout. Make the measurement his, not mine.',
        open: 'No business attendee has ever joined.', owe: 'Regional data handling answer to Priya, in writing.', text: '' },
      { id: uid(), accountId: id, ts: n - 16 * DAY, meeting: 'First technical session',
        soWhat: 'Good energy, but nobody from the business joined.',
        theySaid: '', learned: '', open: '', owe: '', text: '' },
      { id: uid(), accountId: id, ts: n - 40 * DAY, meeting: 'Intro call',
        soWhat: 'Hardware refresh is the forcing function.', theySaid: '', learned: '',
        open: '', owe: '', text: 'Budget decision lands before the end of the financial year.' }
    );
    save(); renderAll();
    toast('Example loaded. Delete it when you are done.');
  }

  function renderSecurity() {
    $('secState').innerHTML = session.encrypted
      ? '<span class="ok-dot"></span>Encrypted at rest. Auto-locks after ' + db.settings.lockMins + ' minutes idle.'
      : '<span class="warn-dot"></span>Not encrypted. Customer names are stored as readable text in this browser.';
    $('btnSetPass').textContent = session.encrypted ? 'Change passphrase' : 'Set a passphrase';
    $('btnDropPass').hidden = !session.encrypted;
    $('lockMinsWrap').hidden = !session.encrypted;
    $('btnExportEnc').disabled = !session.encrypted;
    document.querySelectorAll('[data-lockmins]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.lockmins) === db.settings.lockMins));
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
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

  function openPack(title, body) {
    $('packTitle').textContent = title;
    $('packOut').value = body;
    $('dlgPack').showModal();
  }

  function goto(id) {
    currentId = id;
    renderDetail();
    show('viewDetail');
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    var raw = readRaw();
    if (!raw) {
      showLock('new');
    } else if (Store.isEncrypted(raw)) {
      session.encrypted = true;
      showLock('unlock');
    } else {
      Store.unseal(raw).then(function (res) {
        db = M.sanitiseDb(res.data);
        session.encrypted = false;
        enterApp();
      }).catch(function () { showLock('new'); });
    }
    wire();
  }

  function wire() {
    $('lockGo').addEventListener('click', handleLockSubmit);
    $('lockForm').addEventListener('submit', function (e) { e.preventDefault(); handleLockSubmit(); });
    $('lockSkip').addEventListener('click', function () {
      session.encrypted = false;
      writeRaw(Store.plainEnvelope(db));
      enterApp();
    });
    $('btnLock').addEventListener('click', lock);

    $('navToday').addEventListener('click', function () { renderToday(); show('viewToday'); });
    $('navAccounts').addEventListener('click', function () { renderAccounts(); show('viewAccounts'); });
    $('navCraft').addEventListener('click', function () { renderCraft(); show('viewCraft'); });
    $('backList').addEventListener('click', function () { renderAccounts(); show('viewAccounts'); });
    $('backDetail').addEventListener('click', function () { renderDetail(); show('viewDetail'); });

    $('search').addEventListener('input', function (e) { renderSearch(e.target.value); });

    /* One delegated handler for every "jump to this account" affordance. */
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]');
      if (g) { goto(g.dataset.goto); return; }
      var a = e.target.closest('[data-id]');
      if (a && a.classList.contains('acct')) goto(a.dataset.id);
    });

    $('btnAddAcct').addEventListener('click', function () { openAcctDialog(null); });
    $('btnEditAcct').addEventListener('click', function () { openAcctDialog(currentId); });
    $('btnSaveAcct').addEventListener('click', saveAcct);
    $('btnDelAcct').addEventListener('click', function () {
      var a = M.account(db, editing.acct);
      if (!a || !confirm('Delete ' + a.name + ' and everything recorded against it?\n\nThis cannot be undone. If you only want it out of the way, tick Archived instead.')) return;
      db.accounts = db.accounts.filter(function (x) { return x.id !== editing.acct; });
      ['people', 'threads', 'entries'].forEach(function (k) {
        db[k] = db[k].filter(function (x) { return x.accountId !== editing.acct; });
      });
      save(); $('dlgAcct').close(); renderAll(); show('viewAccounts'); toast('Deleted');
    });
    $('showArchived').addEventListener('change', renderAccounts);
    $('btnExample').addEventListener('click', loadExample);

    $('btnAddEntry').addEventListener('click', openEntryDialog);
    $('btnSaveEntry').addEventListener('click', saveEntry);
    $('eOwe').addEventListener('input', function (e) {
      var has = !!e.target.value.trim();
      $('eOweDueWrap').hidden = !has;
      if (has && !$('eOweDue').value) $('eOweDue').value = todayISO();
    });
    $('eOpen').addEventListener('input', function (e) {
      $('eOpenKindWrap').hidden = !e.target.value.trim();
    });
    $('eOpenKind').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      openKind = b.dataset.kind;
      seg($('eOpenKind'), openKind, 'kind');
    });

    $('btnAddPerson').addEventListener('click', function () { openPersonDialog(null); });
    $('btnSavePerson').addEventListener('click', savePerson);
    $('pStance').addEventListener('click', function (e) {
      var b = e.target.closest('[data-stance]');
      if (!b) return;
      pStance = b.dataset.stance;
      seg($('pStance'), pStance, 'stance');
    });
    $('btnDelPerson').addEventListener('click', function () {
      db.people = db.people.filter(function (x) { return x.id !== editing.person; });
      save(); $('dlgPerson').close(); renderDetail(); toast('Removed');
    });

    $('btnAddThread').addEventListener('click', function () { openThreadDialog(null); });
    $('btnSaveThread').addEventListener('click', saveThread);
    $('tKind').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      tKind = b.dataset.kind;
      seg($('tKind'), tKind, 'kind');
    });
    $('btnDelThread').addEventListener('click', function () {
      db.threads = db.threads.filter(function (x) { return x.id !== editing.thread; });
      save(); $('dlgThread').close(); renderDetail(); renderAll(); toast('Removed');
    });
    $('btnToggleDone').addEventListener('click', function () { showDone = !showDone; renderDetail(); });

    $('viewDetail').addEventListener('click', function (e) {
      var tog = e.target.closest('[data-toggle]');
      if (tog) {
        var t = db.threads.filter(function (x) { return x.id === tog.dataset.toggle; })[0];
        if (t) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; save(); renderDetail(); renderAll(); }
        return;
      }
      var ep = e.target.closest('[data-editperson]');
      if (ep) { openPersonDialog(ep.dataset.editperson); return; }
      var et = e.target.closest('[data-editthread]');
      if (et) { openThreadDialog(et.dataset.editthread); return; }
      var de = e.target.closest('[data-delentry]');
      if (de) {
        if (!confirm('Remove this log entry?\n\nAny threads it created stay, so nothing you promised is lost.')) return;
        db.entries = db.entries.filter(function (x) { return x.id !== de.dataset.delentry; });
        save(); renderDetail(); renderAll(); toast('Removed');
      }
    });

    $('btnBrief').addEventListener('click', renderBrief);
    $('btnPrint').addEventListener('click', function () { window.print(); });
    $('btnCopyBrief').addEventListener('click', function () {
      copy(M.briefText(M.buildBrief(db, currentId, now())));
    });
    $('btnCopyCrm').addEventListener('click', function () {
      copy(M.crmText(M.buildBrief(db, currentId, now())));
      toast('CRM lines copied');
    });

    $('btnPack').addEventListener('click', function () {
      packMode = 'account';
      openPack('Context pack', M.accountPack(db, currentId, now()));
    });
    $('btnPortfolioPack').addEventListener('click', function () {
      packMode = 'portfolio';
      openPack('Portfolio pack', M.portfolioPack(db, now()));
    });
    $('btnCraftPack').addEventListener('click', function () {
      var items = selectedCraft();
      var body = ['# What I have learned', '',
        items.length + ' observation' + (items.length === 1 ? '' : 's') + ' from real conversations.', ''];
      items.forEach(function (i) {
        body.push('- ' + i.learned + ' _(' + i.accountName + ', ' + M.ago(i.ts, now()) + ')_');
      });
      openPack('Learned', body.join('\n'));
    });
    $('btnCopyPack').addEventListener('click', function () { copy($('packOut').value); });

    $('btnToDojo').addEventListener('click', function () {
      var items = selectedCraft();
      if (!items.length) { toast('Nothing selected'); return; }
      download(M.dojoCardEnvelope(items), 'dojo-cards-' + todayISO() + '.json');
      toast(items.length + ' card' + (items.length === 1 ? '' : 's') + ' saved. Import it in The Dojo.');
    });

    $('btnData').addEventListener('click', function () { renderSecurity(); $('dlgData').showModal(); });
    $('btnExportEnc').addEventListener('click', function () {
      if (!session.encrypted || !session.key) { toast('Set a passphrase first.'); return; }
      Store.reseal(db, session.key, session.salt, session.iter).then(function (env) {
        download(env, 'account-brain-encrypted-' + todayISO() + '.json');
        toast('Encrypted backup saved');
      });
    });
    $('btnExportPlain').addEventListener('click', function () {
      if (!confirm('This file is NOT encrypted.\n\nIt contains customer names, roles and things people said to you in confidence. Anyone who opens it can read all of it.\n\nContinue?')) return;
      download(Store.plainEnvelope(db), 'account-brain-plain-' + todayISO() + '.json');
      toast('Plain backup saved');
    });
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
      if (p1 !== prompt('Type it again to confirm.')) { toast('They did not match'); return; }
      Store.seal(db, p1).then(function (res) {
        session.key = res.key; session.salt = res.salt; session.iter = res.iter;
        session.encrypted = true;
        writeRaw(res.envelope);
        $('btnLock').hidden = false;
        startIdleWatch(); renderSecurity(); toast('Passphrase set');
      });
    });
    $('btnDropPass').addEventListener('click', function () {
      if (!confirm('Remove encryption?\n\nCustomer names, roles and quotes will be stored in this browser as readable text.\n\nContinue?')) return;
      session.encrypted = false; session.key = null; session.salt = null; session.iter = null;
      writeRaw(Store.plainEnvelope(db));
      $('btnLock').hidden = true;
      if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
      renderSecurity(); toast('Encryption removed');
    });
    document.querySelectorAll('[data-lockmins]').forEach(function (b) {
      b.addEventListener('click', function () {
        db.settings.lockMins = Number(b.dataset.lockmins);
        save(); renderSecurity(); startIdleWatch();
      });
    });

    $('btnReset').addEventListener('click', function () {
      if (!confirm('Erase every account, person, thread and log entry?\n\nThis clears only Account Brain. Nothing else in this browser is touched. It cannot be undone.')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
      db = M.blankDb();
      session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
      $('dlgData').close();
      showLock('new');
      toast('Erased');
    });

    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });

    ['click', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && session.encrypted && session.unlocked &&
          db.settings.lockMins && Date.now() - lastActive > db.settings.lockMins * 60000) {
        lock();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
