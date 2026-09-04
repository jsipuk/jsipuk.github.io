/* POST /api/webhook — Stripe's own word that the payment completed.
 *
 * Belt and braces. /api/claim already mints the licence when the buyer lands
 * back on the success URL, but they might close the tab mid-redirect. This makes
 * sure the purchase is recorded regardless, so restore-by-key still works.
 */
import { json, bad, hmacHex, safeEqual, recordPurchase, stripe } from '../_lib.js';

/** Reject replays of an old, captured request. */
const TOLERANCE_SECONDS = 300;

async function verify(env, signature, payload) {
  const parts = Object.fromEntries(
    String(signature || '').split(',').map((p) => p.split('=')).filter((p) => p.length === 2),
  );
  if (!parts.t || !parts.v1) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, parts.t + '.' + payload);
  return safeEqual(parts.v1, expected);
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.LICENCE_SECRET) {
    return json({ error: 'Webhook is not configured.' }, 503);
  }

  const payload = await request.text();
  if (!await verify(env, request.headers.get('stripe-signature'), payload)) {
    return bad('Bad signature.', 400);
  }

  let event;
  try { event = JSON.parse(payload); } catch { return bad('Bad payload.'); }

  if (event.type === 'checkout.session.completed') {
    let session = event.data.object;
    // The event body can predate the payment settling; re-read the truth.
    if (session.payment_status !== 'paid' && env.STRIPE_SECRET_KEY) {
      try { session = await stripe(env, 'checkout/sessions/' + encodeURIComponent(session.id)); }
      catch { /* fall through with what the event gave us */ }
    }
    if (session.payment_status === 'paid') await recordPurchase(env, session);
  }

  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    // Revoking is a deliberate manual step, not an automatic one: a partial
    // refund or an unresolved dispute should not silently brick a paying
    // customer's game. DEPLOY.md documents how to revoke a key by hand.
    return json({ received: true, note: 'refund noted; revoke manually if intended' });
  }

  return json({ received: true });
}
