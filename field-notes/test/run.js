/* Dependency-free checks for Field Notes.
   Run with:  node field-notes/test/run.js
   Needs Node 18+ for global Web Crypto. */
const fs = require('fs');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'store.js'));
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

let seq = 0;
function note(kind, text, daysAgo, seen) {
  const n = M.makeNote(kind, text, NOW - (daysAgo || 0) * DAY);
  n.id = 'n' + (++seq);
  n.seen = seen || 0;
  return n;
}

function db() {
  return {
    notes: [
      note('objection', 'They turned off their last DLP after false positives. #dlp #trust @Northbank', 2),
      note('answer', 'Separating the tool from the approach landed with Tom. #dlp @Northbank', 2),
      note('proof', 'Cut a VPN concentrator estate from nine to two over two quarters. #vpn #ztna', 20),
      note('gotcha', 'Policy import silently drops rules with unicode names. #dlp', 40, 3),
      note('competitor', 'Heard at a conference: they lead with single-pass everywhere. #competitive', 5),
      note('lesson', 'Technical enthusiasm is not a deal. Ask who signs, early. #qualification', 60, 1),
      note('question', 'What would have to break for this to become urgent? #discovery', 90, 0)
    ],
    settings: { lockMins: 15, lastKind: 'objection' }
  };
}

