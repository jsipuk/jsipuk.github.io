/* Ground — the model.
 *
 * One store behind three faces. No DOM, no storage, no clock of its own: every
 * function that needs "now" takes it as an argument, so all of this runs and is
 * tested under Node.
 *
 *   Accounts   account shaped   what hangs off one customer
 *   Notes      topic shaped     what belongs to no account at all
 *   Practice   skill shaped     what hangs off one question
 *
 * Two decisions worth knowing before reading further, because most of the
 * design follows from them:
 *
 * 1. LEARNINGS ARE DERIVED, NOT COPIED. An "I learned" line written against an
 *    account is not duplicated into notes. `allNotes` unions the real notes
 *    with synthetic ones projected from entries, so there is exactly one copy
 *    of the text and nothing can drift out of sync. Edit it where it was
 *    written; it changes everywhere.
 *
 * 2. A NOTE IS NOT A THREAD. A note records something observed and is true
 *    forever. A thread is something open that must be closed, and drives the
 *    overdue logic. Notes therefore surface on an account read-only, and
 *    promoting one into a tracked thread is a deliberate act. Auto-converting
 *    would leave two sources of truth for "is this still open" and slowly fill
 *    the brief with stale items nobody ever closed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GroundModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;

  /* ------------------------------------------------------------ vocabulary */
  var STAGES = ['Early conversations', 'Discovery', 'Evaluation', 'Business case',
                'Procurement', 'Customer', 'Dormant'];

  var STANCES = {
    champion:   { label: 'Champion',   colour: '#4ade80', rank: 0 },
    supportive: { label: 'Supportive', colour: '#38bdf8', rank: 1 },
    neutral:    { label: 'Neutral',    colour: '#8892a4', rank: 2 },
    sceptical:  { label: 'Sceptical',  colour: '#fbbf24', rank: 3 },
    blocker:    { label: 'Blocker',    colour: '#fb7185', rank: 4 }
  };

  var KINDS = {
    promise:   { label: 'I promised', colour: '#fb7185', brief: 'You promised', order: 0 },
    objection: { label: 'Objection',  colour: '#fbbf24', brief: 'Still open against you', order: 1 },
    risk:      { label: 'Risk',       colour: '#f472b6', brief: 'Risks', order: 2 },
    question:  { label: 'To ask',     colour: '#a89dff', brief: 'Ask this time', order: 3 },
    action:    { label: 'Next step',  colour: '#38bdf8', brief: 'Next steps', order: 4 }
  };

  var NOTE_KINDS = {
    objection:  { label: 'Objection',   colour: '#fb7185', hint: 'What they pushed back on' },
    answer:     { label: 'Answer',      colour: '#4ade80', hint: 'A response that landed' },
    question:   { label: 'Question',    colour: '#a89dff', hint: 'A question that opened something up' },
    proof:      { label: 'Proof point', colour: '#38bdf8', hint: 'A real outcome you can reference again' },
    gotcha:     { label: 'Gotcha',      colour: '#fbbf24', hint: 'A limitation or trap you hit' },
    competitor: { label: 'Competitor',  colour: '#f472b6', hint: 'Something you heard first hand' },
    lesson:     { label: 'Lesson',      colour: '#94a3b8', hint: 'Something you learned about the job' }
  };
  var NOTE_ORDER = ['objection', 'answer', 'question', 'proof', 'gotcha', 'competitor', 'lesson'];

  var RULES = { dueSoonDays: 3, coolingDays: 21, coldDays: 35 };

  function blankDb() {
    return {
      v: 1,
      accounts: [], people: [], threads: [], entries: [],
      notes: [], seen: {},
      reps: [], sched: {}, bank: [], cards: [],
      settings: { lockMins: 15, lastNoteKind: 'objection', timerLen: 0, lastRepDay: null, streak: 0 }
    };
  }

  /* ------------------------------------------------------------------ time */
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function daysSince(ts, now) { return Math.floor((startOfDay(now) - startOfDay(ts)) / DAY); }

  function daysUntil(isoDate, now) {
    if (!isoDate) return null;
    var p = String(isoDate).split('-');
    if (p.length !== 3) return null;
    var t = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(t.getTime())) return null;
    return Math.round((t.getTime() - startOfDay(now)) / DAY);
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

  function dueLabel(isoDate, now) {
    var n = daysUntil(isoDate, now);
    if (n === null) return '';
    if (n < -1) return Math.abs(n) + ' days overdue';
    if (n === -1) return '1 day overdue';
    if (n === 0) return 'due today';
    if (n === 1) return 'due tomorrow';
    return 'due in ' + n + ' days';
  }

  function warmth(days) {
    if (days >= RULES.coldDays) return { level: 'cold', label: 'cold', colour: '#fb7185' };
    if (days >= RULES.coolingDays) return { level: 'cooling', label: 'cooling', colour: '#fbbf24' };
    return { level: 'warm', label: 'warm', colour: '#4ade80' };
  }

  function lower(s) { return String(s).toLowerCase(); }

  /* ------------------------------------------------------- account selectors */
  function account(db, id) {
    for (var i = 0; i < db.accounts.length; i++) if (db.accounts[i].id === id) return db.accounts[i];
    return null;
  }
  function accountByName(db, name) {
    var n = lower(name);
    for (var i = 0; i < db.accounts.length; i++) if (lower(db.accounts[i].name) === n) return db.accounts[i];
    return null;
  }
  function liveAccounts(db) { return db.accounts.filter(function (a) { return !a.archived; }); }

  function peopleOf(db, id) {
    return db.people.filter(function (p) { return p.accountId === id; })
      .sort(function (a, b) {
        return (STANCES[a.stance] || STANCES.neutral).rank - (STANCES[b.stance] || STANCES.neutral).rank;
      });
  }

  function threadsOf(db, id, done) {
    return db.threads.filter(function (t) { return t.accountId === id && !!t.done === !!done; })
      .sort(function (a, b) {
        /* Explicit undefined check, not `|| 9`: promise has order 0, which is
           falsy, and would otherwise sort to the bottom instead of the top. */
        var ao = KINDS[a.kind] ? KINDS[a.kind].order : 9;
        var bo = KINDS[b.kind] ? KINDS[b.kind].order : 9;
        return ao - bo || a.created - b.created;
      });
  }

  function entriesOf(db, id) {
    return db.entries.filter(function (e) { return e.accountId === id; })
      .sort(function (a, b) { return b.ts - a.ts; });
  }

  function lastTouch(db, id) {
    var es = entriesOf(db, id);
    if (es.length) return es[0].ts;
    var a = account(db, id);
    return a ? a.created : Date.now();
  }

  function hasNextStep(db, id) {
    return db.threads.some(function (t) { return t.accountId === id && !t.done && t.kind === 'action'; });
  }

  /* --------------------------------------------------------------- notes */
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
      var k = lower(x);
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }

  function makeNote(kind, text, ts, source) {
    var p = parse(text);
    return {
      id: null, kind: NOTE_KINDS[kind] ? kind : 'lesson', text: String(text).trim(),
      tags: p.tags, accounts: p.accounts, ts: ts, source: source || 'typed'
    };
  }

  /* Learnings written against an account appear as notes without being copied.
     Synthetic ids are prefixed so they can never collide with a real note and
     so the UI can tell they must be edited at source. */
  function derivedNotes(db) {
    var names = {};
    db.accounts.forEach(function (a) { names[a.id] = a.name; });
    return db.entries.filter(function (e) { return e.learned; }).map(function (e) {
      return {
        id: 'e:' + e.id, kind: 'lesson', text: e.learned,
        tags: [], accounts: names[e.accountId] ? [names[e.accountId]] : [],
        ts: e.ts, source: 'log', derived: true, entryId: e.id, accountId: e.accountId
      };
    });
  }

  function allNotes(db) {
    return db.notes.concat(derivedNotes(db)).sort(function (a, b) { return b.ts - a.ts; });
  }

  function seenCount(db, id) { return (db.seen && db.seen[id]) || 0; }

  function filterNotes(db, f) {
    f = f || {};
    var q = String(f.query || '').trim().toLowerCase();
    return allNotes(db).filter(function (n) {
      if (f.kind && f.kind !== 'all' && n.kind !== f.kind) return false;
      if (f.tag && n.tags.map(lower).indexOf(lower(f.tag)) === -1) return false;
      if (f.account && n.accounts.map(lower).indexOf(lower(f.account)) === -1) return false;
      if (!q) return true;
      return (n.text + ' ' + n.tags.join(' ') + ' ' + n.accounts.join(' ')).toLowerCase().indexOf(q) !== -1;
    });
  }

  function noteKindCounts(db) {
    var list = allNotes(db);
    var c = { all: list.length };
    list.forEach(function (n) { c[n.kind] = (c[n.kind] || 0) + 1; });
    return c;
  }

  function topics(db) {
    var map = {};
    allNotes(db).forEach(function (n) {
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
      map[k].accountCount = Object.keys(map[k].accounts).length;
      return map[k];
    }).sort(function (a, b) { return b.count - a.count || b.last - a.last; });
  }

  function resurface(db, n, now) {
    var pool = allNotes(db).filter(function (x) { return daysSince(x.ts, now) >= 1; });
    return pool.sort(function (a, b) {
      return seenCount(db, a.id) - seenCount(db, b.id) || a.ts - b.ts;
    }).slice(0, n || 3);
  }

  /* ---------------------------------------------------------- cross-links */
  /* Notes that mention an account, for the account page and its brief.
     Read-only by design: see decision 2 at the top of this file. */
  function notesForAccount(db, id) {
    var a = account(db, id);
    if (!a) return [];
    var n = lower(a.name);
    return allNotes(db).filter(function (x) {
      if (x.derived && x.accountId === id) return false;    // already shown as a log entry
      return x.accounts.map(lower).indexOf(n) !== -1;
    });
  }

  function isTracked(db, noteId) {
    return db.threads.some(function (t) { return t.fromNoteId === noteId; });
  }

  /* Promote a note into a tracked thread. Deliberate, one at a time. */
  function threadFromNote(note, accountId, kind, id, now) {
    return {
      id: id, accountId: accountId,
      kind: KINDS[kind] ? kind : 'objection',
      text: note.text, due: null, created: now, done: false,
      fromNoteId: note.id
    };
  }

  /* ---------------------------------------------------------- practice */
  function deck(db, BASE) { return BASE.concat(db.cards || []); }

  function cardById(db, BASE, id) {
    var all = deck(db, BASE);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function dueCards(db, BASE, now) {
    return deck(db, BASE).filter(function (c) {
      var s = db.sched[c.id];
      return !s || !s.due || s.due <= now;
    });
  }

  /* SM-2, simplified. Fumbled resets to tomorrow, the rest grow. Capped at 120
     days so nothing silently disappears for good. */
  function schedule(db, cardId, verdict, now) {
    var s = db.sched[cardId] || { interval: 0, reps: 0, lapses: 0 };
    s.reps++;
    if (verdict === 'fumbled') { s.interval = 1; s.lapses++; }
    else if (verdict === 'ok') { s.interval = Math.max(3, Math.round((s.interval || 2) * 1.7)); }
    else { s.interval = Math.max(6, Math.round((s.interval || 3) * 2.4)); }
    s.interval = Math.min(s.interval, 120);
    s.due = now + s.interval * DAY;
    s.last = verdict;
    db.sched[cardId] = s;
    return s;
  }

  var CARD_CATS = {
    discovery: 1, objection: 1, exec: 1, technical: 1, competitive: 1, pov: 1, process: 1
  };

  /* Turn something you actually met into something you rehearse. One click, no
     files: the whole point of merging the three apps. */
  function cardFromSource(text, setting, cat, id, ref) {
    return {
      id: id,
      cat: CARD_CATS[cat] ? cat : 'objection',
      prompt: String(text).trim(),
      setting: setting || '',
      shape: ['Answer it the way you wish you had the first time.'],
      watch: 'Whatever you got wrong when this actually came up.',
      fromRef: ref || null
    };
  }

  function isPractised(db, ref) {
    return (db.cards || []).some(function (c) { return c.fromRef === ref; });
  }

  /* ------------------------------------------------------------- attention */
  function attention(db, now) {
    var out = [];
    liveAccounts(db).forEach(function (a) {
      threadsOf(db, a.id, false).filter(function (t) { return t.kind === 'promise'; })
        .forEach(function (t) {
          var n = daysUntil(t.due, now);
          if (n === null) return;
          if (n < 0) {
            out.push({ kind: 'overdue', severity: 0, accountId: a.id, accountName: a.name,
                       text: t.text, meta: dueLabel(t.due, now), sort: n });
          } else if (n <= RULES.dueSoonDays) {
            out.push({ kind: 'due', severity: 1, accountId: a.id, accountName: a.name,
                       text: t.text, meta: dueLabel(t.due, now), sort: n });
          }
        });

      var days = daysSince(lastTouch(db, a.id), now);
      var w = warmth(days);
      if (w.level === 'cold') {
        out.push({ kind: 'cold', severity: 1, accountId: a.id, accountName: a.name,
                   text: 'No contact for ' + days + ' days.', meta: 'cold', sort: -days });
      } else if (w.level === 'cooling') {
        out.push({ kind: 'cooling', severity: 2, accountId: a.id, accountName: a.name,
                   text: 'No contact for ' + days + ' days.', meta: 'cooling', sort: -days });
      }

      if (!hasNextStep(db, a.id) && a.stage !== 'Dormant' && a.stage !== 'Customer') {
        out.push({ kind: 'nonext', severity: 2, accountId: a.id, accountName: a.name,
                   text: 'No agreed next step.', meta: a.stage, sort: 0 });
      }
    });
    return out.sort(function (x, y) {
      return x.severity - y.severity || x.sort - y.sort || x.accountName.localeCompare(y.accountName);
    });
  }

  function attentionCounts(items) {
    var c = { overdue: 0, due: 0, cold: 0, cooling: 0, nonext: 0 };
    items.forEach(function (i) { c[i.kind] = (c[i.kind] || 0) + 1; });
    return c;
  }

  /* ----------------------------------------------------------------- brief */
  function buildBrief(db, id, now) {
    var a = account(db, id);
    if (!a) return null;
    var touch = lastTouch(db, id);
    var days = daysSince(touch, now);
    var open = threadsOf(db, id, false);
    var es = entriesOf(db, id);
    var byKind = function (k) { return open.filter(function (t) { return t.kind === k; }); };

    var promises = byKind('promise').map(function (t) {
      return Object.assign({}, t, { dueLabel: dueLabel(t.due, now), overdue: daysUntil(t.due, now) < 0 });
    }).sort(function (x, y) {
      var xd = daysUntil(x.due, now), yd = daysUntil(y.due, now);
      if (xd === null) return 1;
      if (yd === null) return -1;
      return xd - yd;
    });

    return {
      account: a, lastTouch: touch, days: days, ago: ago(touch, now), warmth: warmth(days),
      promises: promises,
      objections: byKind('objection'), risks: byKind('risk'),
      questions: byKind('question'), actions: byKind('action'),
      people: peopleOf(db, id),
      quotes: es.filter(function (e) { return e.theySaid; }).slice(0, 3),
      recent: es.slice(0, 3),
      /* Notes already promoted to threads are dropped: they appear above as the
         thread, and the brief must not say the same thing twice. Capped at
         three, because it has to stay short enough to read standing up. */
      alsoKnown: notesForAccount(db, id)
        .filter(function (n) { return !isTracked(db, n.id); })
        .slice(0, 3),
      empty: !open.length && !es.length && !peopleOf(db, id).length,
      gapNote: days >= RULES.coldDays
        ? 'It has been ' + days + ' days. Open by acknowledging the gap rather than picking up mid sentence.'
        : null
    };
  }

  function entrySummary(e) {
    if (e.soWhat) return e.soWhat;
    if (e.text) return String(e.text).replace(/\s+/g, ' ').trim();
    return [e.theySaid && '"' + e.theySaid + '"', e.learned, e.open, e.owe].filter(Boolean).join(' / ');
  }

  function briefText(b) {
    if (!b) return '';
    var L = [b.account.name + ': pre-call brief', b.account.stage + '. Last contact ' + b.ago + '.', ''];
    var push = function (title, arr, fmt) {
      if (!arr.length) return;
      L.push(title);
      arr.forEach(function (x) { L.push('- ' + fmt(x)); });
      L.push('');
    };
    push('You promised:', b.promises, function (t) { return t.text + (t.dueLabel ? ' (' + t.dueLabel + ')' : ''); });
    push('People:', b.people, function (p) {
      return p.name + (p.role ? ', ' + p.role : '') + ': ' +
        (STANCES[p.stance] || STANCES.neutral).label.toLowerCase() +
        (p.cares ? '. Cares about: ' + p.cares : '');
    });
    push('Still open against you:', b.objections, function (t) { return t.text; });
    push('Risks:', b.risks, function (t) { return t.text; });
    push('Ask this time:', b.questions, function (t) { return t.text; });
    push('Next steps:', b.actions, function (t) { return t.text; });
    push('Their words:', b.quotes, function (e) { return '"' + e.theySaid + '"'; });
    push('Also known:', b.alsoKnown, function (n) { return n.text; });
    push('Where you left it:', b.recent, function (e) { return entrySummary(e); });
    if (b.gapNote) L.push('Note: ' + b.gapNote);
    return L.join('\n').trim();
  }

  /* The three lines that belong in the CRM. Deliberately not all five: the
     verbatim quote and the learning stay yours. */
  function crmText(b) {
    if (!b) return '';
    var soWhat = b.recent.length && b.recent[0].soWhat ? b.recent[0].soWhat : '';
    var L = [];
    if (soWhat) L.push('Summary: ' + soWhat);
    if (b.promises.length) {
      L.push('Next step: ' + b.promises[0].text + (b.promises[0].due ? ' (by ' + b.promises[0].due + ')' : ''));
    } else if (b.actions.length) {
      L.push('Next step: ' + b.actions[0].text);
    }
    var risks = b.objections.concat(b.risks);
    if (risks.length) L.push('Open items: ' + risks.map(function (t) { return t.text; }).join(' | '));
    return L.join('\n');
  }

  /* ---------------------------------------------------------- context packs */
  var PREAMBLE = [
    'These are my own first-hand notes. Treat them as the ground truth for what',
    'has been said, promised and objected to. Where they conflict with general',
    'knowledge, prefer these. Do not invent product claims, statistics,',
    'competitor gaps or people that do not appear below.'
  ];

  function accountPack(db, id, now) {
    var a = account(db, id);
    if (!a) return '';
    var open = threadsOf(db, id, false), done = threadsOf(db, id, true);
    var ps = peopleOf(db, id), es = entriesOf(db, id), ns = notesForAccount(db, id);

    var L = ['# ' + a.name + ': account context', ''];
    L.push('Stage: ' + a.stage + '. Last contact: ' + ago(lastTouch(db, id), now) +
           '. Exported ' + new Date(now).toISOString().slice(0, 10) + '.');
    if (a.sector) L.push('Sector: ' + a.sector + '.');
    if (a.note) L.push('', a.note);
    L.push('');
    L = L.concat(PREAMBLE, ['']);

    if (ps.length) {
      L.push('## People', '');
      ps.forEach(function (p) {
        L.push('- **' + p.name + '**' + (p.role ? ' (' + p.role + ')' : '') + ': ' +
          (STANCES[p.stance] || STANCES.neutral).label.toLowerCase() + '.' +
          (p.cares ? ' Cares about: ' + p.cares : ''));
      });
      L.push('');
    }
    if (open.length) {
      L.push('## Open', '');
      open.forEach(function (t) {
        L.push('- [' + KINDS[t.kind].label + '] ' + t.text + (t.due ? ' _(' + dueLabel(t.due, now) + ')_' : ''));
      });
      L.push('');
    }
    if (done.length) {
      L.push('## Closed', '');
      done.forEach(function (t) { L.push('- [' + KINDS[t.kind].label + '] ' + t.text); });
      L.push('');
    }
    if (ns.length) {
      L.push('## Also known, from my wider notes', '');
      ns.forEach(function (n) { L.push('- [' + NOTE_KINDS[n.kind].label + '] ' + n.text); });
      L.push('');
    }
    if (es.length) {
      L.push('## History, most recent first', '');
      es.forEach(function (e) {
        L.push('### ' + ago(e.ts, now) + (e.meeting ? ' — ' + e.meeting : ''));
        if (e.soWhat) L.push('- So what: ' + e.soWhat);
        if (e.theySaid) L.push('- They said: "' + e.theySaid + '"');
        if (e.learned) L.push('- I learned: ' + e.learned);
        if (e.open) L.push('- Still open: ' + e.open);
        if (e.owe) L.push('- I owe: ' + e.owe);
        if (e.text) L.push('- ' + String(e.text).replace(/\s+/g, ' ').trim());
        L.push('');
      });
    }
    return L.join('\n').trim() + '\n';
  }

  function portfolioPack(db, now) {
    var accts = liveAccounts(db).slice()
      .sort(function (x, y) { return lastTouch(db, y.id) - lastTouch(db, x.id); });
    var L = ['# Portfolio context', '',
             accts.length + ' active account' + (accts.length === 1 ? '' : 's') +
             '. Exported ' + new Date(now).toISOString().slice(0, 10) + '.', ''];
    L = L.concat(PREAMBLE, ['']);
    accts.forEach(function (a) {
      var open = threadsOf(db, a.id, false), es = entriesOf(db, a.id);
      L.push('## ' + a.name);
      L.push('Stage: ' + a.stage + '. Last contact ' + ago(lastTouch(db, a.id), now) + '.');
      open.forEach(function (t) {
        L.push('- [' + KINDS[t.kind].label + '] ' + t.text + (t.due ? ' (' + dueLabel(t.due, now) + ')' : ''));
      });
      if (es.length && es[0].soWhat) L.push('- Last: ' + es[0].soWhat);
      L.push('');
    });
    if (!accts.length) L.push('_No active accounts._');
    return L.join('\n').trim() + '\n';
  }

  function scopeLabel(f) {
    f = f || {};
    var bits = [f.kind && f.kind !== 'all' ? NOTE_KINDS[f.kind].label.toLowerCase() + ' notes' : 'all notes'];
    if (f.tag) bits.push('tagged #' + f.tag);
    if (f.account) bits.push('for @' + f.account);
    if (f.query) bits.push('matching "' + f.query + '"');
    return bits.join(', ');
  }

  function notesPack(db, f, now) {
    var rows = filterNotes(db, f);
    var L = ['# Field notes context pack', ''];
    L.push('Scope: ' + scopeLabel(f) + '. ' + rows.length + ' note' + (rows.length === 1 ? '' : 's') +
           ', exported ' + new Date(now).toISOString().slice(0, 10) + '.', '');
    L = L.concat(PREAMBLE, ['']);
    NOTE_ORDER.forEach(function (k) {
      var group = rows.filter(function (n) { return n.kind === k; });
      if (!group.length) return;
      L.push('## ' + NOTE_KINDS[k].label, '');
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

  function answerPack(db, now) {
    var L = ['# My answer bank', ''];
    L.push(db.bank.length + ' answer' + (db.bank.length === 1 ? '' : 's') +
           ' I have practised and would use again. Exported ' + new Date(now).toISOString().slice(0, 10) + '.', '');
    L.push('These are my own positions, in my own words, tested in practice. When drafting',
           'anything customer facing, match this voice and reuse these arguments. Do not',
           'invent product claims, statistics or competitor gaps that do not appear here.', '');
    db.bank.forEach(function (b) { L.push('**' + b.prompt + '**', '', b.text.trim(), ''); });
    if (!db.bank.length) L.push('_Nothing kept yet._');
    return L.join('\n').trim() + '\n';
  }

  /* ---------------------------------------------------------------- search */
  function searchAll(db, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var names = {};
    db.accounts.forEach(function (a) { names[a.id] = a.name; });
    var hits = [], seen = {};
    var add = function (type, accountId, text, extra) {
      if (String(text || '').toLowerCase().indexOf(q) === -1) return;
      var k = type + '|' + accountId + '|' + text;
      if (seen[k]) return;
      seen[k] = true;
      hits.push({ type: type, accountId: accountId || null, accountName: names[accountId] || '', text: text, extra: extra || '' });
    };
    db.accounts.forEach(function (a) { add('account', a.id, a.name, a.stage); add('account', a.id, a.note, a.stage); });
    db.people.forEach(function (p) { add('person', p.accountId, p.name, p.role); add('person', p.accountId, p.cares, p.name); });
    db.threads.forEach(function (t) { add('thread', t.accountId, t.text, KINDS[t.kind] ? KINDS[t.kind].label : ''); });
    db.entries.forEach(function (e) {
      ['soWhat', 'theySaid', 'learned', 'open', 'owe', 'text'].forEach(function (f) {
        add('entry', e.accountId, e[f], e.meeting || '');
      });
    });
    db.notes.forEach(function (n) { add('note', null, n.text, NOTE_KINDS[n.kind] ? NOTE_KINDS[n.kind].label : ''); });
    db.bank.forEach(function (b) { add('answer', null, b.text, b.prompt); });
    return hits;
  }

  /* -------------------------------------------------------------- statistics */
  function stats(db, now) {
    var list = allNotes(db);
    var tags = {}, accts = {};
    list.forEach(function (n) {
      n.tags.forEach(function (t) { tags[lower(t)] = true; });
      n.accounts.forEach(function (a) { accts[lower(a)] = true; });
    });
    return {
      accounts: liveAccounts(db).length,
      notes: list.length,
      topics: Object.keys(tags).length,
      mentioned: Object.keys(accts).length,
      reps: db.reps.length,
      kept: db.bank.length,
      week: list.filter(function (n) { return daysSince(n.ts, now) < 7; }).length
    };
  }

  /* ------------------------------------------------------------- sanitising */
  function sanitiseDb(raw) {
    var db = blankDb();
    if (!raw || typeof raw !== 'object') return db;
    var str = function (v) { return typeof v === 'string' ? v : ''; };
    var num = function (v, d) { return typeof v === 'number' && isFinite(v) ? v : d; };
    var arr = function (v) { return Array.isArray(v) ? v : []; };

    arr(raw.accounts).forEach(function (a) {
      if (!a || !a.id || !str(a.name)) return;
      db.accounts.push({
        id: a.id, name: str(a.name),
        stage: STAGES.indexOf(a.stage) >= 0 ? a.stage : STAGES[0],
        sector: str(a.sector), note: str(a.note),
        created: num(a.created, Date.now()), archived: !!a.archived
      });
    });
    var known = {};
    db.accounts.forEach(function (a) { known[a.id] = true; });

    arr(raw.people).forEach(function (p) {
      if (!p || !p.id || !known[p.accountId] || !str(p.name)) return;
      db.people.push({ id: p.id, accountId: p.accountId, name: str(p.name), role: str(p.role),
                       cares: str(p.cares), stance: STANCES[p.stance] ? p.stance : 'neutral' });
    });
    arr(raw.threads).forEach(function (t) {
      if (!t || !t.id || !known[t.accountId] || !str(t.text)) return;
      db.threads.push({ id: t.id, accountId: t.accountId, kind: KINDS[t.kind] ? t.kind : 'action',
                        text: str(t.text), due: str(t.due) || null, created: num(t.created, Date.now()),
                        done: !!t.done, doneAt: num(t.doneAt, null), fromNoteId: str(t.fromNoteId) || null });
    });
    arr(raw.entries).forEach(function (e) {
      if (!e || !e.id || !known[e.accountId]) return;
      var x = { id: e.id, accountId: e.accountId, ts: num(e.ts, Date.now()), meeting: str(e.meeting),
                soWhat: str(e.soWhat), theySaid: str(e.theySaid), learned: str(e.learned),
                open: str(e.open), owe: str(e.owe), text: str(e.text) };
      if (x.soWhat || x.theySaid || x.learned || x.open || x.owe || x.text) db.entries.push(x);
    });

    var noteIds = {};
    arr(raw.notes).forEach(function (n) {
      if (!n || typeof n.text !== 'string' || !n.text.trim()) return;
      var id = n.id || ('m' + Object.keys(noteIds).length);
      /* Synthetic ids belong to derived notes and must never be stored. */
      if (noteIds[id] || String(id).indexOf('e:') === 0) return;
      noteIds[id] = true;
      db.notes.push({
        id: id, kind: NOTE_KINDS[n.kind] ? n.kind : 'lesson', text: n.text,
        tags: arr(n.tags).filter(isStr), accounts: arr(n.accounts).filter(isStr),
        ts: num(n.ts, Date.now()), source: isStr(n.source) ? n.source : 'typed'
      });
      /* The old per-note seen counter moves into the shared map. */
      if (num(n.seen, 0) > 0) db.seen[id] = n.seen;
    });
    db.notes.sort(function (a, b) { return b.ts - a.ts; });

    if (raw.seen && typeof raw.seen === 'object') {
      Object.keys(raw.seen).forEach(function (k) {
        var v = num(raw.seen[k], 0);
        if (v > 0) db.seen[k] = Math.max(db.seen[k] || 0, v);
      });
    }

    arr(raw.reps).forEach(function (r) { if (r && r.id) db.reps.push(r); });
    if (raw.sched && typeof raw.sched === 'object') {
      Object.keys(raw.sched).forEach(function (k) {
        var s = raw.sched[k];
        if (s && typeof s === 'object') db.sched[k] = s;
      });
    }
    arr(raw.bank).forEach(function (b) { if (b && str(b.text) && str(b.prompt)) db.bank.push(b); });
    arr(raw.cards).forEach(function (c) {
      if (!c || !c.id || !str(c.prompt)) return;
      db.cards.push({ id: c.id, cat: CARD_CATS[c.cat] ? c.cat : 'objection', prompt: c.prompt,
                      setting: str(c.setting), shape: arr(c.shape).filter(isStr),
                      watch: str(c.watch) || 'Whatever you usually get wrong here.',
                      fromRef: str(c.fromRef) || null });
    });

    if (raw.settings && typeof raw.settings === 'object') {
      var s = raw.settings;
      db.settings.lockMins = num(s.lockMins, 15);
      db.settings.lastNoteKind = NOTE_KINDS[s.lastNoteKind] ? s.lastNoteKind : 'objection';
      db.settings.timerLen = num(s.timerLen, 0);
      db.settings.lastRepDay = str(s.lastRepDay) || null;
      db.settings.streak = num(s.streak, 0);
    }
    return db;
  }

  function isStr(x) { return typeof x === 'string' && x.length > 0; }

  /* ------------------------------------------------------------- migration */
  /* Merge a store written by one of the three predecessor apps. Each wrote a
     different subset of the same shape, so sanitising and merging by id is
     enough; nothing needs a bespoke converter. */
  function mergeInto(db, incoming) {
    var clean = sanitiseDb(incoming);
    var added = 0;
    ['accounts', 'people', 'threads', 'entries', 'notes', 'reps', 'bank', 'cards'].forEach(function (k) {
      var have = {};
      db[k].forEach(function (x) { have[x.id] = true; });
      clean[k].forEach(function (x) { if (!have[x.id]) { db[k].push(x); added++; } });
    });
    Object.keys(clean.sched).forEach(function (k) {
      var mine = db.sched[k], theirs = clean.sched[k];
      if (!mine || (theirs.reps || 0) > (mine.reps || 0)) db.sched[k] = theirs;
    });
    Object.keys(clean.seen).forEach(function (k) {
      db.seen[k] = Math.max(db.seen[k] || 0, clean.seen[k]);
    });
    db.notes.sort(function (a, b) { return b.ts - a.ts; });
    db.settings.streak = Math.max(db.settings.streak || 0, clean.settings.streak || 0);
    return added;
  }

  return {
    DAY: DAY, STAGES: STAGES, STANCES: STANCES, KINDS: KINDS,
    NOTE_KINDS: NOTE_KINDS, NOTE_ORDER: NOTE_ORDER, RULES: RULES, CARD_CATS: CARD_CATS,
    blankDb: blankDb, sanitiseDb: sanitiseDb, mergeInto: mergeInto,
    daysSince: daysSince, daysUntil: daysUntil, ago: ago, dueLabel: dueLabel, warmth: warmth,
    account: account, accountByName: accountByName, liveAccounts: liveAccounts,
    peopleOf: peopleOf, threadsOf: threadsOf, entriesOf: entriesOf,
    lastTouch: lastTouch, hasNextStep: hasNextStep,
    parse: parse, unique: unique, makeNote: makeNote,
    derivedNotes: derivedNotes, allNotes: allNotes, seenCount: seenCount,
    filterNotes: filterNotes, noteKindCounts: noteKindCounts, topics: topics, resurface: resurface,
    notesForAccount: notesForAccount, isTracked: isTracked, threadFromNote: threadFromNote,
    deck: deck, cardById: cardById, dueCards: dueCards, schedule: schedule,
    cardFromSource: cardFromSource, isPractised: isPractised,
    attention: attention, attentionCounts: attentionCounts,
    buildBrief: buildBrief, briefText: briefText, crmText: crmText, entrySummary: entrySummary,
    accountPack: accountPack, portfolioPack: portfolioPack,
    notesPack: notesPack, answerPack: answerPack, scopeLabel: scopeLabel,
    searchAll: searchAll, stats: stats
  };
}));
