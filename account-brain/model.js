/* Account Brain — the model.
 *
 * All the logic worth testing lives here: what counts as needing attention,
 * how a brief is assembled, and how a context pack is written. No DOM access,
 * no storage, no clock of its own (every function that needs "now" takes it as
 * an argument), so the whole thing runs under Node and can be tested without a
 * browser.
 *
 * The capture format is the five lines: so what, they said, I learned, still
 * open, I owe. It matches the note system, because the note is the input to
 * this and this is what makes writing the note pay back.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ABModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;

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

  /* Thresholds, in one place so they are arguable rather than scattered. */
  var RULES = {
    dueSoonDays: 3,     // a promise landing within this many days is worth seeing
    coolingDays: 21,    // no contact for this long and the account is drifting
    coldDays: 35        // no contact for this long and you open by acknowledging it
  };

  /* ------------------------------------------------------------------ dates */
  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function daysSince(ts, now) {
    return Math.floor((startOfDay(now) - startOfDay(ts)) / DAY);
  }

  /* Whole days until an ISO date (YYYY-MM-DD). Negative means overdue. */
  function daysUntil(isoDate, now) {
    if (!isoDate) return null;
    var parts = String(isoDate).split('-');
    if (parts.length !== 3) return null;
    var target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(target.getTime())) return null;
    return Math.round((target.getTime() - startOfDay(now)) / DAY);
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

  /* ------------------------------------------------------------- selectors */
  function blankDb() {
    return { accounts: [], people: [], threads: [], entries: [], settings: { lockMins: 15 } };
  }

  function account(db, id) {
    for (var i = 0; i < db.accounts.length; i++) if (db.accounts[i].id === id) return db.accounts[i];
    return null;
  }
  function liveAccounts(db) {
    return db.accounts.filter(function (a) { return !a.archived; });
  }
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

  /* Last contact drives warmth, ordering and the first line of every brief.
     Falls back to when the account was created, so a brand new account is not
     instantly "cold". */
  function lastTouch(db, id) {
    var es = entriesOf(db, id);
    if (es.length) return es[0].ts;
    var a = account(db, id);
    return a ? a.created : Date.now();
  }

  function hasNextStep(db, id) {
    return db.threads.some(function (t) {
      return t.accountId === id && !t.done && t.kind === 'action';
    });
  }

  /* ------------------------------------------------------------- attention */
  /* One list, across every account, of things that will cost something if
     ignored. Four rules only. Each is computed from data you entered, so it can
     always be explained: no scoring, no hidden weighting. */
  function attention(db, now) {
    var out = [];

    liveAccounts(db).forEach(function (a) {
      var open = threadsOf(db, a.id, false);

      open.filter(function (t) { return t.kind === 'promise'; }).forEach(function (t) {
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
  /* Ordered by what will hurt most if you walk in without it: what you
     promised, then what is still against you, then who is in the room. */
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

    var quotes = es.filter(function (e) { return e.theySaid; }).slice(0, 3);

    return {
      account: a,
      lastTouch: touch,
      days: days,
      ago: ago(touch, now),
      warmth: warmth(days),
      promises: promises,
      objections: byKind('objection'),
      risks: byKind('risk'),
      questions: byKind('question'),
      actions: byKind('action'),
      people: peopleOf(db, id),
      quotes: quotes,
      recent: es.slice(0, 3),
      empty: !open.length && !es.length && !peopleOf(db, id).length,
      gapNote: days >= RULES.coldDays
        ? 'It has been ' + days + ' days. Open by acknowledging the gap rather than picking up mid sentence.'
        : null
    };
  }

  function briefText(b) {
    if (!b) return '';
    var L = [b.account.name + ': pre-call brief',
             b.account.stage + '. Last contact ' + b.ago + '.', ''];
    var push = function (title, arr, fmt) {
      if (!arr.length) return;
      L.push(title);
      arr.forEach(function (x) { L.push('- ' + fmt(x)); });
      L.push('');
    };
    push('You promised:', b.promises, function (t) {
      return t.text + (t.dueLabel ? ' (' + t.dueLabel + ')' : '');
    });
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
    push('Where you left it:', b.recent, function (e) { return entrySummary(e); });
    if (b.gapNote) L.push('Note: ' + b.gapNote);
    return L.join('\n').trim();
  }

  /* The three lines that belong in the CRM. Deliberately not all five: the
     verbatim quote and the learning stay yours. */
  function crmText(b) {
    if (!b) return '';
    var es = b.recent;
    var soWhat = es.length && es[0].soWhat ? es[0].soWhat : '';
    var L = [];
    if (soWhat) L.push('Summary: ' + soWhat);
    if (b.promises.length) {
      L.push('Next step: ' + b.promises[0].text +
        (b.promises[0].due ? ' (by ' + b.promises[0].due + ')' : ''));
    } else if (b.actions.length) {
      L.push('Next step: ' + b.actions[0].text);
    }
    var risks = b.objections.concat(b.risks);
    if (risks.length) L.push('Open items: ' + risks.map(function (t) { return t.text; }).join(' | '));
    return L.join('\n');
  }

  function entrySummary(e) {
    if (e.soWhat) return e.soWhat;
    if (e.text) return String(e.text).replace(/\s+/g, ' ').trim();
    return [e.theySaid && '"' + e.theySaid + '"', e.learned, e.open, e.owe]
      .filter(Boolean).join(' / ');
  }

  /* ---------------------------------------------------------------- craft */
  /* Everything you have learned, lifted out of its account. This is the layer
     that generalises: an account log is about one customer, this is about the
     job. Sensitive because it names accounts, so it carries the same warning. */
  function craftItems(db) {
    var byId = {};
    db.accounts.forEach(function (a) { byId[a.id] = a; });
    return db.entries.filter(function (e) { return e.learned; })
      .sort(function (a, b) { return b.ts - a.ts; })
      .map(function (e) {
        return {
          id: e.id, ts: e.ts, learned: e.learned,
          accountId: e.accountId,
          accountName: (byId[e.accountId] || {}).name || 'Unknown',
          theySaid: e.theySaid || '',
          meeting: e.meeting || ''
        };
      });
  }

  /* Turn selected learnings into cards The Dojo can import directly. Emits a
     Dojo-shaped plain envelope, so it drops into The Dojo's own Import. */
  function dojoCardEnvelope(items) {
    return {
      app: 'dojo',
      v: 1,
      enc: false,
      data: {
        custom: items.map(function (it, i) {
          return {
            id: 'ab' + it.id + i,
            cat: 'objection',
            prompt: it.theySaid ? '"' + it.theySaid + '"' : it.learned,
            setting: 'From ' + it.accountName + (it.meeting ? ', ' + it.meeting : '') + '.',
            shape: [it.learned],
            watch: 'Whatever you got wrong the first time you heard this.'
          };
        })
      }
    };
  }

  /* ---------------------------------------------------------- context pack */
  var PREAMBLE = [
    'These are my own first-hand notes. Treat them as the ground truth for what',
    'has been said, promised and objected to. Where they conflict with general',
    'knowledge, prefer these. Do not invent product claims, statistics,',
    'competitor gaps or people that do not appear below.'
  ];

  function accountPack(db, id, now) {
    var a = account(db, id);
    if (!a) return '';
    var open = threadsOf(db, id, false);
    var done = threadsOf(db, id, true);
    var ps = peopleOf(db, id);
    var es = entriesOf(db, id);

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
        L.push('- [' + (KINDS[t.kind] || {}).label + '] ' + t.text +
          (t.due ? ' _(' + dueLabel(t.due, now) + ')_' : ''));
      });
      L.push('');
    }
    if (done.length) {
      L.push('## Closed', '');
      done.forEach(function (t) { L.push('- [' + (KINDS[t.kind] || {}).label + '] ' + t.text); });
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
    var accts = liveAccounts(db);
    var L = ['# Portfolio context', '',
             accts.length + ' active account' + (accts.length === 1 ? '' : 's') +
             '. Exported ' + new Date(now).toISOString().slice(0, 10) + '.', ''];
    L = L.concat(PREAMBLE, ['']);
    accts.sort(function (x, y) { return lastTouch(db, y.id) - lastTouch(db, x.id); })
      .forEach(function (a) {
        var open = threadsOf(db, a.id, false);
        var es = entriesOf(db, a.id);
        L.push('## ' + a.name);
        L.push('Stage: ' + a.stage + '. Last contact ' + ago(lastTouch(db, a.id), now) + '.');
        if (open.length) {
          open.forEach(function (t) {
            L.push('- [' + (KINDS[t.kind] || {}).label + '] ' + t.text +
              (t.due ? ' (' + dueLabel(t.due, now) + ')' : ''));
          });
        }
        if (es.length && es[0].soWhat) L.push('- Last: ' + es[0].soWhat);
        L.push('');
      });
    if (!accts.length) L.push('_No active accounts._');
    return L.join('\n').trim() + '\n';
  }

  /* ---------------------------------------------------------------- search */
  function searchAll(db, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var byId = {};
    db.accounts.forEach(function (a) { byId[a.id] = a.name; });
    var hits = [];
    var add = function (type, accountId, text, extra) {
      if (String(text || '').toLowerCase().indexOf(q) === -1) return;
      hits.push({ type: type, accountId: accountId, accountName: byId[accountId] || '', text: text, extra: extra || '' });
    };
    db.accounts.forEach(function (a) { add('account', a.id, a.name, a.stage); add('account', a.id, a.note, a.stage); });
    db.people.forEach(function (p) {
      add('person', p.accountId, p.name, p.role);
      add('person', p.accountId, p.cares, p.name);
    });
    db.threads.forEach(function (t) { add('thread', t.accountId, t.text, (KINDS[t.kind] || {}).label); });
    db.entries.forEach(function (e) {
      ['soWhat', 'theySaid', 'learned', 'open', 'owe', 'text'].forEach(function (f) {
        add('entry', e.accountId, e[f], e.meeting || '');
      });
    });
    /* One hit per distinct text, so a word in both a thread and an entry does
       not produce a wall of near-duplicates. */
    var seen = {};
    return hits.filter(function (h) {
      var k = h.type + '|' + h.accountId + '|' + h.text;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /* -------------------------------------------------------------- validate */
  /* Imported files are merged by id, so anything malformed is dropped rather
     than allowed to corrupt the store. */
  function sanitiseDb(raw) {
    var db = blankDb();
    if (!raw || typeof raw !== 'object') return db;
    var str = function (v) { return typeof v === 'string' ? v : ''; };
    var num = function (v, d) { return typeof v === 'number' && isFinite(v) ? v : d; };

    (Array.isArray(raw.accounts) ? raw.accounts : []).forEach(function (a) {
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

    (Array.isArray(raw.people) ? raw.people : []).forEach(function (p) {
      if (!p || !p.id || !known[p.accountId] || !str(p.name)) return;
      db.people.push({
        id: p.id, accountId: p.accountId, name: str(p.name), role: str(p.role),
        cares: str(p.cares), stance: STANCES[p.stance] ? p.stance : 'neutral'
      });
    });
    (Array.isArray(raw.threads) ? raw.threads : []).forEach(function (t) {
      if (!t || !t.id || !known[t.accountId] || !str(t.text)) return;
      db.threads.push({
        id: t.id, accountId: t.accountId,
        kind: KINDS[t.kind] ? t.kind : 'action',
        text: str(t.text), due: str(t.due) || null,
        created: num(t.created, Date.now()), done: !!t.done, doneAt: num(t.doneAt, null)
      });
    });
    (Array.isArray(raw.entries) ? raw.entries : []).forEach(function (e) {
      if (!e || !e.id || !known[e.accountId]) return;
      var entry = {
        id: e.id, accountId: e.accountId, ts: num(e.ts, Date.now()),
        meeting: str(e.meeting), soWhat: str(e.soWhat), theySaid: str(e.theySaid),
        learned: str(e.learned), open: str(e.open), owe: str(e.owe), text: str(e.text)
      };
      if (entry.soWhat || entry.theySaid || entry.learned || entry.open || entry.owe || entry.text) {
        db.entries.push(entry);
      }
    });
    if (raw.settings && typeof raw.settings === 'object') {
      db.settings.lockMins = num(raw.settings.lockMins, 15);
    }
    return db;
  }

  return {
    DAY: DAY, STAGES: STAGES, STANCES: STANCES, KINDS: KINDS, RULES: RULES,
    blankDb: blankDb, sanitiseDb: sanitiseDb,
    daysSince: daysSince, daysUntil: daysUntil, ago: ago, dueLabel: dueLabel, warmth: warmth,
    account: account, liveAccounts: liveAccounts, peopleOf: peopleOf,
    threadsOf: threadsOf, entriesOf: entriesOf, lastTouch: lastTouch, hasNextStep: hasNextStep,
    attention: attention, attentionCounts: attentionCounts,
    buildBrief: buildBrief, briefText: briefText, crmText: crmText, entrySummary: entrySummary,
    craftItems: craftItems, dojoCardEnvelope: dojoCardEnvelope,
    accountPack: accountPack, portfolioPack: portfolioPack,
    searchAll: searchAll
  };
}));
