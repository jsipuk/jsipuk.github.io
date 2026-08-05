/* Dependency-free checks for Ground.
   Run with:  node ground/test/run.js
   Needs Node 18+ for global Web Crypto. */
const fs = require('fs');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'store.js'));
const Deck = require(path.join(__dirname, '..', 'deck.js'));
const M = require(path.join(__dirname, '..', 'model.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
const section = n => console.log('\n' + n);
async function throws(fn, matcher, msg) {
  try { await fn(); fail++; console.error('  ✗ ' + msg + ' (did not throw)'); }
  catch (e) {
    if (matcher && !matcher.test(e.message)) { fail++; console.error(`  ✗ ${msg} (wrong error: ${e.message})`); }
    else pass++;
  }
}

const DAY = 86400000;
const NOW = new Date('2026-08-14T10:00:00Z').getTime();
const iso = off => {
  const d = new Date(NOW + off * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function db() {
  return M.sanitiseDb({
    accounts: [
      { id: 'a1', name: 'Northbank', stage: 'Evaluation', sector: 'Banking', note: 'VPN at end of life', created: NOW - 70 * DAY },
      { id: 'a2', name: 'Selwyn Health', stage: 'Discovery', created: NOW - 60 * DAY },
      { id: 'a3', name: 'Old Dormant', stage: 'Dormant', created: NOW - 300 * DAY },
      { id: 'a4', name: 'Archived Co', stage: 'Discovery', created: NOW - 10 * DAY, archived: true }
    ],
    people: [
      { id: 'p1', accountId: 'a1', name: 'Priya Raman', role: 'Head of Infrastructure', stance: 'champion', cares: 'Getting off the VPN' },
      { id: 'p2', accountId: 'a1', name: 'Tom Aldridge', role: 'Security Architect', stance: 'blocker', cares: 'False positive rates' }
    ],
    threads: [
      { id: 't1', accountId: 'a1', kind: 'promise', text: 'Send Priya the regional data answer', due: iso(-4), created: NOW - 9 * DAY },
      { id: 't2', accountId: 'a1', kind: 'promise', text: 'Share the sizing sheet', due: iso(2), created: NOW - 2 * DAY },
      { id: 't3', accountId: 'a1', kind: 'objection', text: 'Inline inspection will break trading apps', created: NOW - 16 * DAY },
      { id: 't4', accountId: 'a1', kind: 'action', text: 'Agree the three decisive criteria', created: NOW - 5 * DAY },
      { id: 't5', accountId: 'a1', kind: 'objection', text: 'Microsoft shop objection', created: NOW - 40 * DAY, done: true },
      { id: 't6', accountId: 'a2', kind: 'risk', text: 'No exec sponsor', created: NOW - 30 * DAY }
    ],
    entries: [
      { id: 'e1', accountId: 'a1', ts: NOW - 9 * DAY, meeting: 'Technical deep dive',
        soWhat: 'Tom moved from blocking to willing to test.',
        theySaid: 'We turned the last one off after six weeks.',
        learned: 'Tom fears being blamed for a rollout, not latency.',
        open: 'No business attendee yet.', owe: 'Regional data answer to Priya.' },
      { id: 'e2', accountId: 'a1', ts: NOW - 16 * DAY, meeting: 'First session', soWhat: 'Good energy, no sponsor.' },
      { id: 'e3', accountId: 'a2', ts: NOW - 40 * DAY, meeting: 'Intro', learned: 'Health procurement runs annually.' }
    ],
    notes: [
      { id: 'n1', kind: 'gotcha', text: 'Policy import drops rules with unicode names. #dlp #tooling', ts: NOW - 3 * DAY, tags: ['dlp', 'tooling'], accounts: [] },
      { id: 'n2', kind: 'proof', text: 'Cut a VPN estate from nine to two. #vpn @Northbank', ts: NOW - 20 * DAY, tags: ['vpn'], accounts: ['Northbank'] },
      { id: 'n3', kind: 'competitor', text: 'They lead with single-pass everywhere. #competitive', ts: NOW - 5 * DAY, tags: ['competitive'], accounts: [] }
    ],
    bank: [{ id: 'b1', cardId: 'o1', cat: 'objection', prompt: 'The VPN question', text: 'My kept answer.' }],
    cards: [], reps: [], sched: {}, seen: {},
    settings: { lockMins: 15 }
  });
}

(async () => {

  section('dates and warmth');
  eq(M.ago(NOW - 30 * DAY, NOW), '1 month ago', 'singular month, not "1 months"');
  eq(M.ago(NOW - 365 * DAY, NOW), '1 year ago', 'singular year');
  eq(M.dueLabel(iso(-1), NOW), '1 day overdue', 'singular overdue day');
  eq(M.dueLabel(iso(0), NOW), 'due today', 'due today');
  eq(M.daysUntil(null, NOW), null, 'no due date is null, not zero');
  eq(M.daysUntil('nonsense', NOW), null, 'a malformed date is null');
  eq(M.warmth(20).level, 'warm', 'under three weeks is warm');
  eq(M.warmth(21).level, 'cooling', 'three weeks is cooling');
  eq(M.warmth(40).level, 'cold', 'over five weeks is cold');

  section('account selectors');
  {
    const d = db();
    eq(M.liveAccounts(d).length, 3, 'archived accounts are excluded');
    eq(M.peopleOf(d, 'a1')[0].name, 'Priya Raman', 'champion sorts first');
    eq(M.threadsOf(d, 'a1', false)[0].kind, 'promise', 'promises sort to the top, not the bottom');
    eq(M.threadsOf(d, 'a1', true).length, 1, 'closed threads separate');
    eq(M.lastTouch(d, 'a1'), NOW - 9 * DAY, 'last touch is the newest entry');
    eq(M.lastTouch(d, 'a3'), d.accounts[2].created, 'no entries falls back to created');
    eq(M.hasNextStep(d, 'a1'), true, 'a1 has a next step');
    eq(M.hasNextStep(d, 'a2'), false, 'a2 does not');
    eq(M.accountByName(d, 'northbank').id, 'a1', 'accounts resolve by name, case insensitively');
  }

  section('attention');
  {
    const items = M.attention(db(), NOW);
    const c = M.attentionCounts(items);
    eq(c.overdue, 1, 'one overdue promise');
    eq(c.due, 1, 'one due soon');
    eq(items[0].kind, 'overdue', 'overdue sorts to the very top');
    eq(items[0].meta, '4 days overdue', 'with an accurate label');
    ok(items.some(i => i.kind === 'cold' && i.accountId === 'a2'), 'a2 is cold');
    ok(!items.some(i => i.accountId === 'a4'), 'archived accounts never raise attention');
    ok(!items.some(i => i.kind === 'nonext' && i.accountId === 'a3'), 'dormant accounts are not nagged');
    eq(M.attention(M.blankDb(), NOW).length, 0, 'an empty store raises nothing');
  }

  section('learnings are derived, not copied');
  {
    const d = db();
    eq(d.notes.length, 3, 'only three real notes are stored');
    const derived = M.derivedNotes(d);
    eq(derived.length, 2, 'two learnings project into notes');
    eq(M.allNotes(d).length, 5, 'the notes view unions both');
    ok(derived.every(n => n.derived === true), 'derived notes are flagged');
    ok(derived.every(n => String(n.id).startsWith('e:')), 'and carry a synthetic id');
    eq(derived[0].kind, 'lesson', 'learnings arrive as lessons');
    ok(derived.some(n => n.accounts.indexOf('Northbank') !== -1), 'tagged with their account');

    /* The whole point: change it at source and the note view changes with it. */
    d.entries.find(e => e.id === 'e1').learned = 'Edited at source.';
    ok(M.allNotes(d).some(n => n.text === 'Edited at source.'), 'editing the entry changes the note');
    ok(!M.allNotes(d).some(n => n.text.includes('fears being blamed')), 'and no stale copy survives');

    /* Synthetic notes must never be written back into storage. */
    const round = M.sanitiseDb({ notes: M.allNotes(db()) });
    ok(round.notes.every(n => !String(n.id).startsWith('e:')), 'derived notes are refused on save');
    eq(round.notes.length, 3, 'so a save/load round trip does not duplicate learnings');
  }

  section('note filtering and topics');
  {
    const d = db();
    eq(M.filterNotes(d, {}).length, 5, 'no filter returns everything including derived');
    eq(M.filterNotes(d, { kind: 'lesson' }).length, 2, 'derived notes are filterable by kind');
    eq(M.filterNotes(d, { tag: 'dlp' }).length, 1, 'filter by tag');
    eq(M.filterNotes(d, { tag: 'DLP' }).length, 1, 'tag filter is case insensitive');
    eq(M.filterNotes(d, { account: 'northbank' }).length, 2, 'account filter spans real and derived');
    eq(M.filterNotes(d, { query: 'unicode' }).length, 1, 'free text search');
    eq(M.filterNotes(d, { kind: 'gotcha', tag: 'dlp' }).length, 1, 'filters combine');
    const rows = M.filterNotes(d, {});
    ok(rows[0].ts >= rows[rows.length - 1].ts, 'newest first');
    eq(M.noteKindCounts(d).all, 5, 'counts include derived notes');

    const t = M.topics(d);
    ok(t.length >= 4, 'topics are extracted');
    ok(t.every(x => x.tag === x.tag.toLowerCase()), 'normalised to lower case');
  }

  section('resurface');
  {
    const d = db();
    const picks = M.resurface(d, 3, NOW);
    eq(picks.length, 3, 'returns what was asked for');
    ok(picks.every(n => M.daysSince(n.ts, NOW) >= 1), 'nothing from today');
    eq(picks.map(p => p.id).join(), M.resurface(d, 3, NOW).map(p => p.id).join(), 'deterministic, not random');
    d.seen[picks[0].id] = 5;
    ok(M.resurface(d, 3, NOW)[0].id !== picks[0].id, 'a seen note drops down the queue');
    ok(M.seenCount(d, picks[0].id) === 5, 'seen counts live in one shared map');
  }

  section('notes surface on an account, read-only');
  {
    const d = db();
    const forA1 = M.notesForAccount(d, 'a1');
    ok(forA1.some(n => n.text.includes('nine to two')), 'a note tagged @Northbank appears on that account');
    ok(!forA1.some(n => n.derived && n.accountId === 'a1'), 'its own log entries are not repeated back at it');
    ok(!forA1.some(n => n.text.includes('unicode')), 'untagged notes do not appear');
    eq(M.notesForAccount(d, 'nope').length, 0, 'an unknown account yields nothing');

    /* A note must not become a thread on its own. */
    const before = d.threads.length;
    M.notesForAccount(d, 'a1');
    eq(d.threads.length, before, 'reading notes never creates threads');
    eq(M.isTracked(d, 'n2'), false, 'and nothing is tracked by default');

    const th = M.threadFromNote({ id: 'n2', text: 'Cut a VPN estate from nine to two.' }, 'a1', 'objection', 'new1', NOW);
    d.threads.push(th);
    eq(M.isTracked(d, 'n2'), true, 'promotion is explicit and then recorded');
    eq(th.fromNoteId, 'n2', 'the thread remembers where it came from');
    eq(M.threadFromNote({ id: 'x', text: 't' }, 'a1', 'nonsense', 'i', NOW).kind, 'objection', 'an unknown kind falls back');
  }

  section('brief');
  {
    const b = M.buildBrief(db(), 'a1', NOW);
    eq(b.promises.length, 2, 'both open promises');
    eq(b.promises[0].overdue, true, 'the overdue one is first and flagged');
    eq(b.people.length, 2, 'people are carried');
    eq(b.quotes.length, 1, 'the verbatim quote is carried');
    eq(b.alsoKnown.length, 1, 'related notes appear as "also known"');
    ok(b.alsoKnown.length <= 3, 'capped so the brief stays readable standing up');

    /* Once a note is promoted it appears above as a thread, so the brief must
       not also repeat it underneath. */
    const promoted = db();
    promoted.threads.push(M.threadFromNote({ id: 'n2', text: 'Cut a VPN estate from nine to two. #vpn @Northbank' },
                                           'a1', 'question', 'pn1', NOW));
    const b2 = M.buildBrief(promoted, 'a1', NOW);
    eq(b2.alsoKnown.length, 0, 'a tracked note drops out of "also known"');
    ok(M.briefText(b2).indexOf('nine to two') === M.briefText(b2).lastIndexOf('nine to two'),
       'and the text brief mentions it exactly once');
    eq(b.gapNote, null, 'no gap note on a warm account');

    const txt = M.briefText(b);
    ok(txt.indexOf('You promised:') < txt.indexOf('People:'), 'promises come before people');
    ok(txt.includes('4 days overdue'), 'the overdue label survives into text');
    ok(txt.includes('Also known:'), 'related notes reach the text brief');
    eq(M.buildBrief(db(), 'nope', NOW), null, 'an unknown account returns null rather than throwing');

    const d2 = db();
    d2.entries = d2.entries.filter(e => e.accountId !== 'a1');
    ok(M.buildBrief(d2, 'a1', NOW).gapNote.includes('70 days'), 'a long gap produces an explicit note');
  }

  section('CRM subset');
  {
    const t = M.crmText(M.buildBrief(db(), 'a1', NOW));
    ok(t.includes('Summary: Tom moved from blocking'), 'so what becomes the summary');
    ok(t.includes('Next step:'), 'a next step is included');
    ok(!t.includes('turned the last one off'), 'the verbatim quote stays out of the CRM');
    ok(!t.includes('fears being blamed'), 'the learning stays out of the CRM');
  }

  section('practice');
  {
    const d = db();
    eq(M.deck(d, Deck.DECK).length, 44, 'the built-in deck is present');
    eq(M.dueCards(d, Deck.DECK, NOW).length, 44, 'everything is due before any reps');

    const s = M.schedule(d, 'o1', 'nailed', NOW);
    ok(s.interval >= 6, 'nailing it pushes the card out');
    eq(M.dueCards(d, Deck.DECK, NOW).length, 43, 'and it leaves the due list');
    eq(M.schedule(d, 'o2', 'fumbled', NOW).interval, 1, 'fumbling brings it back tomorrow');
    let long = { interval: 100, reps: 9 };
    d.sched.o3 = long;
    ok(M.schedule(d, 'o3', 'nailed', NOW).interval <= 120, 'intervals are capped');

    /* One click from something real to something rehearsed. */
    const card = M.cardFromSource('Inline inspection will break trading apps', 'Northbank, architect', 'objection', 'c1', 'thread:t3');
    d.cards.push(card);
    eq(M.deck(d, Deck.DECK).length, 45, 'a promoted card joins the deck');
    eq(M.isPractised(d, 'thread:t3'), true, 'and is recorded against its source');
    eq(M.isPractised(d, 'thread:t4'), false, 'other sources are unaffected');
    eq(M.cardFromSource('x', '', 'nonsense', 'c2', null).cat, 'objection', 'an unknown category falls back');
    ok(Array.isArray(card.shape) && card.shape.length > 0, 'promoted cards still have a shape');
  }

  section('context packs');
  {
    const d = db();
    const pack = M.accountPack(d, 'a1', NOW);
    ok(pack.startsWith('# Northbank: account context'), 'account pack is titled');
    ok(pack.includes('Do not invent product claims'), 'carries the grounding preamble');
    ok(['## People', '## Open', '## History'].every(s => pack.includes(s)), 'has the expected sections');
    ok(pack.includes('So what:') && pack.includes('I learned:'), 'the five lines survive');
    ok(pack.includes('4 days overdue'), 'due labels are resolved, not raw dates');
    ok(pack.includes('## Also known'), 'related notes reach the account pack');

    const port = M.portfolioPack(d, NOW);
    ok(port.includes('Northbank') && port.includes('Selwyn Health'), 'portfolio covers live accounts');
    ok(!port.includes('Archived Co'), 'and excludes archived');

    const np = M.notesPack(d, { tag: 'dlp' }, NOW);
    ok(np.includes('tagged #dlp'), 'the notes pack states its scope');
    ok(!np.includes('nine to two'), 'out-of-scope notes are excluded');
    const shown = M.filterNotes(d, { tag: 'dlp' }).length;
    eq((np.match(/^- /gm) || []).length, shown, 'the pack contains exactly what the filter shows');
    ok(M.notesPack(M.blankDb(), {}, NOW).includes('No notes in scope'), 'an empty pack says so');

    ok(M.answerPack(d, NOW).includes('My kept answer.'), 'the answer pack carries kept answers');
    eq(M.scopeLabel({ kind: 'all' }), 'all notes', 'scope label for no filter');
  }

  section('search across everything');
  {
    const d = db();
    ok(M.searchAll(d, 'trading').length >= 1, 'finds a thread');
    ok(M.searchAll(d, 'blamed').length >= 1, 'finds a learning');
    ok(M.searchAll(d, 'Priya').length >= 1, 'finds a person');
    ok(M.searchAll(d, 'unicode').length >= 1, 'finds a note');
    ok(M.searchAll(d, 'kept answer').length >= 1, 'finds a kept answer');
    eq(M.searchAll(d, '').length, 0, 'an empty query returns nothing');
    eq(M.searchAll(d, 'zzznope').length, 0, 'a miss returns nothing');
    ok(M.searchAll(d, 'PRIYA').length >= 1, 'case insensitive');
  }

  section('sanitising');
  {
    const clean = M.sanitiseDb({
      accounts: [{ id: 'ok', name: 'Good', stage: 'Evaluation', created: 1 }, { id: 'bad' }, null],
      people: [{ id: 'p', accountId: 'ok', name: 'P', stance: 'wat' }, { id: 'o', accountId: 'ghost', name: 'O' }],
      threads: [{ id: 't', accountId: 'ok', kind: 'nonsense', text: 'x' }, { id: 't2', accountId: 'ghost', text: 'y' }],
      entries: [{ id: 'e', accountId: 'ok', soWhat: 'kept' }, { id: 'e2', accountId: 'ok' }],
      notes: [{ id: 'n', text: 'fine' }, { id: 'n2', text: '  ' }, { id: 'n', text: 'dupe id' }],
      cards: [{ id: 'c', prompt: 'p', cat: 'nope' }, { id: 'c2' }],
      settings: { lockMins: 'nope' }
    });
    eq(clean.accounts.length, 1, 'malformed accounts dropped');
    eq(clean.people.length, 1, 'orphan people dropped');
    eq(clean.people[0].stance, 'neutral', 'unknown stance falls back');
    eq(clean.threads.length, 1, 'orphan threads dropped');
    eq(clean.threads[0].kind, 'action', 'unknown thread kind falls back');
    eq(clean.entries.length, 1, 'empty entries dropped');
    eq(clean.notes.length, 1, 'blank and duplicate-id notes dropped');
    eq(clean.cards.length, 1, 'cards without a prompt dropped');
    eq(clean.cards[0].cat, 'objection', 'unknown card category falls back');
    eq(clean.settings.lockMins, 15, 'bad setting falls back');
    eq(M.sanitiseDb(null).accounts.length, 0, 'null sanitises clean');
    eq(M.sanitiseDb('nope').accounts.length, 0, 'a string sanitises clean');
  }

  section('migration from the three predecessor apps');
  {
    const d = M.blankDb();
    /* Account Brain shape */
    const added1 = M.mergeInto(d, {
      accounts: [{ id: 'ab1', name: 'From Account Brain', stage: 'Discovery', created: NOW }],
      threads: [{ id: 'abt', accountId: 'ab1', kind: 'promise', text: 'owed', created: NOW }],
      entries: [{ id: 'abe', accountId: 'ab1', ts: NOW, learned: 'a learning' }]
    });
    ok(added1 >= 3, 'account brain records come across');
    /* Field Notes shape */
    M.mergeInto(d, { notes: [{ id: 'fn1', kind: 'gotcha', text: 'a gotcha #x', ts: NOW, tags: ['x'], accounts: [], seen: 4 }] });
    eq(d.notes.length, 1, 'field notes come across');
    eq(M.seenCount(d, 'fn1'), 4, 'the old per-note seen counter migrates into the shared map');
    /* Dojo shape */
    M.mergeInto(d, {
      reps: [{ id: 'o1', cat: 'objection', ts: NOW, total: 7 }],
      sched: { o1: { interval: 3, reps: 1, due: NOW } },
      bank: [{ id: 'bk', prompt: 'q', text: 'a' }],
      cards: [{ id: 'dc', prompt: 'my card', cat: 'objection' }],
      settings: { streak: 5 }
    });
    eq(d.reps.length, 1, 'dojo reps come across');
    eq(d.bank.length, 1, 'kept answers come across');
    eq(d.cards.length, 1, 'custom cards come across');
    eq(d.settings.streak, 5, 'the streak is preserved');
    eq(M.allNotes(d).length, 2, 'the merged store unions notes and learnings');

    const again = M.mergeInto(d, { accounts: [{ id: 'ab1', name: 'From Account Brain', stage: 'Discovery', created: NOW }] });
    eq(again, 0, 'merging the same store twice adds nothing');
    eq(M.mergeInto(d, null), 0, 'merging nothing is safe');
  }

  section('stats');
  {
    const s = M.stats(db(), NOW);
    eq(s.accounts, 3, 'live accounts');
    eq(s.notes, 5, 'notes including derived');
    eq(s.kept, 1, 'kept answers');
  }

  section('deck integrity');
  {
    const { DECK, CATS } = Deck;
    eq(DECK.length, 44, 'the built-in deck is intact');
    ok(new Set(DECK.map(c => c.id)).size === DECK.length, 'card ids are unique');
    ok(DECK.every(c => CATS[c.cat]), 'every card has a known category');
    ok(DECK.every(c => Array.isArray(c.shape) && c.shape.length >= 2), 'every card has a shape');
    const banned = /\b(netskope|zscaler|palo alto|cato|fortinet|versa|cisco|cloudflare)\b/i;
    ok(!DECK.some(c => banned.test(c.prompt + ' ' + (c.setting || '') + ' ' + c.shape.join(' ') + ' ' + c.watch)),
       'no vendor names in the built-in deck');
    ok(!DECK.some(c => /\b\d{2,}\s?(%|percent)\b/i.test(c.prompt + c.watch)), 'no statistics in the built-in deck');
  }

  section('encryption');
  {
    const sealed = await Store.seal(db(), 'a long enough passphrase');
    const blob = JSON.stringify(sealed.envelope);
    ok(sealed.envelope.enc === true, 'envelope is flagged encrypted');
    ok(!blob.includes('Priya Raman'), 'customer names are not readable in the stored blob');
    ok(!blob.includes('Northbank'), 'account names are not readable');
    ok(!blob.includes('turned the last one off'), 'quotes are not readable');
    ok(!blob.includes('unicode'), 'notes are not readable');
    const opened = await Store.unseal(sealed.envelope, 'a long enough passphrase');
    eq(opened.data.accounts[0].name, 'Northbank', 'decrypts back intact');
    await throws(() => Store.unseal(sealed.envelope, 'wrong'), /Wrong passphrase/, 'rejects a wrong passphrase');

    const tampered = Object.assign({}, sealed.envelope);
    const bytes = Store.fromB64(tampered.ct);
    bytes[11] ^= 0xff;
    tampered.ct = Store.toB64(bytes);
    await throws(() => Store.unseal(tampered, 'a long enough passphrase'), /Wrong passphrase/, 'detects tampering');

    const a = await Store.seal(db(), 'same passphrase');
    const b = await Store.seal(db(), 'same passphrase');
    ok(a.envelope.salt !== b.envelope.salt && a.envelope.iv !== b.envelope.iv, 'fresh salt and iv per seal');
  }

  section('crypto layer contract');
  {
    /* This section used to diff store.js against the three sibling apps. Those
       have been retired and deleted, so the comparison had nothing to run
       against and was quietly counting three passes for checks it never made.
       Guard store.js's own contract instead: every value below is baked into
       the stored envelope format, and changing one silently would make existing
       backups unreadable. */
    eq(Store.APP, 'ground', 'the app name written into envelopes');
    eq(Store.VERSION, 1, 'envelope version is pinned');
    ok(Store.ITERATIONS >= 600000, `PBKDF2 work factor meets the OWASP floor (${Store.ITERATIONS})`);

    const env = Store.plainEnvelope({ hello: 'world' });
    eq(env.app, 'ground', 'plain envelopes carry the app name');
    eq(env.enc, false, 'and are flagged unencrypted');
    ok(Store.isEnvelope(env), 'and are recognised as ours');

    /* Every other copy of this file must not diverge: comp-calc ships one so
       its saved plan uses the same envelope, and a retired sibling would still
       have to match if one were ever restored. An assertion that cannot run is
       not counted, which is the bug this replaces. */
    const strip = s => s
      .replace(/\/\*[\s\S]*?\*\//, '')
      .replace(/var APP = '[^']+';/, "var APP = 'X';")
      .replace(/root\.\w+ = factory\(\)/, 'root.X = factory()');
    const mine = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
    const siblings = ['dojo', 'account-brain', 'field-notes', 'comp-calc']
      .map(app => path.join(__dirname, '..', '..', app, 'store.js'))
      .filter(f => fs.existsSync(f));
    siblings.forEach(f => {
      ok(strip(mine) === strip(fs.readFileSync(f, 'utf8')), `no drift from ${f}`);
    });
    console.log(`  (${siblings.length} sibling cop${siblings.length === 1 ? 'y' : 'ies'} on disk to compare against)`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