(async () => {

  section('parsing');
  {
    const p = M.parse('Objection about #dlp and #Trust from @Northbank and @"Selwyn Health"');
    eq(p.tags.join(','), 'dlp,trust', 'tags are lowercased');
    eq(p.accounts.join('|'), 'Northbank|Selwyn Health', 'quoted multi-word accounts parse');
    eq(M.parse('no markers here').tags.length, 0, 'plain text yields no tags');
    eq(M.parse('#a #a #A').tags.length, 1, 'duplicate tags collapse');
    eq(M.parse('email me at a@b.com').accounts.join(''), 'b.com', 'a bare email is read as an account, a known limit of inline syntax');
    eq(M.parse('café #café').tags[0], 'café', 'non-ascii tags are kept');
    eq(M.makeNote('nonsense', 'x #a', NOW).kind, 'lesson', 'an unknown kind falls back to lesson');
  }

  section('time');
  eq(M.ago(NOW, NOW), 'today', 'today');
  eq(M.ago(NOW - DAY, NOW), 'yesterday', 'yesterday');
  eq(M.ago(NOW - 30 * DAY, NOW), '1 month ago', 'singular month, not "1 months"');
  eq(M.ago(NOW - 365 * DAY, NOW), '1 year ago', 'singular year');

  section('filtering');
  {
    const d = db();
    eq(M.filterNotes(d, {}).length, 7, 'no filter returns everything');
    eq(M.filterNotes(d, { kind: 'all' }).length, 7, '"all" is the same as no filter');
    eq(M.filterNotes(d, { kind: 'objection' }).length, 1, 'filter by kind');
    eq(M.filterNotes(d, { tag: 'dlp' }).length, 3, 'filter by tag');
    eq(M.filterNotes(d, { tag: 'DLP' }).length, 3, 'tag filter is case insensitive');
    eq(M.filterNotes(d, { account: 'northbank' }).length, 2, 'filter by account, case insensitive');
    eq(M.filterNotes(d, { query: 'false positives' }).length, 1, 'free text search');
    eq(M.filterNotes(d, { query: 'FALSE POSITIVES' }).length, 1, 'search is case insensitive');
    eq(M.filterNotes(d, { kind: 'answer', tag: 'dlp' }).length, 1, 'filters combine');
    eq(M.filterNotes(d, { tag: 'nope' }).length, 0, 'a miss returns nothing');
    const sorted = M.filterNotes(d, {});
    ok(sorted[0].ts >= sorted[sorted.length - 1].ts, 'results are newest first');

    const c = M.kindCounts(d);
    eq(c.all, 7, 'counts include a total');
    eq(c.objection, 1, 'per-kind counts are right');
  }

  section('topics');
  {
    const t = M.topics(db());
    eq(t[0].tag, 'dlp', 'the most used tag sorts first');
    eq(t[0].count, 3, 'with the right count');
    eq(t[0].accountCount, 1, 'and how many accounts it spans');
    ok(t.every(x => x.tag === x.tag.toLowerCase()), 'topics are normalised to lower case');
    ok(t.some(x => x.tag === 'qualification'), 'single-use tags still appear');

    const a = M.accountsIndex(db());
    eq(a[0].name, 'Northbank', 'accounts are indexed');
    eq(a[0].count, 2, 'with note counts');
  }

  section('resurface');
  {
    const one = db();
    const picks = M.resurface(one, 3, NOW);
    eq(picks.length, 3, 'returns the number asked for');
    ok(picks.every(n => M.daysSince(n.ts, NOW) >= 1), 'today\'s notes are not resurfaced');
    ok((picks[0].seen || 0) <= (picks[1].seen || 0), 'least-seen notes come first');
    const again = M.resurface(one, 3, NOW);
    eq(picks.map(p => p.id).join(), again.map(p => p.id).join(), 'the pick is deterministic, not random');
    const fresh = { notes: [note('lesson', 'today only', 0)], settings: {} };
    eq(M.resurface(fresh, 3, NOW).length, 0, 'a store with only new notes resurfaces nothing');
  }

  section('context pack');
  {
    const pack = M.buildPack(db(), {}, NOW);
    ok(pack.startsWith('# Field notes context pack'), 'is titled');
    ok(pack.includes('Do not invent product claims'), 'carries the grounding preamble');
    ok(pack.includes('## Objection') && pack.includes('## Proof point'), 'groups by kind');
    ok(pack.indexOf('## Objection') < pack.indexOf('## Lesson'), 'kinds appear in a stable order');
    ok(pack.includes('@Northbank') && pack.includes('#dlp'), 'metadata travels with each note');

    const scoped = M.buildPack(db(), { tag: 'dlp' }, NOW);
    ok(scoped.includes('tagged #dlp'), 'the scope is stated in the pack');
    ok(!scoped.includes('nine to two'), 'out-of-scope notes are excluded');

    const empty = M.buildPack(M.blankDb(), {}, NOW);
    ok(empty.includes('No notes in scope yet'), 'an empty pack says so rather than being blank');

    /* The pack must never disagree with the list on screen. */
    const f = { kind: 'objection', tag: 'dlp' };
    const shown = M.filterNotes(db(), f).length;
    const inPack = (M.buildPack(db(), f, NOW).match(/^- /gm) || []).length;
    eq(inPack, shown, 'the pack contains exactly what the filter shows');
    eq(M.scopeLabel({ kind: 'all' }), 'all notes', 'scope label for no filter');
    eq(M.scopeLabel({ kind: 'gotcha', tag: 'dlp', account: 'X', query: 'q' }),
       'gotcha notes, tagged #dlp, for @X, matching "q"', 'scope label describes every filter');
  }

  section('import from Account Brain');
  {
    const ab = {
      accounts: [{ id: 'a1', name: 'Northbank' }, { id: 'a2', name: 'Selwyn Health' }],
      entries: [
        { id: 'e1', accountId: 'a1', ts: NOW - DAY, learned: 'Tom fears being blamed, not latency.' },
        { id: 'e2', accountId: 'a1', ts: NOW - DAY, soWhat: 'Progress', theySaid: 'A quote' },
        { id: 'e3', accountId: 'a2', ts: NOW, learned: 'Health procurement runs annually.' }
      ],
      threads: [
        { id: 't1', accountId: 'a1', kind: 'objection', text: 'Inline inspection breaks trading apps', created: NOW, done: false },
        { id: 't2', accountId: 'a1', kind: 'objection', text: 'Already closed one', created: NOW, done: true },
        { id: 't3', accountId: 'a1', kind: 'promise', text: 'Send the sheet', created: NOW, done: false }
      ]
    };
    const got = M.fromAccountBrain(ab, []);
    eq(got.length, 3, 'imports learnings and open objections only');
    eq(got.filter(n => n.kind === 'lesson').length, 2, 'learnings become lessons');
    eq(got.filter(n => n.kind === 'objection').length, 1, 'open objections become objections');
    ok(!got.some(n => n.text.includes('A quote')), 'quotes are not imported, because the right kind cannot be inferred');
    ok(!got.some(n => n.text.includes('Send the sheet')), 'promises stay in Account Brain');
    ok(!got.some(n => n.text.includes('Already closed')), 'closed objections are not imported');
    ok(got[0].accounts.indexOf('Northbank') !== -1, 'the account name is attached');
    eq(got[0].source, 'account-brain', 'imported notes are marked as imported');

    const again = M.fromAccountBrain(ab, got);
    eq(again.length, 0, 'importing twice adds nothing');

    const partial = M.fromAccountBrain(ab, [got[0]]);
    eq(partial.length, 2, 'only genuinely new items come through on a second run');
    eq(M.fromAccountBrain(null, []).length, 0, 'a null store imports nothing');
    eq(M.fromAccountBrain({ accounts: 'nope' }, []).length, 0, 'a malformed store imports nothing');
  }

  section('export to The Dojo');
  {
    const env = M.dojoCardEnvelope(db().notes);
    eq(env.app, 'dojo', 'emits a Dojo-shaped envelope');
    eq(env.enc, false, 'as a plain envelope The Dojo can import');
    eq(env.data.custom.length, 3, 'only objections, gotchas and competitor notes become cards');
    ok(env.data.custom.every(c => c.id && c.cat && c.prompt && Array.isArray(c.shape) && c.watch),
       'every card has the fields The Dojo needs');
    ok(new Set(env.data.custom.map(c => c.id)).size === 3, 'card ids are unique');
    ok(env.data.custom.some(c => c.cat === 'competitive'), 'competitor notes map to the competitive category');
    eq(M.dojoCardEnvelope([]).data.custom.length, 0, 'nothing selected produces no cards');
  }

  section('migration and sanitising');
  {
    const legacy = { v: 1, kind: 'proof', notes: [
      { id: 'x1', kind: 'person', text: 'Priya cares about the refresh budget', tags: [], accounts: ['Northbank'], ts: NOW, seen: 0 },
      { id: 'x2', kind: 'objection', text: 'Real one', tags: ['dlp'], accounts: [], ts: NOW - DAY }
    ] };
    ok(M.isLegacyPrototype(legacy), 'the prototype shape is recognised');
    ok(!M.isLegacyPrototype({ app: 'field-notes', enc: false, data: {} }), 'a proper envelope is not mistaken for it');
    const clean = M.sanitiseDb(legacy);
    eq(clean.notes.length, 2, 'legacy notes are lifted, not discarded');
    eq(clean.notes.filter(n => n.kind === 'lesson').length, 1, 'the retired "person" kind becomes a lesson');
    eq(clean.settings.lastKind, 'proof', 'the prototype top-level kind is carried over');

    const messy = M.sanitiseDb({ notes: [
      { id: 'a', text: 'good', ts: NOW },
      { id: 'b', text: '   ' },
      { id: 'c' },
      null,
      { id: 'a', text: 'duplicate id' },
      { id: 'd', text: 'bad fields', tags: 'nope', accounts: 5, ts: 'soon', seen: NaN }
    ], settings: { lockMins: 'x' } });
    eq(messy.notes.length, 2, 'blank, malformed and duplicate-id notes are dropped');
    const d = messy.notes.filter(n => n.id === 'd')[0];
    eq(d.tags.length, 0, 'a non-array tags field becomes empty');
    eq(d.seen, 0, 'a NaN seen count becomes zero');
    ok(typeof d.ts === 'number' && isFinite(d.ts), 'a non-numeric timestamp is replaced');
    eq(messy.settings.lockMins, 15, 'a bad setting falls back to the default');
    eq(M.sanitiseDb(null).notes.length, 0, 'null sanitises to an empty store');
    eq(M.sanitiseDb('nope').notes.length, 0, 'a string sanitises to an empty store');
  }

  section('stats');
  {
    const s = M.stats(db(), NOW);
    eq(s.notes, 7, 'note count');
    eq(s.accounts, 1, 'distinct accounts');
    eq(s.topics, 7, 'distinct topics');
    eq(s.week, 3, 'notes in the last week');
  }

  section('encryption');
  {
    const sealed = await Store.seal(db(), 'a long enough passphrase');
    const blob = JSON.stringify(sealed.envelope);
    ok(sealed.envelope.enc === true, 'envelope is flagged encrypted');
    ok(!blob.includes('Northbank'), 'account names are not readable in the stored blob');
    ok(!blob.includes('false positives'), 'note text is not readable');
    const opened = await Store.unseal(sealed.envelope, 'a long enough passphrase');
    eq(opened.data.notes.length, 7, 'decrypts back intact');
    await throws(() => Store.unseal(sealed.envelope, 'wrong'), /Wrong passphrase/, 'rejects a wrong passphrase');

    const tampered = Object.assign({}, sealed.envelope);
    const bytes = Store.fromB64(tampered.ct);
    bytes[7] ^= 0xff;
    tampered.ct = Store.toB64(bytes);
    await throws(() => Store.unseal(tampered, 'a long enough passphrase'), /Wrong passphrase/, 'detects tampering');

    const a = await Store.seal(db(), 'same passphrase');
    const b = await Store.seal(db(), 'same passphrase');
    ok(a.envelope.salt !== b.envelope.salt && a.envelope.iv !== b.envelope.iv, 'fresh salt and iv per seal');
  }

  section('envelopes do not cross between apps');
  {
    for (const other of ['dojo', 'account-brain']) {
      const env = { app: other, v: 1, enc: false, data: {} };
      ok(!Store.isEnvelope(env), `a ${other} file is not accepted as a Field Notes file`);
    }
  }

  section('crypto layer has not drifted');
  {
    const strip = s => s
      .replace(/\/\*[\s\S]*?\*\//, '')
      .replace(/var APP = '[^']+';/, "var APP = 'X';")
      .replace(/root\.\w+ = factory\(\)/, 'root.X = factory()');
    const mine = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
    ['dojo', 'account-brain'].forEach(app => {
      const other = fs.readFileSync(path.join(__dirname, '..', '..', app, 'store.js'), 'utf8');
      ok(strip(mine) === strip(other), `identical to ${app}/store.js apart from the app name`);
    });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
