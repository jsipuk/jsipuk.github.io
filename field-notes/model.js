/* Field Notes — the model.
 *
 * No DOM, no storage, no clock of its own: every function that needs "now"
 * takes it as an argument, so all of this runs and is tested under Node.
 *
 * Where this sits next to the other two apps, because the boundary is the
 * whole reason it exists separately:
 *
 *   Account Brain  is account shaped.  Everything hangs off one customer.
 *   The Dojo       is skill shaped.    Everything hangs off one question.
 *   Field Notes    is topic shaped.    Everything hangs off a subject, and
 *                                      most of it belongs to no account at all.
 *
 * The things with no home in the other two: a limitation you found in a lab, a
 * proof point you can reuse anywhere, a competitor line you heard at a
 * conference, an answer that worked across three deals. Those are what this is
 * for. It also ingests the account-independent parts of Account Brain, so the
 * question "what do I actually know about DLP" has one place to be asked.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FNModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;

  /* Deliberately no "person" kind: who someone is and where they stand is
     Account Brain's job, and duplicating it would leave two half-right copies
     of the same stakeholder. */
  var KINDS = {
    objection:  { label: 'Objection',   colour: '#fb7185', hint: 'What they pushed back on' },
    answer:     { label: 'Answer',      colour: '#4ade80', hint: 'A response that landed' },
    question:   { label: 'Question',    colour: '#a89dff', hint: 'A question that opened something up' },
    proof:      { label: 'Proof point', colour: '#38bdf8', hint: 'A real outcome you can reference again' },
    gotcha:     { label: 'Gotcha',      colour: '#fbbf24', hint: 'A limitation or trap you hit' },
    competitor: { label: 'Competitor',  colour: '#f472b6', hint: 'Something you heard first hand' },
    lesson:     { label: 'Lesson',      colour: '#94a3b8', hint: 'Something you learned about the job' }
  };

  var KIND_ORDER = ['objection', 'answer', 'question', 'proof', 'gotcha', 'competitor', 'lesson'];

  function blankDb() {
    return { notes: [], settings: { lockMins: 15, lastKind: 'objection' } };
  }

  /* ------------------------------------------------------------------ parse */
  /* Tags and accounts are written inline so capture stays a single field:
       #tag            a topic
       @Account        a customer, or @"Two Word Co" when it has spaces
     Both are kept in the body text too, so nothing is lost if the parse rules
     ever change. */
  function parse(text) {
    var tags = [], accounts = [], m;
    var tagRe = /#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
    var acctRe = /@(?:"([^"]+)"|([\p{L}\p{N}][\p{L}\p{N}_&.-]*))/gu;
    while ((m = tagRe.exec(text))) tags.push(m[1].toLowerCase());
    while ((m = acctRe.exec(text))) accounts.push((m[1] || m[2]).trim());
    return { tags: unique(tags), accounts: unique(accounts) };
  }

  function unique(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var k = String(x).toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }

  function makeNote(kind, text, ts, source) {
    var p = parse(text);
    return {
      id: null,                                   // assigned by the caller
      kind: KINDS[kind] ? kind : 'lesson',
      text: String(text).trim(),
      tags: p.tags,
      accounts: p.accounts,
      ts: ts,
      seen: 0,
      source: source || 'typed'
    };
  }

  /* ------------------------------------------------------------------- time */
  function daysSince(ts, now) {
    var a = new Date(ts); a.setHours(0, 0, 0, 0);
    var b = new Date(now); b.setHours(0, 0, 0, 0);
    return Math.floor((b.getTime() - a.getTime()) / DAY);
  }

  function ago(ts, now) {
    var d = daysSince(ts, now);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    if (d < 365) { var m = Math.round(d / 30); return m + ' month' + (m === 1 ? '' : 's') + ' ago'; }
    var y = Math.round(d / 365);
    return y + ' year' + (y === 1 ? '' : 's') + ' ago';
  }

  /* ----------------------------------------------------------------- filter */
  /* One filter function for the list, the counts and the context pack, so the
     pack can never disagree with what is on screen. */
  function filterNotes(db, f) {
    f = f || {};
    var q = String(f.query || '').trim().toLowerCase();
    return db.notes.filter(function (n) {
      if (f.kind && f.kind !== 'all' && n.kind !== f.kind) return false;
      if (f.tag && n.tags.map(lower).indexOf(lower(f.tag)) === -1) return false;
      if (f.account && n.accounts.map(lower).indexOf(lower(f.account)) === -1) return false;
      if (!q) return true;
      return (n.text + ' ' + n.tags.join(' ') + ' ' + n.accounts.join(' ')).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return b.ts - a.ts; });
  }

  function lower(s) { return String(s).toLowerCase(); }

  function kindCounts(db) {
    var c = { all: db.notes.length };
    db.notes.forEach(function (n) { c[n.kind] = (c[n.kind] || 0) + 1; });
    return c;
  }

  /* ----------------------------------------------------------------- topics */
  /* The view neither other app has: what do I know about a subject, regardless
     of which customer it came from. */
  function topics(db) {
    var map = {};
    db.notes.forEach(function (n) {
      n.tags.forEach(function (t) {
        var k = lower(t);
        if (!map[k]) map[k] = { tag: k, count: 0, kinds: {}, accounts: {}, last: 0 };
        map[k].count++;
        map[k].kinds[n.kind] = (map[k].kinds[n.kind] || 0) + 1;
        n.accounts.forEach(function (a) { map[k].accounts[lower(a)] = true; });
        if (n.ts > map[k].last) map[k].last = n.ts;
      });
    });
    return Object.keys(map).map(function (k) {
      var t = map[k];
      t.accountCount = Object.keys(t.accounts).length;
      return t;
    }).sort(function (a, b) { return b.count - a.count || b.last - a.last; });
  }

  function accountsIndex(db) {
    var map = {};
    db.notes.forEach(function (n) {
      n.accounts.forEach(function (a) {
        var k = lower(a);
        if (!map[k]) map[k] = { name: a, count: 0, last: 0 };
        map[k].count++;
        if (n.ts > map[k].last) map[k].last = n.ts;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  /* ------------------------------------------------------------- resurface */
  /* A library you never meet again is a graveyard. Deterministic on purpose:
     least-seen first, then oldest, so it is testable and so the same notes do
     not reappear at random while others are never shown. */
  function resurface(db, n, now) {
    var pool = db.notes.filter(function (x) { return daysSince(x.ts, now) >= 1; });
    return pool.slice().sort(function (a, b) {
      return (a.seen || 0) - (b.seen || 0) || a.ts - b.ts;
    }).slice(0, n || 3);
  }

  /* ---------------------------------------------------------- context pack */
  function scopeLabel(f) {
    f = f || {};
    var bits = [];
    bits.push(f.kind && f.kind !== 'all' ? KINDS[f.kind].label.toLowerCase() + ' notes' : 'all notes');
    if (f.tag) bits.push('tagged #' + f.tag);
    if (f.account) bits.push('for @' + f.account);
    if (f.query) bits.push('matching "' + f.query + '"');
    return bits.join(', ');
  }

  function buildPack(db, f, now) {
    var rows = filterNotes(db, f);
    var L = ['# Field notes context pack', ''];
    L.push('Scope: ' + scopeLabel(f) + '. ' + rows.length + ' note' + (rows.length === 1 ? '' : 's') +
           ', exported ' + new Date(now).toISOString().slice(0, 10) + '.');
    L.push('');
    L.push('These are first-hand notes from real customer conversations and real');
    L.push('hands-on work. Treat them as the ground truth for what has actually been');
    L.push('said, heard and tried. Where they conflict with general knowledge, prefer');
    L.push('these. Do not invent product claims, statistics or competitor gaps that do');
    L.push('not appear below.');
    L.push('');
    KIND_ORDER.forEach(function (k) {
      var group = rows.filter(function (n) { return n.kind === k; });
      if (!group.length) return;
      L.push('## ' + KINDS[k].label, '');
      group.forEach(function (n) {
        L.push('- ' + n.text.replace(/\s+/g, ' ').trim());
        var meta = n.accounts.map(function (a) { return '@' + a; })
          .concat(n.tags.map(function (t) { return '#' + t; })).join(' ');
        if (meta) L.push('  _(' + meta + ', ' + ago(n.ts, now) + ')_');
      });
      L.push('');
    });
    if (!rows.length) L.push('_No notes in scope yet._');
    return L.join('\n').trim() + '\n';
  }

  /* ------------------------------------------------------- app-to-app flow */
  /* Pull the account-independent parts of an Account Brain store in as notes.
     Only two mappings, both unambiguous:
       entry.learned            -> lesson
       open objection threads   -> objection
     Nothing else is guessed. A quote, for instance, is as often a proof point
     as an objection, so importing it under either label would be wrong half the
     time and the wrong label is worse than no note. */
  function fromAccountBrain(abDb, existing) {
    if (!abDb || !Array.isArray(abDb.accounts)) return [];
    var names = {};
    abDb.accounts.forEach(function (a) { if (a && a.id) names[a.id] = a.name; });

    var seen = {};
    (existing || []).forEach(function (n) { seen[fingerprint(n.text)] = true; });

    var out = [];
    var push = function (kind, text, ts, account) {
      if (!text) return;
      var tag = account ? ' @"' + account + '"' : '';
      var body = String(text).trim() + tag;
      var fp = fingerprint(body);
      if (seen[fp]) return;
      seen[fp] = true;
      out.push(makeNote(kind, body, ts || Date.now(), 'account-brain'));
    };

    (abDb.entries || []).forEach(function (e) {
      if (e && e.learned) push('lesson', e.learned, e.ts, names[e.accountId]);
    });
    (abDb.threads || []).forEach(function (t) {
      if (t && t.kind === 'objection' && !t.done) push('objection', t.text, t.created, names[t.accountId]);
    });
    return out;
  }

  function fingerprint(text) {
    return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* Emit a Dojo-shaped plain envelope so objections and gotchas collected here
     can be practised. Only kinds that make a sensible rehearsal prompt. */
  function dojoCardEnvelope(notes) {
    var usable = notes.filter(function (n) {
      return n.kind === 'objection' || n.kind === 'gotcha' || n.kind === 'competitor';
    });
    return {
      app: 'dojo', v: 1, enc: false,
      data: {
        custom: usable.map(function (n, i) {
          var where = n.accounts.length ? 'Heard at ' + n.accounts[0] + '.' : 'From your field notes.';
          return {
            id: 'fn' + n.id + i,
            cat: n.kind === 'competitor' ? 'competitive' : 'objection',
            prompt: n.text,
            setting: where,
            shape: ['Answer it the way you wish you had the first time.'],
            watch: 'Whatever you got wrong when this actually came up.'
          };
        })
      }
    };
  }

  /* ------------------------------------------------------------- migration */
  /* The throwaway prototype at /whats-missing/v1-field-notes/ wrote a bare
     {v, kind, notes} object to the same origin, so its data is still sitting
     there. Recognise and lift it rather than silently discarding it. */
  function isLegacyPrototype(raw) {
    return !!raw && typeof raw === 'object' && !raw.app && Array.isArray(raw.notes);
  }

  function sanitiseDb(raw) {
    var db = blankDb();
    if (!raw || typeof raw !== 'object') return db;
    var list = Array.isArray(raw.notes) ? raw.notes : [];
    var seenIds = {};
    list.forEach(function (n) {
      if (!n || typeof n.text !== 'string' || !n.text.trim()) return;
      var id = n.id || ('m' + Object.keys(seenIds).length + '-' + Math.random().toString(36).slice(2, 7));
      if (seenIds[id]) return;
      seenIds[id] = true;
      db.notes.push({
        id: id,
        /* "person" was a kind in the prototype. It is Account Brain's job now,
           so those notes land as lessons rather than being dropped. */
        kind: KINDS[n.kind] ? n.kind : 'lesson',
        text: n.text,
        tags: Array.isArray(n.tags) ? n.tags.filter(isStr) : [],
        accounts: Array.isArray(n.accounts) ? n.accounts.filter(isStr) : [],
        ts: typeof n.ts === 'number' && isFinite(n.ts) ? n.ts : Date.now(),
        seen: typeof n.seen === 'number' && isFinite(n.seen) ? n.seen : 0,
        source: isStr(n.source) ? n.source : 'typed'
      });
    });
    db.notes.sort(function (a, b) { return b.ts - a.ts; });
    if (raw.settings && typeof raw.settings === 'object') {
      var lm = raw.settings.lockMins;
      db.settings.lockMins = (typeof lm === 'number' && isFinite(lm)) ? lm : 15;
      db.settings.lastKind = KINDS[raw.settings.lastKind] ? raw.settings.lastKind : 'objection';
    } else if (KINDS[raw.kind]) {
      db.settings.lastKind = raw.kind;                      // prototype stored it at the top level
    }
    return db;
  }

  function isStr(x) { return typeof x === 'string' && x.length > 0; }

  /* ----------------------------------------------------------------- stats */
  function stats(db, now) {
    var accounts = {}, tags = {};
    db.notes.forEach(function (n) {
      n.accounts.forEach(function (a) { accounts[lower(a)] = true; });
      n.tags.forEach(function (t) { tags[lower(t)] = true; });
    });
    return {
      notes: db.notes.length,
      accounts: Object.keys(accounts).length,
      topics: Object.keys(tags).length,
      week: db.notes.filter(function (n) { return daysSince(n.ts, now) < 7; }).length
    };
  }

  return {
    DAY: DAY, KINDS: KINDS, KIND_ORDER: KIND_ORDER,
    blankDb: blankDb, sanitiseDb: sanitiseDb, isLegacyPrototype: isLegacyPrototype,
    parse: parse, makeNote: makeNote, unique: unique,
    daysSince: daysSince, ago: ago,
    filterNotes: filterNotes, kindCounts: kindCounts, scopeLabel: scopeLabel,
    topics: topics, accountsIndex: accountsIndex, resurface: resurface,
    buildPack: buildPack, fromAccountBrain: fromAccountBrain, dojoCardEnvelope: dojoCardEnvelope,
    stats: stats
  };
}));
