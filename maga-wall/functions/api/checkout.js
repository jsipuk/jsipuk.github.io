/* POST /api/checkout — start a Stripe Checkout session for the one-off unlock. */
import { json, bad, stripe, requireConfig, readJson } from '../_lib.js';

/* Query parameters worth carrying through Stripe and back.
 *
 * An allowlist rather than a pass-through: success_url is built from our own
 * origin plus these, so there is no way to smuggle a path, a second host or a
 * scheme into the redirect. `pay` is how a developer tests the live flow on
 * localhost; the rest are campaign tags that should survive a purchase. */
const KEEP = /^(pay|ref|utm_[a-z]{1,20})$/;

function carriedQuery(raw) {
  const out = new URLSearchParams();
  let params;
  try { params = new URLSearchParams(String(raw || '')); } catch { return ''; }
  for (const [k, v] of params) {
    if (out.size >= 5) break;
    if (!KEEP.test(k)) continue;
    if (!/^[\w.-]{1,64}$/.test(v)) continue;
    out.append(k, v);
  }
  const s = out.toString();
  return s.length > 200 ? '' : s;
}

export async function onRequestPost({ request, env }) {
  const gate = requireConfig(env, ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'LICENCE_SECRET']);
  if (gate) return gate;

  const origin = new URL(request.url).origin;
  const body = await readJson(request);
  const carried = carriedQuery(body && body.query);
  const back = origin + '/?' + (carried ? carried + '&' : '');
  try {
    const session = await stripe(env, 'checkout/sessions', {
      method: 'POST',
      form: {
        mode: 'payment',
        'line_items[0][price]': env.STRIPE_PRICE_ID,
        'line_items[0][quantity]': '1',
        // The browser comes back here; /api/claim then turns the session id
        // into a licence. The id is single-use and only useful once paid.
        success_url: back + 'purchase={CHECKOUT_SESSION_ID}',
        cancel_url: back + 'purchase=cancelled',
        // Needed for restore-by-receipt, and for VAT/sales-tax records.
        'automatic_tax[enabled]': env.AUTOMATIC_TAX === 'true' ? 'true' : 'false',
        allow_promotion_codes: 'true',
      },
    });
    return json({ url: session.url });
  } catch (e) {
    return bad(e.message || 'Could not start checkout.', 502);
  }
}
