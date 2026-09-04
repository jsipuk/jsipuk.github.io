/* The payment endpoints, exercised against a fake Stripe and a fake KV.
 *
 * These are the parts where a bug costs money or hands the game away, so they
 * are tested as real HTTP: a Request goes in, a Response comes out, and the
 * Stripe calls are intercepted rather than mocked at the module boundary.
 *
 *   node test/api.js
 */

import { onRequestGet as configGet } from '../functions/api/config.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestPost as claimPost } from '../functions/api/claim.js';
import { onRequestPost as licencePost } from '../functions/api/licence.js';
import { onRequestPost as restorePost } from '../functions/api/restore.js';
import { onRequestPost as webhookPost } from '../functions/api/webhook.js';
import { hmacHex } from '../functions/_lib.js';

const failures = [];
let count = 0;
function check(name, cond, extra) {
  count++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? '  — ' + extra : ''));
  if (!cond) failures.push(name);
}
const section = (t) => console.log('\n' + t);

/* ---- Fakes ---------------------------------------------------------------- */

function fakeKV() {
  const map = new Map();
  return {
    map,
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
  };
}

function makeEnv(over = {}) {
  return {
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_PRICE_ID: 'price_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake',
    LICENCE_SECRET: 'licence-secret-for-tests',
    PRICE_LABEL: '$4.99',
    LICENCES: fakeKV(),
    ...over,
  };
}

