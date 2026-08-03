/* Ground — app layer.
 *
 * Persistence, the lock, and rendering for all three faces. Cryptography is in
 * store.js, the practice deck in deck.js, and every rule worth arguing about is
 * in model.js, which is pure and tested. No business logic belongs here.
 */
(function () {
  'use strict';

  var Store = window.SecureStore;
  var M = window.GroundModel;
  var BASE = window.DojoDeck.DECK;
  var CATS = window.DojoDeck.CATS;

  var KEY = 'ground:v1';
  /* Storage keys written by the three apps this replaces. Same origin, so they
     are readable from here. */
  var LEGACY = [
    { key: 'acctbrain:v1', name: 'Account Brain' },
    { key: 'fieldnotes:v1', name: 'Field Notes' },
    { key: 'dojo:v1', name: 'The Dojo' }
  ];

  var db = M.blankDb();
  var session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
  var currentId = null;
  var editing = { acct: null, person: null, thread: null };
  var pStance = 'neutral', tKind = 'promise', openKind = 'objection';
  var noteFilter = { kind: 'all', tag: null, account: null, query: '' };
  var showDone = false;
  var current = null, scores = {}, verdict = null, kept = false;
  var timerId = null, remaining = 0, idleTimer = null, lastActive = Date.now();

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
  function readRaw(key) {
    try { var raw = localStorage.getItem(key || KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function writeRaw(env) {
    try { localStorage.setItem(KEY, JSON.stringify(env)); return true; }
    catch (e) { toast('Could not save. Storage may be full or blocked.'); return false; }
  }

  var savePending = Promise.resolve();
  function save() {
    savePending = savePending.then(function () {
      if (!session.encrypted) { writeRaw(Store.plainEnvelope(db)); return; }
      if (!session.key) return;
      return Store.reseal(db, session.key, session.salt, session.iter)
        .then(writeRaw).catch(function () { toast('Could not save.'); });
    });
    return savePending;
  }

  /* -------------------------------------------------------------- the lock */
  var VIEWS = ['viewToday', 'viewAccounts', 'viewDetail', 'viewBrief', 'viewNotes',
               'viewTopics', 'viewPractice', 'viewRep', 'viewReview', 'viewAnswers'];
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
      ? 'This page is public. Your accounts and notes are not: they stay in this browser and are never sent anywhere. This holds real customer names and things people told you in confidence, so a passphrase is strongly recommended.<br><br><strong>There is no recovery.</strong> Forget it and the data is gone, which is what makes it work.'
      : 'Enter your passphrase to unlock this browser’s store.';
    $('lockPass2Wrap').hidden = !isNew;
    $('lockSkipWrap').hidden = !isNew;
    $('lockPass').value = ''; $('lockPass2').value = ''; $('lockErr').textContent = '';
    $('lockGo').textContent = isNew ? 'Encrypt and start' : 'Unlock';
    setTimeout(function () { $('lockPass').focus(); }, 60);
  }

  function lock() {
    stopTimer();
    session.key = null; session.unlocked = false;
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    showLock('unlock');
  }

  function enterApp() {
    session.unlocked = true;
    $('appNav').hidden = false;
    $('btnLock').hidden = !session.encrypted;
    buildStatics();
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
    var mode = $('lockMode').value, pass = $('lockPass').value, err = $('lockErr');
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
    }).catch(function (e) { busy(false); err.textContent = e.message; $('lockPass').select(); });
  }

  /* --------------------------------------------------------------- render */
  function buildStatics() {
    $('aStage').innerHTML = M.STAGES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    $('kinds').innerHTML = M.NOTE_ORDER.map(function (k) {
      return '<button class="chip" data-notekind="' + k + '" title="' + esc(M.NOTE_KINDS[k].hint) + '">' +
        M.NOTE_KINDS[k].label + '</button>';
    }).join('');
    seg($('kinds'), db.settings.lastNoteKind, 'notekind');
  }

  function renderAll() {
    renderToday(); renderAccounts(); renderNotes(); renderPractice(); renderBank();
  }

  var ATT_LABEL = { overdue: 'Overdue', due: 'Due soon', cold: 'Gone cold', cooling: 'Cooling', nonext: 'No next step' };
  var ATT_COLOUR = { overdue: '#fb7185', due: '#fbbf24', cold: '#fb7185', cooling: '#fbbf24', nonext: '#8892a4' };

  function renderToday() {
    var items = M.attention(db, now());
    var c = M.attentionCounts(items);
    var accts = M.liveAccounts(db).length;

    $('todayLede').textContent = !accts
      ? 'Nothing here yet. Add the account you have a call with next.'
      : !items.length
        ? 'Nothing needs you. Every promise has a date in the future and nothing has gone quiet.'
        : c.overdue ? c.overdue + ' promise' + (c.overdue === 1 ? '' : 's') + ' overdue. Start there.'
        : 'Nothing overdue. These are worth a glance.';

    $('attention').innerHTML = items.map(function (i) {
      return '<button class="att" data-goto="' + i.accountId + '" style="--c:' + ATT_COLOUR[i.kind] + '">' +
        '<span class="att-kind">' + ATT_LABEL[i.kind] + '</span>' +
        '<span class="att-main"><span class="att-acct">' + esc(i.accountName) + '</span>' +
        '<span class="att-text">' + esc(i.text) + '</span></span>' +
        '<span class="att-meta">' + esc(i.meta) + '</span></button>';
    }).join('');

    /* The other two faces get one line each, so Today is the only screen you
       have to open to know whether anything is waiting. */
    var due = M.dueCards(db, BASE, now()).length;
    var res = M.resurface(db, 3, now()).length;
    var rows = [];
    if (due) rows.push(['practice', due, 'practice card' + (due === 1 ? '' : 's') + ' ready']);
    if (res) rows.push(['notes', res, 'note' + (res === 1 ? '' : 's') + ' worth seeing again']);
    $('todayElse').innerHTML = rows.length
      ? '<div class="todo-else">' + rows.map(function (r) {
          return '<button class="else-row" data-jump="' + r[0] + '">' +
            '<span class="else-n">' + r[1] + '</span><span class="else-t">' + r[2] + '</span></button>';
        }).join('') + '</div>'
      : '';
  }

  function renderSearch(q) {
    if (!q.trim()) { $('searchResults').hidden = true; $('attention').hidden = false; $('todayElse').hidden = false; return; }
    var hits = M.searchAll(db, q);
    $('attention').hidden = true; $('todayElse').hidden = true;
    $('searchResults').hidden = false;
    $('searchResults').innerHTML = hits.length
      ? '<p class="count">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</p>' +
        hits.slice(0, 60).map(function (h) {
          return '<button class="hit"' + (h.accountId ? ' data-goto="' + h.accountId + '"' : ' data-jump="notes"') + '>' +
            '<span class="hit-type">' + h.type + '</span>' +
            '<span class="hit-text">' + esc(h.text) + '</span>' +
            '<span class="hit-acct">' + esc(h.accountName) + '</span></button>';
        }).join('')
      : '<div class="empty"><h3>No match</h3><p>Nothing in your accounts, notes or answers mentions that.</p></div>';
  }

  function renderAccounts() {
    var list = ($('showArchived').checked ? db.accounts : M.liveAccounts(db)).slice()
      .sort(function (a, b) { return M.lastTouch(db, b.id) - M.lastTouch(db, a.id); });
    if (!list.length) {
      $('acctList').innerHTML = '<div class="empty"><h3>No accounts yet</h3>' +
        '<p>Add the one you have a call with next. It takes about a minute, and it pays for itself the first time you open the brief in a car park.</p></div>';
      return;
    }
    $('acctList').innerHTML = list.map(function (a) {
      var t = M.lastTouch(db, a.id), d = M.daysSince(t, now()), w = M.warmth(d);
      var open = M.threadsOf(db, a.id, false);
      var promises = open.filter(function (x) { return x.kind === 'promise'; });
      var overdue = promises.filter(function (x) { return M.daysUntil(x.due, now()) < 0; }).length;
      var pill = overdue ? '<span class="pill hot">' + overdue + ' overdue</span>'
        : promises.length ? '<span class="pill warn">' + promises.length + ' promised</span>'
        : open.length ? '<span class="pill">' + open.length + ' open</span>' : '';
      return '<button class="acct' + (a.archived ? ' archived' : '') + '" data-id="' + a.id + '">' +
        '<span class="warm" style="background:' + w.colour + '" title="' + w.label + '"></span>' +
        '<span class="acct-main"><span class="acct-name">' + esc(a.name) +
        (a.archived ? ' <span class="tagx">archived</span>' : '') + '</span>' +
        '<span class="acct-sub">' + esc(a.stage) + ' · ' + M.peopleOf(db, a.id).length +
        ' people · last contact ' + M.ago(t, now()) + '</span></span>' + pill + '</button>';
    }).join('');
  }

  function renderDetail() {
    var a = M.account(db, currentId);
    if (!a) { show('viewAccounts'); return; }
    $('dName').textContent = a.name;
    $('dMeta').textContent = [a.stage, a.sector, 'last contact ' + M.ago(M.lastTouch(db, currentId), now()), a.note]
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
          return '<div class="entry"><div class="entry-when">' + M.ago(e.ts, now()) +
            (e.meeting ? ' · ' + esc(e.meeting) : '') +
            ' <button class="icon danger" data-delentry="' + e.id + '">remove</button></div>' +
            (lines.length ? '<dl class="five">' + lines.map(function (l) {
              return '<dt>' + l[0] + '</dt><dd>' + esc(l[1]) + '</dd>';
            }).join('') + '</dl>' : '') +
            (e.text ? '<div class="entry-text">' + esc(e.text) + '</div>' : '') + '</div>';
        }).join('')
      : '<p class="none">Nothing logged yet. After the next call, write the five lines.</p>';

    var ps = M.peopleOf(db, currentId);
    $('people').innerHTML = ps.length
      ? ps.map(function (p) {
          var s = M.STANCES[p.stance] || M.STANCES.neutral;
          return '<div class="person"><span class="stance" style="background:' + s.colour + '" title="' + s.label + '"></span>' +
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

    renderAlso();
  }

  /* Notes that mention this account. Reference only, with explicit promotion. */
  function renderAlso() {
    var ns = M.notesForAccount(db, currentId);
    $('alsoPanel').hidden = !ns.length;
    if (!ns.length) return;
    $('alsoList').innerHTML = ns.map(function (n) {
      var k = M.NOTE_KINDS[n.kind] || M.NOTE_KINDS.lesson;
      var tracked = M.isTracked(db, n.id);
      var ref = 'note:' + n.id;
      var practised = M.isPractised(db, ref);
      var canPractise = n.kind === 'objection' || n.kind === 'gotcha' || n.kind === 'competitor';
      return '<div class="also" style="--c:' + k.colour + '">' +
        '<span class="also-dot"></span>' +
        '<span class="also-main"><span class="also-kind">' + k.label + '</span>' +
        '<div class="also-text">' + esc(n.text) + '</div></span>' +
        '<span class="also-acts">' +
        '<button class="mini" data-track="' + n.id + '"' + (tracked ? ' disabled' : '') + '>' +
        (tracked ? 'Tracked' : 'Track this') + '</button>' +
        (canPractise ? '<button class="mini" data-practise="' + ref + '"' + (practised ? ' disabled' : '') + '>' +
          (practised ? 'In deck' : 'Practise') + '</button>' : '') +
        '</span></div>';
    }).join('');
  }

  function renderThreads(list) {
    if (!list.length) return '';
    return list.map(function (t) {
      var k = M.KINDS[t.kind] || M.KINDS.action;
      var due = t.due ? M.dueLabel(t.due, now()) : '';
      var overdue = t.due && M.daysUntil(t.due, now()) < 0 && !t.done;
      var ref = 'thread:' + t.id;
      var practised = M.isPractised(db, ref);
      return '<div class="thread' + (t.done ? ' done' : '') + '" style="--tc:' + k.colour + '">' +
        '<button class="tick" data-toggle="' + t.id + '" aria-label="' + (t.done ? 'Reopen' : 'Close') + '">' +
        (t.done ? '✓' : '') + '</button>' +
        '<span class="t-main"><span class="t-kind">' + k.label + '</span>' +
        '<div class="t-text">' + esc(t.text) + '</div>' +
        '<span class="t-age">opened ' + M.ago(t.created, now()) +
        (due ? ' · <span class="' + (overdue ? 'overdue' : 'due') + '">' + due + '</span>' : '') + '</span></span>' +
        (t.kind === 'objection' ? '<button class="mini" data-practise="' + ref + '"' +
          (practised ? ' disabled' : '') + '>' + (practised ? 'In deck' : 'Practise') + '</button>' : '') +
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
      return '<li>' + esc(t.text) + (t.due ? ' <span class="dim">(' + M.dueLabel(t.due, now()) + ')</span>' : '') + '</li>';
    };
    var html = '<h2>' + esc(b.account.name) + '</h2><p class="sub">' + esc(b.account.stage) +
      ' · last contact ' + b.ago + ' · <span style="color:' + b.warmth.colour + '">' + b.warmth.label + '</span>' +
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
        return '<li><b>' + esc(p.name) + '</b> <span class="dim">' + esc(p.role) + (p.role ? ', ' : '') +
          s.label.toLowerCase() + '</span>' +
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
    if (b.alsoKnown.length) {
      html += sec('Also known', b.alsoKnown.map(function (n) { return '<li>' + esc(n.text) + '</li>'; }));
    }
    if (b.recent.length) {
      html += sec('Where you left it', b.recent.map(function (e) {
        return '<li>' + esc(M.entrySummary(e)) + ' <span class="dim">(' + M.ago(e.ts, now()) + ')</span></li>';
      }));
    }
    if (b.empty) html += '<p class="none">There is nothing in here yet. Add a person and log the last call, and this page becomes worth opening.</p>';
    else if (b.gapNote) html += '<div class="flag"><b>Note:</b> ' + esc(b.gapNote) + '</div>';

    $('briefBody').innerHTML = html;
    show('viewBrief');
  }

  /* ----------------------------------------------------------------- notes */
  function renderNotes() {
    var c = M.noteKindCounts(db);
    var items = [{ id: 'all', label: 'All' }].concat(
      M.NOTE_ORDER.filter(function (k) { return c[k]; })
        .map(function (k) { return { id: k, label: M.NOTE_KINDS[k].label }; }));
    $('noteFilters').innerHTML = items.map(function (k) {
      return '<button class="chip" data-notefilter="' + k.id + '" aria-pressed="' + (k.id === noteFilter.kind) + '">' +
        k.label + ' <span style="opacity:.6">' + (c[k.id] || 0) + '</span></button>';
    }).join('');

    var bits = [];
    if (noteFilter.tag) bits.push('<button class="scope" data-clearscope="tag">#' + esc(noteFilter.tag) + ' ×</button>');
    if (noteFilter.account) bits.push('<button class="scope acct" data-clearscope="account">@' + esc(noteFilter.account) + ' ×</button>');
    $('activeScope').innerHTML = bits.join('');
    $('activeScope').hidden = !bits.length;

    var rows = M.filterNotes(db, noteFilter);
    var total = M.allNotes(db).length;
    $('noteCount').textContent = !total ? '' : rows.length === total
      ? total + ' note' + (total === 1 ? '' : 's') : rows.length + ' of ' + total + ' notes';

    if (!total) {
      $('noteList').innerHTML = '<div class="empty"><h3>Nothing here yet, which is the point</h3>' +
        '<p>This fills up from work you are already doing. Capture what would otherwise be gone by Friday:</p><ul>' +
        '<li>A limitation you found the hard way</li>' +
        '<li>The sentence that made an objection land</li>' +
        '<li>A proof point you can reuse anywhere</li>' +
        '<li>Something a competitor said, first hand</li>' +
        '<li>Anything you learned about the job itself</li></ul>' +
        '<p style="margin-top:1rem">Every <em>I learned</em> line you write against an account also lands here automatically.</p></div>';
    } else if (!rows.length) {
      $('noteList').innerHTML = '<div class="empty"><h3>No match</h3><p>Nothing matches that filter or search.</p></div>';
    } else {
      $('noteList').innerHTML = rows.map(noteHTML).join('');
    }
    renderResurface();
  }

  function noteHTML(n) {
    var k = M.NOTE_KINDS[n.kind] || M.NOTE_KINDS.lesson;
    var chips = n.accounts.map(function (a) {
      return '<button class="tag acct" data-notacct="' + esc(a) + '">@' + esc(a) + '</button>';
    }).concat(n.tags.map(function (t) {
      return '<button class="tag" data-nottag="' + esc(t) + '">#' + esc(t) + '</button>';
    })).join('');
    var ref = 'note:' + n.id;
    var canPractise = !n.derived && (n.kind === 'objection' || n.kind === 'gotcha' || n.kind === 'competitor');
    return '<article class="note" style="--k:' + k.colour + '">' +
      '<div class="note-head"><span class="kind">' + k.label + '</span>' +
      (n.derived ? '<span class="derived">from a log entry</span>' : '') +
      '<span class="when">' + M.ago(n.ts, now()) + '</span></div>' +
      '<div class="note-body">' + esc(n.text) + '</div>' +
      '<div class="note-meta">' + chips + '<span class="note-tools">' +
      (canPractise ? '<button class="icon" data-practise="' + ref + '"' +
        (M.isPractised(db, ref) ? ' disabled' : '') + '>' + (M.isPractised(db, ref) ? 'In deck' : 'Practise') + '</button>' : '') +
      '<button class="icon" data-copynote="' + n.id + '">Copy</button>' +
      (n.derived
        ? '<button class="icon" data-goto="' + n.accountId + '">Open account</button>'
        : '<button class="icon danger" data-delnote="' + n.id + '">Delete</button>') +
      '</span></div></article>';
  }

  function renderResurface() {
    var picks = M.resurface(db, 3, now());
    if (M.allNotes(db).length < 5 || !picks.length) { $('resurface').hidden = true; return; }
    picks.forEach(function (n) { db.seen[n.id] = (db.seen[n.id] || 0) + 1; });
    $('resList').innerHTML = picks.map(function (n) {
      var k = M.NOTE_KINDS[n.kind] || M.NOTE_KINDS.lesson;
      var short = n.text.length > 150 ? n.text.slice(0, 150) + '…' : n.text;
      return '<div class="res-item"><span class="kind" style="color:' + k.colour + '">' + k.label + '</span>' +
        esc(short) + '</div>';
    }).join('');
    $('resurface').hidden = false;
    save();
  }

  function renderTopics() {
    var s = M.stats(db, now());
    $('stats').innerHTML = [
      [s.notes, 'notes'], [s.topics, 'topics'], [s.accounts, 'accounts'], [s.week, 'this week']
    ].map(function (p) { return '<div class="stat"><b>' + p[0] + '</b><span>' + p[1] + '</span></div>'; }).join('');

    var t = M.topics(db);
    $('topicList').innerHTML = t.length
      ? t.map(function (x) {
          var kinds = Object.keys(x.kinds).sort(function (a, b) { return x.kinds[b] - x.kinds[a]; });
          return '<button class="topic" data-nottag="' + esc(x.tag) + '">' +
            '<span class="topic-name">#' + esc(x.tag) + '</span>' +
            '<span class="topic-sub">' + x.count + ' note' + (x.count === 1 ? '' : 's') +
            (x.accountCount ? ' · ' + x.accountCount + ' account' + (x.accountCount === 1 ? '' : 's') : '') +
            ' · last ' + M.ago(x.last, now()) + '</span>' +
            '<span class="topic-kinds">' + kinds.map(function (k) {
              return '<i style="background:' + M.NOTE_KINDS[k].colour + '" title="' + M.NOTE_KINDS[k].label + '"></i>';
            }).join('') + '</span></button>';
        }).join('')
      : '<p class="none">No tags yet. Add <code>#something</code> to a note and it appears here.</p>';
  }

  /* -------------------------------------------------------------- practice */
  function renderPractice() {
    var due = M.dueCards(db, BASE, now()).length;
    $('duePill').innerHTML = due
      ? '<span class="due-pill">' + due + ' card' + (due === 1 ? '' : 's') + ' ready for you</span>'
      : '<span class="due-pill">All caught up. Anything now is a bonus rep.</span>';

    var total = db.reps.length;
    var last7 = db.reps.filter(function (r) { return now() - r.ts < 7 * M.DAY; }).length;
    var avg = total ? (db.reps.reduce(function (a, r) { return a + r.total; }, 0) / total).toFixed(1) : '0';
    $('repStats').innerHTML = [
      [total, 'reps'], [last7, 'this week'], [db.settings.streak || 0, 'day streak'], [avg + '/9', 'avg score']
    ].map(function (p) { return '<div class="stat"><b>' + p[0] + '</b><span>' + p[1] + '</span></div>'; }).join('');

    document.querySelectorAll('[data-timer]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.timer) === db.settings.timerLen));
    });

    var full = M.deck(db, BASE);
    $('cats').innerHTML = Object.keys(CATS).map(function (id) {
      var c = CATS[id];
      var rs = db.reps.filter(function (r) { return r.cat === id; });
      var cards = full.filter(function (k) { return k.cat === id; }).length;
      var dueN = M.dueCards(db, BASE, now()).filter(function (k) { return k.cat === id; }).length;
      var avgS = rs.length ? rs.reduce(function (a, r) { return a + r.total; }, 0) / rs.length : 0;
      return '<button class="cat" data-cat="' + id + '" style="--c:' + c.colour + '">' +
        '<span><span class="cat-name">' + c.label + '</span><br>' +
        '<span class="cat-sub">' + cards + ' cards' + (dueN ? ' · ' + dueN + ' due' : '') +
        (rs.length ? ' · ' + rs.length + ' rep' + (rs.length === 1 ? '' : 's') : ' · not started') + '</span></span>' +
        '<span class="bar-track"' + (rs.length ? '' : ' style="visibility:hidden"') +
        '><span class="bar-fill" style="width:' + (rs.length ? Math.round((avgS / 9) * 100) : 0) + '%"></span></span>' +
        '<span class="cat-score">' + (rs.length ? avgS.toFixed(1) : '') + '</span></button>';
    }).join('');
  }

  function pickCard(cat) {
    var pool = M.dueCards(db, BASE, now());
    if (cat) pool = pool.filter(function (c) { return c.cat === cat; });
    if (!pool.length) {
      pool = M.deck(db, BASE).filter(function (c) { return !cat || c.cat === cat; });
      if (!pool.length) return null;
      return pool.reduce(function (a, c) {
        var d = (db.sched[c.id] && db.sched[c.id].due) || 0;
        var ad = (db.sched[a.id] && db.sched[a.id].due) || 0;
        return d < ad ? c : a;
      }, pool[0]);
    }
    var unseen = pool.filter(function (c) { return !db.sched[c.id]; });
    var list = unseen.length ? unseen : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  function startRep(cat) {
    var card = pickCard(cat);
    if (!card) { toast('No cards in that category yet.'); return; }
    current = card; scores = {}; verdict = null; kept = false;
    var c = CATS[current.cat] || { label: 'Card', colour: '#6c63ff' };
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
    if (!db.settings.timerLen) { t.hidden = true; return; }
    remaining = db.settings.timerLen;
    t.hidden = false; t.className = 'timer';
    paint();
    timerId = setInterval(function () {
      remaining--; paint();
      if (remaining <= 0) { stopTimer(); t.classList.add('out'); t.textContent = 'Time'; }
    }, 1000);
    function paint() {
      var m = Math.floor(Math.max(remaining, 0) / 60), s = Math.max(remaining, 0) % 60;
      t.textContent = m + ':' + String(s).padStart(2, '0');
      t.classList.toggle('low', remaining <= 15 && remaining > 0);
    }
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function reveal() {
    stopTimer();
    var c = CATS[current.cat] || { label: 'Card', colour: '#6c63ff' };
    $('revCat').textContent = c.label;
    $('revCat').style.setProperty('--c', c.colour);
    $('shape').innerHTML = '<h3>The shape of a good answer</h3><ol>' +
      current.shape.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol><p class="watch"><b>Watch for:</b> ' + esc(current.watch) + '</p>';
    var ans = $('answer').value.trim();
    $('yours').hidden = !ans;
    $('yourText').textContent = ans;
    $('btnKeep').disabled = !ans;
    $('keepHint').textContent = ans ? 'Keep the answer if it is one you would use again.'
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

  function commitRep() {
    var total = (scores.clarity || 0) + (scores.evidence || 0) + (scores.control || 0);
    var s = M.schedule(db, current.id, verdict, now());
    db.reps.push({ id: current.id, cat: current.cat, ts: now(), total: total, verdict: verdict,
                   clarity: scores.clarity, evidence: scores.evidence, control: scores.control });
    var d = todayISO();
    if (db.settings.lastRepDay !== d) {
      var yest = new Date(now() - M.DAY).toISOString().slice(0, 10);
      db.settings.streak = (db.settings.lastRepDay === yest) ? (db.settings.streak || 0) + 1 : 1;
      db.settings.lastRepDay = d;
    }
    save();
    $('nextNote').textContent = 'Back in ' + s.interval + ' day' + (s.interval === 1 ? '' : 's') + '.';
    $('btnNext').disabled = false;
  }

  function renderBank() {
    if (!db.bank.length) {
      $('bankList').innerHTML = '<div class="empty"><h3>Nothing kept yet</h3>' +
        '<p>When a rep produces an answer you would genuinely use again, keep it. Those answers become the thing you take with you.</p></div>';
      return;
    }
    $('bankList').innerHTML = db.bank.map(function (b) {
      var c = CATS[b.cat] || { colour: '#6c63ff', label: 'Card' };
      return '<article class="bank-item" style="--c:' + c.colour + '">' +
        '<div class="bank-q">' + esc(b.prompt) + '</div>' +
        '<div class="bank-a">' + esc(b.text) + '</div>' +
        '<div class="bank-meta"><span>' + c.label + '</span>' +
        '<button class="icon danger" data-delbank="' + b.id + '">Remove</button></div></article>';
    }).join('');
  }

  /* ----------------------------------------------------------- mutations */
  function seg(container, value, attr) {
    container.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    });
  }

  function practise(ref) {
    if (M.isPractised(db, ref)) return;
    var parts = ref.split(':');
    var text = '', setting = '', cat = 'objection';
    if (parts[0] === 'thread') {
      var t = db.threads.filter(function (x) { return x.id === parts[1]; })[0];
      if (!t) return;
      var a = M.account(db, t.accountId);
      text = t.text;
      setting = a ? 'Raised at ' + a.name + '.' : '';
    } else {
      var n = M.allNotes(db).filter(function (x) { return x.id === parts.slice(1).join(':'); })[0];
      if (!n) return;
      text = n.text;
      setting = n.accounts.length ? 'Heard at ' + n.accounts[0] + '.' : 'From your field notes.';
      if (n.kind === 'competitor') cat = 'competitive';
    }
    db.cards.push(M.cardFromSource(text, setting, cat, 'c' + uid(), ref));
    save();
    renderAll();
    if (!$('viewDetail').hidden) renderDetail();
    toast('Added to your practice deck');
  }

  function trackNote(noteId) {
    var n = M.allNotes(db).filter(function (x) { return x.id === noteId; })[0];
    if (!n || M.isTracked(db, noteId)) return;
    db.threads.push(M.threadFromNote(n, currentId, n.kind === 'objection' ? 'objection' : 'question', uid(), now()));
    save();
    renderDetail(); renderAll();
    toast('Now tracked as an open thread');
  }

  function openAcctDialog(id) {
    editing.acct = id || null;
    var a = id ? M.account(db, id) : null;
    $('acctDlgTitle').textContent = a ? 'Edit account' : 'Add an account';
    $('aName').value = a ? a.name : '';
    $('aStage').value = a ? a.stage : M.STAGES[0];
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
      db.accounts.push({ id: id, name: name, stage: $('aStage').value, sector: $('aSector').value.trim(),
                         note: $('aNote').value.trim(), created: now(), archived: false });
      currentId = id;
    }
    save(); $('dlgAcct').close(); renderAll(); renderDetail(); show('viewDetail');
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

  function saveEntry() {
    var e = { id: uid(), accountId: currentId, ts: now(),
      meeting: $('eMeeting').value.trim(), soWhat: $('eSoWhat').value.trim(),
      theySaid: $('eTheySaid').value.trim(), learned: $('eLearned').value.trim(),
      open: $('eOpen').value.trim(), owe: $('eOwe').value.trim(), text: $('eText').value.trim() };
    if (!e.soWhat && !e.theySaid && !e.learned && !e.open && !e.owe && !e.text) { toast('Nothing to save yet'); return; }
    db.entries.push(e);
    var made = 0;
    if (e.owe) {
      db.threads.push({ id: uid(), accountId: currentId, kind: 'promise', text: e.owe,
                        due: $('eOweDue').value || null, created: now(), done: false });
      made++;
    }
    if (e.open) {
      db.threads.push({ id: uid(), accountId: currentId, kind: openKind, text: e.open,
                        due: null, created: now(), done: false });
      made++;
    }
    save(); $('dlgEntry').close(); renderAll(); renderDetail();
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

  /* ------------------------------------------------------------------ data */
  function download(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* Read whatever the three predecessor apps left in this origin. Each may have
     its own passphrase, so ask only for the ones that are actually encrypted. */
  function migrate() {
    var found = LEGACY.map(function (l) {
      return { name: l.name, raw: readRaw(l.key) };
    }).filter(function (l) { return l.raw; });

    if (!found.length) { toast('No old app data found in this browser'); return; }

    var added = 0, done = 0;
    found.forEach(function (f) {
      var finish = function (data) {
        added += M.mergeInto(db, data);
        if (++done === found.length) {
          save(); renderAll();
          toast(added ? 'Merged ' + added + ' record' + (added === 1 ? '' : 's') : 'Nothing new to merge');
          $('dlgData').close();
        }
      };
      if (Store.isEncrypted(f.raw)) {
        var pass = prompt('Found encrypted data from ' + f.name + '. Enter its passphrase, or cancel to skip it:');
        if (!pass) { finish(null); return; }
        Store.deriveKey(pass, Store.fromB64(f.raw.salt), f.raw.iter || Store.ITERATIONS)
          .then(function (k) { return Store.decryptWithKey(k, f.raw.iv, f.raw.ct); })
          .then(finish)
          .catch(function () { toast('Wrong passphrase for ' + f.name + ', skipped'); finish(null); });
      } else {
        /* Plain envelope, or the bare prototype shape. */
        finish(f.raw.data || f.raw);
      }
    });
  }

  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var env;
      try { env = JSON.parse(r.result); } catch (e) { toast('That file could not be read'); return; }
      if (!env || typeof env !== 'object' || typeof env.enc !== 'boolean') { toast('That is not a backup file'); return; }
      var go = function (data) {
        var added = M.mergeInto(db, data);
        save(); renderAll();
        toast(added ? 'Imported ' + added + ' record' + (added === 1 ? '' : 's') : 'Nothing new to import');
      };
      if (env.enc) {
        var pass = prompt('That backup is encrypted. Enter the passphrase it was saved with:');
        if (!pass) return;
        Store.deriveKey(pass, Store.fromB64(env.salt), env.iter || Store.ITERATIONS)
          .then(function (k) { return Store.decryptWithKey(k, env.iv, env.ct); })
          .then(go).catch(function () { toast('Wrong passphrase.'); });
      } else go(env.data);
    };
    r.readAsText(file);
  }

  function loadExample() {
    var id = uid(), n = now(), DAY = M.DAY;
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
      { id: uid(), accountId: id, kind: 'action', text: 'Agree the three decisive evaluation criteria before scope grows past twenty.', created: n - 5 * DAY, done: false }
    );
    db.entries.push(
      { id: uid(), accountId: id, ts: n - 9 * DAY, meeting: 'Technical deep dive, Priya and Tom',
        soWhat: 'Tom moved from blocking to willing to test. First real progress.',
        theySaid: 'We turned the last one off after six weeks. I am not doing that again.',
        learned: 'Tom’s objection is not latency, it is being blamed for a rollout. Make the measurement his, not mine.',
        open: 'No business attendee has ever joined.', owe: 'Regional data handling answer to Priya, in writing.', text: '' },
      { id: uid(), accountId: id, ts: n - 40 * DAY, meeting: 'Intro call',
        soWhat: 'Hardware refresh is the forcing function.', theySaid: '', learned: '', open: '', owe: '',
        text: 'Budget decision lands before the end of the financial year.' }
    );
    db.notes.push(
      Object.assign(M.makeNote('proof', 'Cut a VPN concentrator estate from nine to two over two quarters. #vpn #ztna @"Northbank Group (example)"', n - 20 * DAY), { id: uid() }),
      Object.assign(M.makeNote('gotcha', 'Policy import silently drops rules with unicode names. Cost us an afternoon. #dlp #tooling', n - 3 * DAY), { id: uid() })
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
    var present = LEGACY.filter(function (l) { return readRaw(l.key); }).map(function (l) { return l.name; });
    $('migrateNote').textContent = present.length
      ? 'Found data from ' + present.join(', ') + ' in this browser. Merging is by id, so running it twice changes nothing.'
      : 'Ground replaces Field Notes, Account Brain and The Dojo. Nothing from them is in this browser, so there is nothing to merge.';
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

  function goToAccount(id) {
    if (!M.account(db, id)) return;
    currentId = id;
    renderDetail();
    show('viewDetail');
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    var raw = readRaw();
    if (!raw) showLock('new');
    else if (Store.isEncrypted(raw)) { session.encrypted = true; showLock('unlock'); }
    else {
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

    $('navToday').addEventListener('click', function () { stopTimer(); renderToday(); show('viewToday'); });
    $('navAccounts').addEventListener('click', function () { stopTimer(); renderAccounts(); show('viewAccounts'); });
    $('navNotes').addEventListener('click', function () { stopTimer(); renderNotes(); show('viewNotes'); });
    $('navPractice').addEventListener('click', function () { stopTimer(); renderPractice(); show('viewPractice'); });
    $('navTopics').addEventListener('click', function () { renderTopics(); show('viewTopics'); });
    $('navAnswers').addEventListener('click', function () { renderBank(); show('viewAnswers'); });
    $('backList').addEventListener('click', function () { renderAccounts(); show('viewAccounts'); });
    $('backDetail').addEventListener('click', function () { renderDetail(); show('viewDetail'); });
    $('backNotes').addEventListener('click', function () { renderNotes(); show('viewNotes'); });
    $('backPractice').addEventListener('click', function () { renderPractice(); show('viewPractice'); });

    $('search').addEventListener('input', function (e) { renderSearch(e.target.value); });

    /* Delegated: every jump-to-account and jump-to-view affordance, anywhere. */
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]');
      if (g) { goToAccount(g.dataset.goto); return; }
      var j = e.target.closest('[data-jump]');
      if (j) {
        if (j.dataset.jump === 'practice') { renderPractice(); show('viewPractice'); }
        else { renderNotes(); show('viewNotes'); }
        return;
      }
      var a = e.target.closest('.acct[data-id]');
      if (a) { goToAccount(a.dataset.id); return; }
      var pr = e.target.closest('[data-practise]');
      if (pr && !pr.disabled) { practise(pr.dataset.practise); return; }
      var tr = e.target.closest('[data-track]');
      if (tr && !tr.disabled) { trackNote(tr.dataset.track); return; }
      var tg = e.target.closest('[data-nottag]');
      if (tg) { noteFilter.tag = tg.dataset.nottag; noteFilter.account = null; renderNotes(); show('viewNotes'); return; }
      var ac = e.target.closest('[data-notacct]');
      if (ac) { noteFilter.account = ac.dataset.notacct; noteFilter.tag = null; renderNotes(); show('viewNotes'); }
    });

    /* accounts */
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

    /* entries */
    $('btnAddEntry').addEventListener('click', openEntryDialog);
    $('btnSaveEntry').addEventListener('click', saveEntry);
    $('eOwe').addEventListener('input', function (e) {
      var has = !!e.target.value.trim();
      $('eOweDueWrap').hidden = !has;
      if (has && !$('eOweDue').value) $('eOweDue').value = todayISO();
    });
    $('eOpen').addEventListener('input', function (e) { $('eOpenKindWrap').hidden = !e.target.value.trim(); });
    $('eOpenKind').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      openKind = b.dataset.kind;
      seg($('eOpenKind'), openKind, 'kind');
    });

    /* people and threads */
    $('btnAddPerson').addEventListener('click', function () { openPersonDialog(null); });
    $('pStance').addEventListener('click', function (e) {
      var b = e.target.closest('[data-stance]');
      if (!b) return;
      pStance = b.dataset.stance;
      seg($('pStance'), pStance, 'stance');
    });
    $('btnSavePerson').addEventListener('click', function () {
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
    });
    $('btnDelPerson').addEventListener('click', function () {
      db.people = db.people.filter(function (x) { return x.id !== editing.person; });
      save(); $('dlgPerson').close(); renderDetail(); toast('Removed');
    });

    $('btnAddThread').addEventListener('click', function () { openThreadDialog(null); });
    $('tKind').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      tKind = b.dataset.kind;
      seg($('tKind'), tKind, 'kind');
    });
    $('btnSaveThread').addEventListener('click', function () {
      var text = $('tText').value.trim();
      if (!text) { $('tText').focus(); return; }
      if (editing.thread) {
        var t = db.threads.filter(function (x) { return x.id === editing.thread; })[0];
        t.kind = tKind; t.text = text; t.due = $('tDue').value || null;
      } else {
        db.threads.push({ id: uid(), accountId: currentId, kind: tKind, text: text,
                          due: $('tDue').value || null, created: now(), done: false });
      }
      save(); $('dlgThread').close(); renderDetail(); renderAll();
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
        if (t) { t.done = !t.done; t.doneAt = t.done ? now() : null; save(); renderDetail(); renderAll(); }
        return;
      }
      var ep = e.target.closest('[data-editperson]');
      if (ep) { openPersonDialog(ep.dataset.editperson); return; }
      var et = e.target.closest('[data-editthread]');
      if (et) { openThreadDialog(et.dataset.editthread); return; }
      var de = e.target.closest('[data-delentry]');
      if (de) {
        if (!confirm('Remove this log entry?\n\nAny threads it created stay, so nothing you promised is lost. Its "I learned" line will disappear from Notes, because that line lives here.')) return;
        db.entries = db.entries.filter(function (x) { return x.id !== de.dataset.delentry; });
        save(); renderDetail(); renderAll(); toast('Removed');
      }
    });

    $('btnBrief').addEventListener('click', renderBrief);
    $('btnPrint').addEventListener('click', function () { window.print(); });
    $('btnCopyBrief').addEventListener('click', function () { copy(M.briefText(M.buildBrief(db, currentId, now()))); });
    $('btnCopyCrm').addEventListener('click', function () {
      copy(M.crmText(M.buildBrief(db, currentId, now())));
      toast('CRM lines copied');
    });
    $('btnPack').addEventListener('click', function () { openPack('Context pack', M.accountPack(db, currentId, now())); });
    $('btnPortfolioPack').addEventListener('click', function () { openPack('Portfolio pack', M.portfolioPack(db, now())); });

    /* notes */
    $('kinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-notekind]');
      if (!b) return;
      db.settings.lastNoteKind = b.dataset.notekind;
      seg($('kinds'), db.settings.lastNoteKind, 'notekind');
      save();
    });
    $('note').addEventListener('input', function (e) {
      var has = e.target.value.trim().length > 0;
      $('btnSaveNote').disabled = !has;
      $('capture').classList.toggle('armed', has);
    });
    $('note').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addNote(); }
    });
    $('btnSaveNote').addEventListener('click', addNote);
    function addNote() {
      var text = $('note').value.trim();
      if (!text) return;
      var n = M.makeNote(db.settings.lastNoteKind, text, now(), 'typed');
      n.id = uid();
      db.notes.unshift(n);
      $('note').value = '';
      $('btnSaveNote').disabled = true;
      $('capture').classList.remove('armed');
      save(); renderAll(); toast('Saved');
    }
    $('noteSearch').addEventListener('input', function (e) { noteFilter.query = e.target.value; renderNotes(); });
    $('btnClearNotes').addEventListener('click', function () {
      noteFilter = { kind: 'all', tag: null, account: null, query: '' };
      $('noteSearch').value = '';
      renderNotes();
    });
    $('noteFilters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-notefilter]');
      if (b) { noteFilter.kind = b.dataset.notefilter; renderNotes(); }
    });
    $('activeScope').addEventListener('click', function (e) {
      var b = e.target.closest('[data-clearscope]');
      if (b) { noteFilter[b.dataset.clearscope] = null; renderNotes(); }
    });
    $('noteList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-delnote]');
      if (del) {
        var n = db.notes.filter(function (x) { return x.id === del.dataset.delnote; })[0];
        if (n && confirm('Delete this note?\n\n' + n.text.slice(0, 140))) {
          db.notes = db.notes.filter(function (x) { return x.id !== del.dataset.delnote; });
          save(); renderAll(); toast('Deleted');
        }
        return;
      }
      var cp = e.target.closest('[data-copynote]');
      if (cp) {
        var m = M.allNotes(db).filter(function (x) { return x.id === cp.dataset.copynote; })[0];
        if (m) copy(m.text);
      }
    });
    $('btnNotesPack').addEventListener('click', function () { openPack('Notes pack', M.notesPack(db, noteFilter, now())); });

    /* practice */
    $('btnStart').addEventListener('click', function () { startRep(null); });
    $('cats').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) startRep(b.dataset.cat);
    });
    document.querySelectorAll('[data-timer]').forEach(function (b) {
      b.addEventListener('click', function () {
        db.settings.timerLen = Number(b.dataset.timer);
        save(); renderPractice();
      });
    });
    $('btnReveal').addEventListener('click', reveal);
    $('btnQuit').addEventListener('click', function () { stopTimer(); renderPractice(); show('viewPractice'); });
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
      if (verdict) commitRep();
    });
    $('verdict').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (!b) return;
      document.querySelectorAll('.vb').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      verdict = b.dataset.v;
      commitRep();
    });
    $('btnKeep').addEventListener('click', function () {
      var text = $('answer').value.trim();
      if (!text || kept) return;
      db.bank = db.bank.filter(function (b) { return !(b.cardId === current.id && b.text === text); });
      db.bank.unshift({ id: uid(), cardId: current.id, cat: current.cat, prompt: current.prompt, text: text, ts: now() });
      kept = true;
      $('btnKeep').textContent = 'Kept';
      save(); renderBank(); toast('Added to your answer bank');
    });
    $('btnNext').addEventListener('click', function () { startRep(null); });
    $('bankList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-delbank]');
      if (!b) return;
      db.bank = db.bank.filter(function (x) { return x.id !== b.dataset.delbank; });
      save(); renderBank(); toast('Removed');
    });
    $('btnAnswerPack').addEventListener('click', function () { openPack('Answer bank', M.answerPack(db, now())); });
    $('btnCopyPack').addEventListener('click', function () { copy($('packOut').value); });

    /* settings */
    $('btnData').addEventListener('click', function () { renderSecurity(); $('dlgData').showModal(); });
    $('btnMigrate').addEventListener('click', migrate);
    $('btnImport').addEventListener('click', function () { $('file').click(); });
    $('file').addEventListener('change', function (e) {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });
    $('btnExportEnc').addEventListener('click', function () {
      if (!session.encrypted || !session.key) { toast('Set a passphrase first.'); return; }
      Store.reseal(db, session.key, session.salt, session.iter).then(function (env) {
        download(env, 'ground-encrypted-' + todayISO() + '.json');
        toast('Encrypted backup saved');
      });
    });
    $('btnExportPlain').addEventListener('click', function () {
      if (!confirm('This file is NOT encrypted.\n\nIt contains customer names, roles and things people said to you in confidence. Anyone who opens it can read all of it.\n\nContinue?')) return;
      download(Store.plainEnvelope(db), 'ground-plain-' + todayISO() + '.json');
      toast('Plain backup saved');
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
      if (!confirm('Erase every account, note, rep and answer?\n\nThis clears only Ground. Nothing else in this browser is touched. It cannot be undone.')) return;
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
          db.settings.lockMins && Date.now() - lastActive > db.settings.lockMins * 60000) lock();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
