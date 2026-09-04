/* POST /api/restore — unlock a second device from the licence key.
 *
 * Key-based rather than email-based on purpose. An email lookup would unlock the
 * game for anyone who can guess a buyer's address; a 12-character key from a
 * 28-letter unambiguous alphabet is 28^12, which is not guessable. The cost is
 * that the buyer has to keep the key, so it is shown on the success screen and
 * needs to reach their receipt too (see DEPLOY.md).
 */
import { json, bad, normaliseLicence, mintToken, kLicence, requireConfig, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const gate = requireConfig(env, ['LICENCE_SECRET']);
  if (gate) return gate;

  const body = await readJson(request);
  const licence = normaliseLicence(body && body.licence);
  if (!licence) return bad('That does not look like a licence key.');

  const record = await env.LICENCES.get(kLicence(licence));
  if (!record) return json({ found: false }, 404);

  return json({
    found: true,
    licence,
    token: await mintToken(env.LICENCE_SECRET, licence),
  });
}
