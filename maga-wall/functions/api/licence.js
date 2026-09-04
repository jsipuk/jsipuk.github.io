/* POST /api/licence — is this stored token still good?
 *
 * The game asks on every online boot. A signature-valid token whose licence has
 * been deleted (refund, chargeback, abuse) comes back invalid, and the game
 * revokes itself. This is the only thing that makes the paywall more than a
 * suggestion, so it must distinguish "definitely not valid" from "could not
 * ask" — the client keeps playing on the latter.
 */
import { json, readToken, kLicence, requireConfig, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const gate = requireConfig(env, ['LICENCE_SECRET']);
  if (gate) return gate;

  const body = await readJson(request);
  const payload = await readToken(env.LICENCE_SECRET, body && body.token);
  if (!payload) return json({ valid: false, reason: 'signature' });

  const record = await env.LICENCES.get(kLicence(payload.licence));
  if (!record) return json({ valid: false, reason: 'revoked' });

  return json({ valid: true, licence: payload.licence });
}
