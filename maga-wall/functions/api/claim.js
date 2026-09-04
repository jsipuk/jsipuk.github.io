/* POST /api/claim — exchange a finished Checkout session for a licence.
 *
 * Called by the game when Stripe redirects back with ?purchase=<session_id>.
 * The session id is not a secret worth much: it is only exchangeable once the
 * payment actually shows as paid, and the exchange is idempotent.
 */
import { json, bad, stripe, mintToken, recordPurchase, requireConfig, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const gate = requireConfig(env, ['STRIPE_SECRET_KEY', 'LICENCE_SECRET']);
  if (gate) return gate;

  const body = await readJson(request);
  const id = body && typeof body.session === 'string' ? body.session : null;
  if (!id || !id.startsWith('cs_')) return bad('Missing checkout session.');

  let session;
  try {
    session = await stripe(env, 'checkout/sessions/' + encodeURIComponent(id));
  } catch (e) {
    return bad(e.message || 'Could not read the checkout session.', 502);
  }

  if (session.payment_status !== 'paid') {
    return json({ paid: false, status: session.payment_status }, 402);
  }

  const licence = await recordPurchase(env, session);
  return json({
    paid: true,
    licence,
    token: await mintToken(env.LICENCE_SECRET, licence),
  });
}
