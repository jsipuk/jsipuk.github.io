/* Field Notes — app layer.
 *
 * Persistence, the lock, and rendering. Cryptography is in store.js; every rule
 * worth arguing about is in model.js, which is pure and tested. No business
 * logic belongs in this file.
 */
(function () {
  'use strict';

  var Store = window.SecureStore;
  var M = window.FNModel;
  var KEY = 'fieldnotes:v1';

  var db = M.blankDb();
  var session = { key: null, salt: null, iter: null, encrypted: false, unlocked: false };
  var filter = { kind: 'all', tag: null, account: null, query: '' };
  var idleTimer = null, lastActive = Date.now();

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
  var VIEWS = ['viewNotes', 'viewTopics'];
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
      ? 'This page is public. Your notes are not: they stay in this browser and are never sent anywhere. Notes here can name real customers, so a passphrase is recommended.<br><br><strong>There is no recovery.</strong> Forget it and the data is gone, which is what makes it work.'
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
    buildKindChips();
    renderAll();
    show('viewNotes');
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

  /* --------------------------------------------------------------- capture */
  function buildKindChips() {
    $('kinds').innerHTML = M.KIND_ORDER.map(function (k) {
      var c = M.KINDS[k];
      return '<button class="chip" data-kind="' + k + '" title="' + esc(c.hint) + '" ' +
        'aria-pressed="' + (k === db.settings.lastKind) + '">' + c.label + '</button>';
    }).join('');
  }

  function setKind(k) {
    db.settings.lastKind = k;
    document.querySelectorAll('[data-kind]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.kind === k));
    });
    save();
  }

  function addNote() {
    var text = $('note').value.trim();
    if (!text) return;
    var n = M.makeNote(db.settings.lastKind, text, Date.now(), 'typed');
    n.id = uid();
    db.notes.unshift(n);
    $('note').value = '';
    $('btnSave').disabled = true;
    $('capture').classList.remove('armed');
    save();
    renderAll();
    toast('Saved');
  }

  /* ---------------------------------------------------------------- render */
  function renderAll() { renderList(); renderTopics(); }

  function renderFilters() {
    var c = M.kindCounts(db);
    var items = [{ id: 'all', label: 'All' }].concat(
      M.KIND_ORDER.filter(function (k) { return c[k]; })
        .map(function (k) { return { id: k, label: M.KINDS[k].label }; }));
    $('filters').innerHTML = items.map(function (k) {
      return '<button class="chip" data-filter="' + k.id + '" aria-pressed="' + (k.id === filter.kind) + '">' +
        k.label + ' <span style="opacity:.6">' + (c[k.id] || 0) + '</span></button>';
    }).join('');
  }

  function renderScope() {
    var bits = [];
    if (filter.tag) bits.push('<button class="scope" data-clear="tag">#' + esc(filter.tag) + ' ×</button>');
    if (filter.account) bits.push('<button class="scope acct" data-clear="account">@' + esc(filter.account) + ' ×</button>');
    $('activeScope').innerHTML = bits.join('');
    $('activeScope').hidden = !bits.length;
  }

  function renderList() {
    renderFilters();
    renderScope();
    var rows = M.filterNotes(db, filter);
    var total = db.notes.length;

    $('count').textContent = !total ? ''
      : rows.length === total ? total + ' note' + (total === 1 ? '' : 's')
      : rows.length + ' of ' + total + ' notes';

    if (!total) {
      $('list').innerHTML =
        '<div class="empty"><h3>Nothing here yet, which is the point</h3>' +
        '<p>This fills up from work you are already doing. Capture the things that would otherwise be gone by Friday:</p>' +
        '<ul>' +
        '<li>A limitation you found the hard way</li>' +
        '<li>The sentence that made an objection land</li>' +
        '<li>A proof point you can reuse anywhere</li>' +
        '<li>Something a competitor said, first hand</li>' +
        '<li>Anything you learned about the job itself</li>' +
        '</ul>' +
        '<p style="margin-top:1rem">Already using Account Brain? <button class="linky" id="emptyImport">Import from it</button> and this starts full rather than empty.</p>' +
        '</div>';
      var ei = $('emptyImport');
      if (ei) ei.addEventListener('click', function () { $('fileAB').click(); });
    } else if (!rows.length) {
      $('list').innerHTML = '<div class="empty"><h3>No match</h3><p>Nothing matches that filter or search.</p></div>';
    } else {
      $('list').innerHTML = rows.map(noteHTML).join('');
    }
    renderResurface();
  }

  function noteHTML(n) {
    var k = M.KINDS[n.kind] || M.KINDS.lesson;
    var chips = n.accounts.map(function (a) {
      return '<button class="tag acct" data-acct="' + esc(a) + '">@' + esc(a) + '</button>';
    }).concat(n.tags.map(function (t) {
      return '<button class="tag" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
    })).join('');
    return '<article class="note" style="--k:' + k.colour + '">' +
      '<div class="note-head"><span class="kind">' + k.label + '</span>' +
      (n.source === 'account-brain' ? '<span class="src">from Account Brain</span>' : '') +
      '<span class="when">' + M.ago(n.ts, now()) + '</span></div>' +
      '<div class="note-body">' + esc(n.text) + '</div>' +
      '<div class="note-meta">' + chips +
      '<span class="note-tools">' +
      '<button class="icon" data-copy="' + n.id + '">Copy</button>' +
      '<button class="icon danger" data-del="' + n.id + '">Delete</button>' +
      '</span></div></article>';
  }

  function renderResurface() {
    var picks = M.resurface(db, 3, now());
    if (db.notes.length < 5 || !picks.length) { $('resurface').hidden = true; return; }
    picks.forEach(function (n) { n.seen = (n.seen || 0) + 1; });
    $('resList').innerHTML = picks.map(function (n) {
      var k = M.KINDS[n.kind] || M.KINDS.lesson;
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
    ].map(function (p) {
      return '<div class="stat"><b>' + p[0] + '</b><span>' + p[1] + '</span></div>';
    }).join('');

    var t = M.topics(db);
    $('topicList').innerHTML = t.length
      ? t.map(function (x) {
          var kinds = Object.keys(x.kinds).sort(function (a, b) { return x.kinds[b] - x.kinds[a]; });
          return '<button class="topic" data-tag="' + esc(x.tag) + '">' +
            '<span class="topic-name">#' + esc(x.tag) + '</span>' +
            '<span class="topic-sub">' + x.count + ' note' + (x.count === 1 ? '' : 's') +
            (x.accountCount ? ' · ' + x.accountCount + ' account' + (x.accountCount === 1 ? '' : 's') : '') +
            ' · last ' + M.ago(x.last, now()) + '</span>' +
            '<span class="topic-kinds">' + kinds.map(function (k) {
              return '<i style="background:' + M.KINDS[k].colour + '" title="' + M.KINDS[k].label + '"></i>';
            }).join('') + '</span></button>';
        }).join('')
      : '<p class="none">No tags yet. Add <code>#something</code> to a note and it appears here.</p>';

    var a = M.accountsIndex(db);
    $('accountList').innerHTML = a.length
      ? a.map(function (x) {
          return '<button class="topic" data-acct="' + esc(x.name) + '">' +
            '<span class="topic-name">@' + esc(x.name) + '</span>' +
            '<span class="topic-sub">' + x.count + ' note' + (x.count === 1 ? '' : 's') +
            ' · last ' + M.ago(x.last, now()) + '</span></button>';
        }).join('')
      : '<p class="none">No accounts mentioned yet. Add <code>@Name</code> to a note.</p>';
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

  function readEnvelope(file, appLabel, then) {
    var r = new FileReader();
    r.onload = function () {
      var env;
      try { env = JSON.parse(r.result); } catch (e) { toast('That file could not be read'); return; }
      if (!env || typeof env !== 'object' || typeof env.enc !== 'boolean') {
        toast('That is not a ' + appLabel + ' backup'); return;
      }
      if (env.enc) {
        var pass = prompt('That backup is encrypted. Enter the passphrase it was saved with:');
        if (!pass) return;
        /* Decrypt directly rather than via unseal, so a backup from a sibling
           app can be read here without the app-name check rejecting it. */
        var iter = env.iter || Store.ITERATIONS;
        Store.deriveKey(pass, Store.fromB64(env.salt), iter)
          .then(function (key) { return Store.decryptWithKey(key, env.iv, env.ct); })
          .then(then)
          .catch(function () { toast('Wrong passphrase.'); });
      } else {
        then(env.data);
      }
    };
    r.readAsText(file);
  }

  function importOwn(file) {
    readEnvelope(file, 'Field Notes', function (data) {
      var incoming = M.sanitiseDb(data);
      var have = {};
      db.notes.forEach(function (n) { have[n.id] = true; });
      var added = 0;
      incoming.notes.forEach(function (n) { if (!have[n.id]) { db.notes.push(n); added++; } });
      db.notes.sort(function (a, b) { return b.ts - a.ts; });
      save(); renderAll();
      toast(added ? 'Imported ' + added + ' note' + (added === 1 ? '' : 's') : 'Nothing new to import');
    });
  }

  function importFromAccountBrain(file) {
    readEnvelope(file, 'Account Brain', function (data) {
      /* Distinguish "not an Account Brain file" from "nothing new in it", so a
         wrong file does not look like a successful no-op. */
      if (!data || !Array.isArray(data.accounts)) {
        toast('That is not an Account Brain backup');
        return;
      }
      var fresh = M.fromAccountBrain(data, db.notes);
      if (!fresh.length) { toast('Nothing new to bring across'); return; }
      fresh.forEach(function (n) { n.id = uid(); db.notes.push(n); });
      db.notes.sort(function (a, b) { return b.ts - a.ts; });
      save(); renderAll();
      $('dlgData').close();
      toast('Brought across ' + fresh.length + ' note' + (fresh.length === 1 ? '' : 's'));
    });
  }

  function renderSecurity() {
    $('secState').innerHTML = session.encrypted
      ? '<span class="ok-dot"></span>Encrypted at rest. Auto-locks after ' + db.settings.lockMins + ' minutes idle.'
      : '<span class="warn-dot"></span>Not encrypted. Notes are stored as readable text in this browser.';
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

  /* ------------------------------------------------------------------ boot */
  function boot() {
    var raw = readRaw();
    if (!raw) {
      showLock('new');
    } else if (Store.isEncrypted(raw)) {
      session.encrypted = true;
      showLock('unlock');
    } else if (M.isLegacyPrototype(raw)) {
      /* Data left behind by the throwaway prototype, which shared this origin. */
      db = M.sanitiseDb(raw);
      session.encrypted = false;
      writeRaw(Store.plainEnvelope(db));
      enterApp();
      if (db.notes.length) toast('Brought ' + db.notes.length + ' note' + (db.notes.length === 1 ? '' : 's') + ' across from the prototype');
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

    $('navNotes').addEventListener('click', function () { renderList(); show('viewNotes'); });
    $('navTopics').addEventListener('click', function () { renderTopics(); show('viewTopics'); });

    $('kinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (b) setKind(b.dataset.kind);
    });
    $('note').addEventListener('input', function (e) {
      var has = e.target.value.trim().length > 0;
      $('btnSave').disabled = !has;
      $('capture').classList.toggle('armed', has);
    });
    $('note').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addNote(); }
    });
    $('btnSave').addEventListener('click', addNote);

    $('search').addEventListener('input', function (e) { filter.query = e.target.value; renderList(); });
    $('btnClear').addEventListener('click', function () {
      filter = { kind: 'all', tag: null, account: null, query: '' };
      $('search').value = '';
      renderList();
    });
    $('filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (b) { filter.kind = b.dataset.filter; renderList(); }
    });
    $('activeScope').addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]');
      if (b) { filter[b.dataset.clear] = null; renderList(); }
    });

    /* Tag and account chips work from anywhere, including the Topics view. */
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tag]');
      if (t) { filter.tag = t.dataset.tag; filter.account = null; renderList(); show('viewNotes'); return; }
      var a = e.target.closest('[data-acct]');
      if (a) { filter.account = a.dataset.acct; filter.tag = null; renderList(); show('viewNotes'); }
    });

    $('list').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        var n = db.notes.filter(function (x) { return x.id === del.dataset.del; })[0];
        if (n && confirm('Delete this note?\n\n' + n.text.slice(0, 140))) {
          db.notes = db.notes.filter(function (x) { return x.id !== del.dataset.del; });
          save(); renderAll(); toast('Deleted');
        }
        return;
      }
      var cp = e.target.closest('[data-copy]');
      if (cp) {
        var m = db.notes.filter(function (x) { return x.id === cp.dataset.copy; })[0];
        if (m) copy(m.text);
      }
    });

    $('btnPack').addEventListener('click', function () {
      $('packOut').value = M.buildPack(db, filter, now());
      $('dlgPack').showModal();
    });
    $('btnCopyPack').addEventListener('click', function () { copy($('packOut').value); });

    $('btnToDojo').addEventListener('click', function () {
      var rows = M.filterNotes(db, filter);
      var env = M.dojoCardEnvelope(rows);
      if (!env.data.custom.length) {
        toast('Nothing in scope makes a practice card. Try objections, gotchas or competitor notes.');
        return;
      }
      download(env, 'dojo-cards-' + todayISO() + '.json');
      toast(env.data.custom.length + ' card' + (env.data.custom.length === 1 ? '' : 's') + ' saved. Import it in The Dojo.');
    });

    $('btnData').addEventListener('click', function () { renderSecurity(); $('dlgData').showModal(); });
    $('btnFromAB').addEventListener('click', function () { $('fileAB').click(); });
    $('fileAB').addEventListener('change', function (e) {
      if (e.target.files[0]) importFromAccountBrain(e.target.files[0]);
      e.target.value = '';
    });
    $('btnImport').addEventListener('click', function () { $('file').click(); });
    $('file').addEventListener('change', function (e) {
      if (e.target.files[0]) importOwn(e.target.files[0]);
      e.target.value = '';
    });
    $('btnExportEnc').addEventListener('click', function () {
      if (!session.encrypted || !session.key) { toast('Set a passphrase first.'); return; }
      Store.reseal(db, session.key, session.salt, session.iter).then(function (env) {
        download(env, 'field-notes-encrypted-' + todayISO() + '.json');
        toast('Encrypted backup saved');
      });
    });
    $('btnExportPlain').addEventListener('click', function () {
      if (!confirm('This file is NOT encrypted.\n\nIt may name real customers. Anyone who opens it can read every note.\n\nContinue?')) return;
      download(Store.plainEnvelope(db), 'field-notes-plain-' + todayISO() + '.json');
      toast('Plain backup saved');
    });

    $('btnSetPass').addEventListener('click', function () {
      var p1 = prompt(session.encrypted
        ? 'New passphrase (at least 8 characters). Your existing notes are re-encrypted with it.'
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
      if (!confirm('Remove encryption?\n\nYour notes will be stored in this browser as readable text.\n\nContinue?')) return;
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
      if (!confirm('Erase every note?\n\nThis clears only Field Notes. Nothing else in this browser is touched. It cannot be undone.')) return;
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

    document.addEventListener('keydown', function (e) {
      if (!session.unlocked || e.target.matches('input,textarea')) return;
      if (e.key === '/') { e.preventDefault(); $('search').focus(); }
      if (e.key === 'n') { e.preventDefault(); $('note').focus(); }
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
