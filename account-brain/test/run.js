/* Dependency-free checks for Account Brain.
   Run with:  node account-brain/test/run.js
   Needs Node 18+ for global Web Crypto. */
const fs = require('fs');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'store.js'));
const M = require(path.join(__dirname, '..', 'model.js'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
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
const iso = offsetDays => {
  const d = new Date(NOW + offsetDays * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function db() {
  return {
    accounts: [
      { id: 'a1', name: 'Northbank', stage: 'Evaluation', sector: 'Banking', note: 'VPN at end of life', created: NOW - 70 * DAY },
      { id: 'a2', name: 'Selwyn Health', stage: 'Discovery', sector: 'Healthcare', note: '', created: NOW - 60 * DAY },
      { id: 'a3', name: 'Old Dormant', stage: 'Dormant', sector: '', note: '', created: NOW - 300 * DAY },
      { id: 'a4', name: 'Archived Co', stage: 'Discovery', sector: '', note: '', created: NOW - 10 * DAY, archived: true }
    ],
    people: [
      { id: 'p1', accountId: 'a1', name: 'Priya Raman', role: 'Head of Infrastructure', stance: 'champion', cares: 'Getting off the VPN' },
      { id: 'p2', accountId: 'a1', name: 'Tom Aldridge', role: 'Security Architect', stance: 'blocker', cares: 'False positive rates' },
      { id: 'p3', accountId: 'a1', name: 'Dawn Whitfield', role: 'CFO', stance: 'neutral', cares: 'What comes off the bill' }
    ],
    threads: [
      { id: 't1', accountId: 'a1', kind: 'promise', text: 'Send Priya the regional data answer', due: iso(-4), created: NOW - 9 * DAY, done: false },
      { id: 't2', accountId: 'a1', kind: 'promise', text: 'Share the sizing sheet', due: iso(2), created: NOW - 2 * DAY, done: false },
      { id: 't3', accountId: 'a1', kind: 'objection', text: 'Inline inspection will break trading apps', created: NOW - 16 * DAY, done: false },
      { id: 't4', accountId: 'a1', kind: 'action', text: 'Agree the three decisive criteria', created: NOW - 5 * DAY, done: false },
      { id: 't5', accountId: 'a1', kind: 'objection', text: 'Microsoft shop objection', created: NOW - 40 * DAY, done: true },
      { id: 't6', accountId: 'a2', kind: 'risk', text: 'No exec sponsor', created: NOW - 30 * DAY, done: false }
    ],
    entries: [
      { id: 'e1', accountId: 'a1', ts: NOW - 9 * DAY, meeting: 'Technical deep dive',
        soWhat: 'Tom moved from blocking to willing to test.',
        theySaid: 'We turned the last one off after six weeks.',
        learned: 'Tom fears being blamed for a rollout, not latency.',
        open: 'No business attendee yet.', owe: 'Regional data answer to Priya.' },
      { id: 'e2', accountId: 'a1', ts: NOW - 16 * DAY, meeting: 'First session', soWhat: 'Good energy, no business sponsor.' },
      { id: 'e3', accountId: 'a1', ts: NOW - 40 * DAY, meeting: 'Intro', text: 'Hardware refresh is the forcing function.' },
      { id: 'e4', accountId: 'a2', ts: NOW - 40 * DAY, meeting: 'Intro call', learned: 'Health sector procurement runs on a fixed annual cycle.' }
    ],
    settings: { lockMins: 15 }
  };
}

(async () => {

  section('dates');
  eq(M.daysSince(NOW - 3 * DAY, NOW), 3, 'daysSince counts whole days');
  eq(M.ago(NOW, NOW), 'today', 'today');
  eq(M.ago(NOW - DAY, NOW), 'yesterday', 'yesterday');
  eq(M.ago(NOW - 30 * DAY, NOW), '1 month ago', 'singular month, not "1 months"');
  eq(M.ago(NOW - 365 * DAY, NOW), '1 year ago', 'singular year');
  eq(M.daysUntil(iso(0), NOW), 0, 'due today is zero days');
  eq(M.daysUntil(iso(-3), NOW), -3, 'overdue is negative');
  eq(M.dueLabel(iso(-1), NOW), '1 day overdue', 'singular overdue day');
  eq(M.dueLabel(iso(0), NOW), 'due today', 'due today reads naturally');
  eq(M.dueLabel(iso(1), NOW), 'due tomorrow', 'due tomorrow reads naturally');
  eq(M.daysUntil(null, NOW), null, 'no due date is null, not zero');
  eq(M.daysUntil('nonsense', NOW), null, 'a malformed date is null');

  section('warmth');
  eq(M.warmth(0).level, 'warm', 'fresh contact is warm');
  eq(M.warmth(20).level, 'warm', 'under three weeks is still warm');
  eq(M.warmth(21).level, 'cooling', 'three weeks is cooling');
  eq(M.warmth(40).level, 'cold', 'over five weeks is cold');

  section('selectors');
  {
    const d = db();
    eq(M.liveAccounts(d).length, 3, 'archived accounts are excluded');
    eq(M.peopleOf(d, 'a1')[0].name, 'Priya Raman', 'champion sorts first');
    eq(M.peopleOf(d, 'a1')[2].name, 'Tom Aldridge', 'blocker sorts last');
    eq(M.threadsOf(d, 'a1', false).length, 4, 'open threads only');
    eq(M.threadsOf(d, 'a1', true).length, 1, 'closed threads only');
    eq(M.threadsOf(d, 'a1', false)[0].kind, 'promise', 'promises sort to the top');
    eq(M.entriesOf(d, 'a1')[0].id, 'e1', 'entries are newest first');
    eq(M.lastTouch(d, 'a1'), NOW - 9 * DAY, 'last touch is the newest entry');
    ok(M.lastTouch(d, 'a3') === d.accounts[2].created, 'an account with no entries falls back to its created date');
    eq(M.hasNextStep(d, 'a1'), true, 'a1 has an agreed next step');
    eq(M.hasNextStep(d, 'a2'), false, 'a2 has none');
  }

  section('attention');
  {
    const items = M.attention(db(), NOW);
    const c = M.attentionCounts(items);
    eq(c.overdue, 1, 'one overdue promise');
    eq(c.due, 1, 'one promise due soon');
    eq(items[0].kind, 'overdue', 'overdue sorts to the very top');
    eq(items[0].meta, '4 days overdue', 'overdue label is accurate');
    ok(items.some(i => i.kind === 'cold' && i.accountId === 'a2'), 'a2 is flagged cold');
    ok(items.some(i => i.kind === 'nonext' && i.accountId === 'a2'), 'a2 has no next step');
    ok(!items.some(i => i.accountId === 'a4'), 'archived accounts never raise attention');
    ok(!items.some(i => i.kind === 'nonext' && i.accountId === 'a3'), 'dormant accounts are not nagged for a next step');
    ok(!items.some(i => i.kind === 'overdue' && i.text === 'Share the sizing sheet'), 'a future promise is not overdue');
  }
  {
    const d = M.blankDb();
    eq(M.attention(d, NOW).length, 0, 'an empty store raises nothing');
  }
  {
    /* A promise with no due date should not silently become overdue. */
    const d = M.blankDb();
    d.accounts.push({ id: 'x', name: 'X', stage: 'Discovery', created: NOW });
    d.threads.push({ id: 'x1', accountId: 'x', kind: 'promise', text: 'no date', created: NOW, done: false, due: null });
    const items = M.attention(d, NOW);
    ok(!items.some(i => i.kind === 'overdue'), 'a promise without a due date is never overdue');
  }

  section('brief');
  {
    const b = M.buildBrief(db(), 'a1', NOW);
    eq(b.account.name, 'Northbank', 'brief is for the right account');
    eq(b.ago, '9 days ago', 'last contact reads correctly');
    eq(b.warmth.level, 'warm', 'nine days is warm');
    eq(b.promises.length, 2, 'both open promises appear');
    eq(b.promises[0].text, 'Send Priya the regional data answer', 'the overdue promise is listed first');
    eq(b.promises[0].overdue, true, 'and is flagged overdue');
    eq(b.objections.length, 1, 'only open objections');
    eq(b.people.length, 3, 'all people');
    eq(b.quotes.length, 1, 'the verbatim quote is carried');
    eq(b.recent.length, 3, 'the last three entries');
    eq(b.gapNote, null, 'no gap note on a warm account');
    eq(b.empty, false, 'not flagged empty');

    const txt = M.briefText(b);
    ok(txt.includes('You promised:'), 'text brief leads with promises');
    ok(txt.includes('4 days overdue'), 'text brief carries the overdue label');
    ok(txt.indexOf('You promised:') < txt.indexOf('People:'), 'promises come before people');
    ok(txt.includes('"We turned the last one off after six weeks."'), 'the quote is verbatim and quoted');
  }
  {
    const d = db();
    d.entries = d.entries.filter(e => e.accountId !== 'a1');
    const b = M.buildBrief(d, 'a1', NOW);
    ok(b.gapNote && b.gapNote.includes('70 days'), 'a long gap produces an explicit note');
  }
  {
    const d = M.blankDb();
    d.accounts.push({ id: 'z', name: 'Empty Co', stage: 'Discovery', created: NOW });
    eq(M.buildBrief(d, 'z', NOW).empty, true, 'an untouched account is flagged empty');
    eq(M.buildBrief(d, 'nope', NOW), null, 'an unknown account returns null rather than throwing');
  }

  section('CRM subset');
  {
    const t = M.crmText(M.buildBrief(db(), 'a1', NOW));
    ok(t.includes('Summary: Tom moved from blocking'), 'so what becomes the summary');
    ok(t.includes('Next step:'), 'a next step is included');
    ok(!t.includes('We turned the last one off'), 'the verbatim quote stays out of the CRM');
    ok(!t.includes('Tom fears being blamed'), 'the learning stays out of the CRM');
  }

  section('craft');
  {
    const items = M.craftItems(db());
    eq(items.length, 2, 'only entries with a learning');
    eq(items[0].accountName, 'Northbank', 'learnings carry their account name');
    eq(items[0].learned, 'Tom fears being blamed for a rollout, not latency.', 'text is intact');

    const env = M.dojoCardEnvelope(items);
    eq(env.app, 'dojo', 'emits a Dojo-shaped envelope');
    eq(env.enc, false, 'as a plain envelope The Dojo can import');
    eq(env.data.custom.length, 2, 'one card per learning');
    ok(env.data.custom[0].prompt.includes('We turned the last one off'), 'the quote becomes the prompt');
    ok(env.data.custom.every(c => c.id && c.cat && Array.isArray(c.shape) && c.watch), 'cards have every field The Dojo needs');
    ok(new Set(env.data.custom.map(c => c.id)).size === env.data.custom.length, 'card ids are unique');
  }

  section('context packs');
  {
    const pack = M.accountPack(db(), 'a1', NOW);
    ok(pack.startsWith('# Northbank: account context'), 'account pack is titled');
    ok(pack.includes('Do not invent product claims'), 'carries the grounding preamble');
    ok(pack.includes('## People') && pack.includes('## Open') && pack.includes('## History'), 'has the expected sections');
    ok(pack.includes('So what:') && pack.includes('They said:') && pack.includes('I learned:'), 'the five lines survive into the pack');
    ok(pack.includes('4 days overdue'), 'due labels are resolved, not raw dates');

    const port = M.portfolioPack(db(), NOW);
    ok(port.includes('Northbank') && port.includes('Selwyn Health'), 'portfolio pack covers live accounts');
    ok(!port.includes('Archived Co'), 'and excludes archived ones');
  }

  section('search');
  {
    const d = db();
    ok(M.searchAll(d, 'trading').length >= 1, 'finds text inside a thread');
    ok(M.searchAll(d, 'blamed').length >= 1, 'finds text inside a learning');
    ok(M.searchAll(d, 'Priya').length >= 1, 'finds a person');
    eq(M.searchAll(d, '').length, 0, 'an empty query returns nothing');
    eq(M.searchAll(d, 'zzzznotpresent').length, 0, 'a miss returns nothing');
    ok(M.searchAll(d, 'PRIYA').length >= 1, 'search is case insensitive');
    const hits = M.searchAll(d, 'Priya');
    ok(hits.every(h => h.accountName === 'Northbank'), 'hits carry their account name');
  }

  section('import sanitising');
  {
    const clean = M.sanitiseDb({
      accounts: [
        { id: 'ok', name: 'Good', stage: 'Evaluation', created: 1 },
        { id: 'bad' },                                   // no name
        { name: 'no id' },
        null
      ],
      people: [
        { id: 'p', accountId: 'ok', name: 'Person', stance: 'wat' },
        { id: 'orphan', accountId: 'ghost', name: 'Orphan' }
      ],
      threads: [
        { id: 't', accountId: 'ok', kind: 'nonsense', text: 'x' },
        { id: 't2', accountId: 'ghost', kind: 'promise', text: 'orphan' }
      ],
      entries: [
        { id: 'e', accountId: 'ok', soWhat: 'kept' },
        { id: 'e2', accountId: 'ok' },                   // entirely empty
        { id: 'e3', accountId: 'ghost', soWhat: 'orphan' }
      ],
      settings: { lockMins: 'not a number' }
    });
    eq(clean.accounts.length, 1, 'malformed accounts are dropped');
    eq(clean.people.length, 1, 'people belonging to unknown accounts are dropped');
    eq(clean.people[0].stance, 'neutral', 'an unknown stance falls back to neutral');
    eq(clean.threads.length, 1, 'orphan threads are dropped');
    eq(clean.threads[0].kind, 'action', 'an unknown thread kind falls back to a next step');
    eq(clean.entries.length, 1, 'empty and orphan entries are dropped');
    eq(clean.settings.lockMins, 15, 'a bad setting falls back to the default');
    eq(M.sanitiseDb(null).accounts.length, 0, 'null imports cleanly to an empty store');
    eq(M.sanitiseDb('nonsense').accounts.length, 0, 'a string imports cleanly to an empty store');
  }

  section('encryption');
  {
    const sealed = await Store.seal(db(), 'a long enough passphrase');
    const blob = JSON.stringify(sealed.envelope);
    ok(sealed.envelope.enc === true, 'envelope is flagged encrypted');
    ok(!blob.includes('Priya Raman'), 'customer names are not readable in the stored blob');
    ok(!blob.includes('Northbank'), 'account names are not readable either');
    ok(!blob.includes('turned the last one off'), 'verbatim quotes are not readable');
    const opened = await Store.unseal(sealed.envelope, 'a long enough passphrase');
    eq(opened.data.accounts[0].name, 'Northbank', 'decrypts back intact');
    await throws(() => Store.unseal(sealed.envelope, 'wrong'), /Wrong passphrase/, 'rejects a wrong passphrase');

    const tampered = Object.assign({}, sealed.envelope);
    const bytes = Store.fromB64(tampered.ct);
    bytes[9] ^= 0xff;
    tampered.ct = Store.toB64(bytes);
    await throws(() => Store.unseal(tampered, 'a long enough passphrase'), /Wrong passphrase/, 'detects tampering');

    const a = await Store.seal(db(), 'same passphrase');
    const b = await Store.seal(db(), 'same passphrase');
    ok(a.envelope.salt !== b.envelope.salt && a.envelope.iv !== b.envelope.iv, 'fresh salt and iv per seal');
  }

  section('envelopes do not cross between apps');
  {
    const dojoEnv = { app: 'dojo', v: 1, enc: false, data: {} };
    ok(!Store.isEnvelope(dojoEnv), 'a Dojo file is not accepted as an Account Brain file');
    await throws(() => Store.unseal(dojoEnv), /Not a Dojo file|Not a/, 'and is rejected on open');
  }

  section('crypto layer has not drifted from The Dojo');
  {
    const mine = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
    const dojo = fs.readFileSync(path.join(__dirname, '..', '..', 'dojo', 'store.js'), 'utf8');
    const strip = s => s
      .replace(/\/\*[\s\S]*?\*\//, '')                 // leading block comment differs by design
      .replace(/var APP = '[^']+';/, "var APP = 'X';")
      .replace(/root\.\w+Store = factory\(\)/, 'root.X = factory()')
      .replace(/node [\w-]+\/test\/run\.js/g, 'node X/test/run.js');
    ok(strip(mine) === strip(dojo), 'the two copies of store.js are identical apart from the app name');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
