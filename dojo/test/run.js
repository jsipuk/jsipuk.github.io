/* Dependency-free checks for The Dojo's storage layer and deck.
   Run with:  node dojo/test/run.js
   Needs Node 18+ for global Web Crypto. */
const path = require('path');
const Store = require(path.join(__dirname, '..', 'store.js'));
const Deck = require(path.join(__dirname, '..', 'deck.js'));

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); }
};
const section = name => console.log('\n' + name);

async function throws(fn, matcher, msg) {
  try { await fn(); fail++; console.error('  ✗ ' + msg + ' (did not throw)'); }
  catch (e) {
    if (matcher && !matcher.test(e.message)) {
      fail++; console.error(`  ✗ ${msg} (wrong error: ${e.message})`);
    } else pass++;
  }
}

const sample = () => ({
  reps: [{ id: 'o1', cat: 'objection', ts: 1, total: 7, verdict: 'ok' }],
  sched: { o1: { interval: 3, reps: 1, due: 99 } },
  bank: [{ id: 'b1', cardId: 'o1', cat: 'objection', prompt: 'p', text: 'Some private answer.' }],
  custom: [{ id: 'u1', cat: 'objection', prompt: 'mine', shape: ['a'], watch: 'w' }],
  timerLen: 60, lastRepDay: '2026-08-01', streak: 3, lockMins: 15
});

(async () => {

  section('base64 round trip');
  {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    const back = Store.fromB64(Store.toB64(bytes));
    ok(back.length === bytes.length && bytes.every((b, i) => back[i] === b), 'bytes survive base64');
  }

  section('unencrypted envelope');
  {
    const env = Store.plainEnvelope(sample());
    ok(Store.isEnvelope(env), 'is recognised as an envelope');
    ok(!Store.isEncrypted(env), 'is not flagged encrypted');
    const opened = await Store.unseal(env);
    ok(opened.data.streak === 3, 'data comes back intact');
    ok(opened.key === null, 'no key returned for plain data');
  }

  section('encryption round trip');
  {
    const data = sample();
    const sealed = await Store.seal(data, 'correct horse battery');
    ok(Store.isEncrypted(sealed.envelope), 'envelope is flagged encrypted');
    ok(typeof sealed.envelope.ct === 'string' && sealed.envelope.ct.length > 20, 'ciphertext present');
    ok(sealed.envelope.iter === Store.ITERATIONS, 'iteration count recorded in the envelope');
    ok(sealed.envelope.data === undefined, 'no plaintext data field leaks into the envelope');

    const blob = JSON.stringify(sealed.envelope);
    ok(!blob.includes('Some private answer.'), 'kept answer is not readable in the stored blob');
    ok(!blob.includes('objection'), 'category names are not readable either');

    const opened = await Store.unseal(sealed.envelope, 'correct horse battery');
    ok(opened.data.bank[0].text === 'Some private answer.', 'decrypts back to the original');
    ok(opened.data.custom[0].id === 'u1', 'custom cards survive');
  }

  section('wrong passphrase');
  {
    const sealed = await Store.seal(sample(), 'right one');
    await throws(() => Store.unseal(sealed.envelope, 'wrong one'), /Wrong passphrase/, 'rejects a wrong passphrase');
    await throws(() => Store.unseal(sealed.envelope), /needs a passphrase/, 'rejects a missing passphrase');
  }

  section('tamper detection');
  {
    const sealed = await Store.seal(sample(), 'pass phrase here');
    const tampered = Object.assign({}, sealed.envelope);
    const bytes = Store.fromB64(tampered.ct);
    bytes[5] = bytes[5] ^ 0xff;                       // flip a bit in the ciphertext
    tampered.ct = Store.toB64(bytes);
    await throws(() => Store.unseal(tampered, 'pass phrase here'), /Wrong passphrase/, 'modified ciphertext fails authentication');
  }

  section('salt and iv are not reused');
  {
    const a = await Store.seal(sample(), 'same passphrase');
    const b = await Store.seal(sample(), 'same passphrase');
    ok(a.envelope.salt !== b.envelope.salt, 'a fresh salt per seal');
    ok(a.envelope.iv !== b.envelope.iv, 'a fresh iv per seal');
    ok(a.envelope.ct !== b.envelope.ct, 'identical data encrypts differently');
  }

  section('reseal keeps the same key usable');
  {
    const first = await Store.seal(sample(), 'a long enough passphrase');
    const changed = sample();
    changed.streak = 99;
    const again = await Store.reseal(changed, first.key, first.salt, first.iter);
    ok(again.salt === first.salt, 'salt is preserved across resaves');
    ok(again.iv !== first.envelope.iv, 'but a fresh iv is used each save');
    const opened = await Store.unseal(again, 'a long enough passphrase');
    ok(opened.data.streak === 99, 'resealed data decrypts with the original passphrase');
  }

  section('rejects things that are not Dojo files');
  {
    await throws(() => Store.unseal({ hello: 'world' }, 'x'), /Not a Dojo file/, 'rejects arbitrary json');
    await throws(() => Store.unseal(null, 'x'), /Not a Dojo file/, 'rejects null');
  }

  section('deck integrity');
  {
    const { DECK, CATS } = Deck;
    ok(DECK.length >= 40, `deck has a useful number of cards (${DECK.length})`);
    const ids = DECK.map(c => c.id);
    ok(new Set(ids).size === ids.length, 'card ids are unique');
    ok(DECK.every(c => CATS[c.cat]), 'every card has a known category');
    ok(DECK.every(c => c.prompt && c.prompt.length > 10), 'every card has a real prompt');
    ok(DECK.every(c => Array.isArray(c.shape) && c.shape.length >= 2), 'every card has at least two shape steps');
    ok(DECK.every(c => c.watch && c.watch.length > 5), 'every card names a failure mode');
    ok(Object.keys(CATS).every(k => DECK.some(c => c.cat === k)), 'every category has at least one card');

    /* The deck must stay vendor neutral: a practice tool that drills an
       unverified product or competitor claim is worse than no practice tool. */
    const banned = /\b(netskope|zscaler|palo alto|cato|fortinet|versa|cisco|cloudflare)\b/i;
    const offenders = DECK.filter(c => banned.test(c.prompt + ' ' + (c.setting || '') + ' ' + c.shape.join(' ') + ' ' + c.watch));
    ok(offenders.length === 0, 'no vendor names in the built-in deck: ' + offenders.map(c => c.id).join(','));

    const stats = /\b\d{2,}\s?(%|percent)\b/i;
    ok(!DECK.some(c => stats.test(c.prompt + c.watch)), 'no statistics in the built-in deck');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