/** Stand in for api.stripe.com. `sessions` maps id -> the object to return. */
function installStripe({ sessions = {}, failCreate = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.endsWith('/v1/checkout/sessions') && init.method === 'POST') {
      if (failCreate) {
        return new Response(JSON.stringify({ error: { message: 'No such price' } }), { status: 400 });
      }
      const body = new URLSearchParams(init.body);
      return new Response(JSON.stringify({
        id: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/cs_test_new',
        _sent: Object.fromEntries(body),
      }), { status: 200 });
    }
    const m = /\/v1\/checkout\/sessions\/([^/?]+)$/.exec(u);
    if (m) {
      const s = sessions[decodeURIComponent(m[1])];
      if (!s) return new Response(JSON.stringify({ error: { message: 'No such session' } }), { status: 404 });
      return new Response(JSON.stringify(s), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  return calls;
}

const post = (body) => new Request('https://game.example/api/x', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

const paidSession = (id = 'cs_test_1') => ({
  id, payment_status: 'paid', amount_total: 499, currency: 'usd',
  customer_details: { email: 'buyer@example.com' },
});

/* ========================================================================== */
section('Config');
{
  const r = await configGet({ env: makeEnv() });
  const d = await r.json();
  check('reports itself configured when the keys are present', d.configured === true);
  check('exposes the price label', d.price === '$4.99');

  const r2 = await configGet({ env: makeEnv({ STRIPE_SECRET_KEY: '' }) });
  const d2 = await r2.json();
  check('reports itself unconfigured when a key is missing', d2.configured === false);
  check('config never leaks a secret', !JSON.stringify(d).includes('sk_test'));
}

/* ========================================================================== */
section('Checkout');
{
  installStripe();
  const env = makeEnv();
  const r = await checkoutPost({ request: post({}), env });
  const d = await r.json();
  check('returns a Stripe Checkout URL', r.status === 200 && /checkout\.stripe\.com/.test(d.url || ''));

  const calls = installStripe();
  await checkoutPost({ request: new Request('https://game.example/api/checkout', { method: 'POST' }), env });
  const sent = new URLSearchParams(calls[0].init.body);
  check('charges the configured price, once', sent.get('line_items[0][price]') === 'price_fake'
    && sent.get('line_items[0][quantity]') === '1');
  check('is a one-off payment, not a subscription', sent.get('mode') === 'payment');
  check('sends the browser back with the session id',
    sent.get('success_url') === 'https://game.example/?purchase={CHECKOUT_SESSION_ID}',
    sent.get('success_url'));

  // The redirect target is built from our origin plus an allowlist, so a
  // hostile "query" cannot turn success_url into somebody else's site.
  const calls2 = installStripe();
  await checkoutPost({ request: post({ query: 'pay=live&utm_source=x&evil=1' }), env });
  const sent2 = new URLSearchParams(calls2[0].init.body);
  check('allowlisted parameters survive the round trip',
    sent2.get('success_url').includes('pay=live') && sent2.get('success_url').includes('utm_source=x'),
    sent2.get('success_url'));
  check('anything not allowlisted is dropped', !sent2.get('success_url').includes('evil'));

  const nasty = [
    'pay=live#@evil.example', 'pay=//evil.example', 'pay=https://evil.example',
    'ref=' + 'a'.repeat(300), 'utm_source=a b c',
  ];
  let leaked = false;
  for (const q of nasty) {
    const c = installStripe();
    await checkoutPost({ request: post({ query: q }), env });
    const url = new URLSearchParams(c[0].init.body).get('success_url');
    if (!url.startsWith('https://game.example/?')) leaked = true;
    if (/evil\.example/.test(url)) leaked = true;
  }
  check('a hostile query cannot redirect the buyer elsewhere', !leaked);

  const r3 = await checkoutPost({ request: post({}), env: makeEnv({ STRIPE_PRICE_ID: '' }) });
  check('refuses to run half-configured', r3.status === 503);
  const d3 = await r3.json();
  check('says which setting is missing', (d3.missing || []).includes('STRIPE_PRICE_ID'));

  installStripe({ failCreate: true });
  const r4 = await checkoutPost({ request: post({}), env });
  check('surfaces a Stripe error instead of throwing', r4.status === 502);
  check('the error is something a player could act on',
    /No such price/.test((await r4.json()).error || ''));
}

/* ========================================================================== */
section('Claim');
{
  const env = makeEnv();
  installStripe({ sessions: { cs_test_1: paidSession() } });

  const r = await claimPost({ request: post({ session: 'cs_test_1' }), env });
  const d = await r.json();
  check('a paid session yields a licence and a token',
    r.status === 200 && d.paid === true && /^MAGA-/.test(d.licence) && !!d.token);
  check('the purchase is stored against the licence',
    !!(await env.LICENCES.get('licence:' + d.licence)));

  // The webhook and the redirect both call this; a double call must not sell twice.
  const r2 = await claimPost({ request: post({ session: 'cs_test_1' }), env });
  const d2 = await r2.json();
  check('claiming the same session twice returns the same licence', d2.licence === d.licence);
  check('claiming twice does not mint a second licence',
    [...env.LICENCES.map.keys()].filter((k) => k.startsWith('licence:')).length === 1);

  installStripe({ sessions: { cs_open: { id: 'cs_open', payment_status: 'unpaid' } } });
  const r3 = await claimPost({ request: post({ session: 'cs_open' }), env });
  check('an unpaid session gets no licence', r3.status === 402);
  check('an unpaid session stores nothing',
    [...env.LICENCES.map.keys()].filter((k) => k.startsWith('licence:')).length === 1);

  const r4 = await claimPost({ request: post({ session: 'not-a-session' }), env });
  check('a made-up session id is rejected before Stripe is called', r4.status === 400);
  const r5 = await claimPost({ request: post({}), env });
  check('a missing session id is rejected', r5.status === 400);
}

/* ========================================================================== */
section('Licence check');
{
  const env = makeEnv();
  installStripe({ sessions: { cs_test_1: paidSession() } });
  const { licence, token } = await (await claimPost({ request: post({ session: 'cs_test_1' }), env })).json();

  const ok = await (await licencePost({ request: post({ token }), env })).json();
  check('a genuine token validates', ok.valid === true && ok.licence === licence);

  const forged = await (await licencePost({ request: post({ token: token.split('.')[0] + '.deadbeef' }), env })).json();
  check('a forged token is refused', forged.valid === false && forged.reason === 'signature');

  const junk = await (await licencePost({ request: post({ token: 'nonsense' }), env })).json();
  check('junk is refused', junk.valid === false);
  const empty = await (await licencePost({ request: post({}), env })).json();
  check('a missing token is refused', empty.valid === false);

  // Revocation is the only thing that makes the paywall more than a suggestion.
  await env.LICENCES.delete('licence:' + licence);
  const revoked = await (await licencePost({ request: post({ token }), env })).json();
  check('a revoked licence stops validating',
    revoked.valid === false && revoked.reason === 'revoked');

  // A token signed with a different deployment's secret must not work here.
  const other = makeEnv({ LICENCE_SECRET: 'someone-elses-secret', LICENCES: env.LICENCES });
  const crossed = await (await licencePost({ request: post({ token }), env: other })).json();
  check('a token from another deployment is refused', crossed.valid === false);
}

/* ========================================================================== */
section('Restore');
{
  const env = makeEnv();
  installStripe({ sessions: { cs_test_1: paidSession() } });
  const { licence } = await (await claimPost({ request: post({ session: 'cs_test_1' }), env })).json();

  const r = await restorePost({ request: post({ licence }), env });
  const d = await r.json();
  check('a real key restores', r.status === 200 && d.found === true && !!d.token);

  const messy = await restorePost({ request: post({ licence: licence.toLowerCase().replace(/-/g, ' ') }), env });
  check('restore forgives spacing and case', (await messy.json()).found === true);

  const missing = await restorePost({ request: post({ licence: 'MAGA-AAAA-AAAA-AAAA' }), env });
  check('an unissued key does not restore', missing.status === 404);

  const rubbish = await restorePost({ request: post({ licence: 'please' }), env });
  check('a malformed key is rejected without a store lookup', rubbish.status === 400);

  const restored = await (await restorePost({ request: post({ licence }), env })).json();
  const check2 = await (await licencePost({ request: post({ token: restored.token }), env })).json();
  check('a restored token validates on the new device', check2.valid === true);
}

/* ========================================================================== */
section('Webhook');
{
  const env = makeEnv();
  installStripe({ sessions: {} });

  const body = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: paidSession('cs_hook_1') },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = await hmacHex(env.STRIPE_WEBHOOK_SECRET, t + '.' + body);
  const signed = (s, b = body) => new Request('https://game.example/api/webhook', {
    method: 'POST', headers: { 'stripe-signature': s }, body: b,
  });

  const r = await webhookPost({ request: signed(`t=${t},v1=${sig}`), env });
  check('a correctly signed event is accepted', r.status === 200);
  check('the purchase is recorded from the webhook alone',
    [...env.LICENCES.map.keys()].some((k) => k.startsWith('licence:')));

  const r2 = await webhookPost({ request: signed(`t=${t},v1=${sig}`), env });
  check('replaying the same event does not mint a second licence',
    r2.status === 200
    && [...env.LICENCES.map.keys()].filter((k) => k.startsWith('licence:')).length === 1);

  const bad = await webhookPost({ request: signed(`t=${t},v1=${'0'.repeat(64)}`), env });
  check('a wrongly signed event is refused', bad.status === 400);

  const none = await webhookPost({ request: signed(''), env });
  check('an unsigned event is refused', none.status === 400);

  // Without the timestamp check, a captured request could be replayed forever.
  const old = t - 4000;
  const oldSig = await hmacHex(env.STRIPE_WEBHOOK_SECRET, old + '.' + body);
  const stale = await webhookPost({ request: signed(`t=${old},v1=${oldSig}`), env });
  check('a stale replay is refused', stale.status === 400);

  const future = t + 4000;
  const futureSig = await hmacHex(env.STRIPE_WEBHOOK_SECRET, future + '.' + body);
  const ahead = await webhookPost({ request: signed(`t=${future},v1=${futureSig}`), env });
  check('a far-future timestamp is refused', ahead.status === 400);

  // Tampering with the body must invalidate the signature.
  const tampered = body.replace('499', '1');
  const tam = await webhookPost({ request: signed(`t=${t},v1=${sig}`, tampered), env });
  check('an edited body is refused', tam.status === 400);

  const env2 = makeEnv({ STRIPE_WEBHOOK_SECRET: '' });
  const unconf = await webhookPost({ request: signed(`t=${t},v1=${sig}`), env: env2 });
  check('an unconfigured webhook refuses rather than trusting the caller', unconf.status === 503);

  // An unpaid session arriving by webhook must not unlock anything.
  const env3 = makeEnv();
  installStripe({ sessions: { cs_unpaid: { id: 'cs_unpaid', payment_status: 'unpaid' } } });
  const unpaidBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_unpaid', payment_status: 'unpaid' } },
  });
  const t3 = Math.floor(Date.now() / 1000);
  const sig3 = await hmacHex(env3.STRIPE_WEBHOOK_SECRET, t3 + '.' + unpaidBody);
  await webhookPost({ request: signed(`t=${t3},v1=${sig3}`, unpaidBody), env: env3 });
  check('an unpaid webhook event issues nothing',
    [...env3.LICENCES.map.keys()].filter((k) => k.startsWith('licence:')).length === 0);
}

/* ========================================================================== */
console.log('\n' + (failures.length ? `FAILED ${failures.length} of ${count}` : `PASSED ${count} checks`));
if (failures.length) {
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
