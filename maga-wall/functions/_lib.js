/* Shared helpers for the Cloudflare Pages Functions that sell the game.
 *
 * These run on Cloudflare's edge, not in the browser. There is no Stripe SDK
 * here on purpose: the Workers runtime has fetch and WebCrypto, and the three
 * Stripe REST calls this needs are short enough that pulling in a Node-shaped
 * SDK would cost more than it saves.
 *
 * THE TRUST MODEL, stated plainly:
 *
 *   Stripe tells us a payment succeeded. We mint a licence key, store it, and
 *   hand the browser a token that is an HMAC over that key. The browser cannot
 *   forge a token because it never sees LICENCE_SECRET. On every online boot the
 *   game re-checks its token with /api/licence and drops it if we say no.
 *
 *   Offline, the game trusts its cached token, because a PWA that locks you out
 *   on a train is a worse product than one that can be cheated by someone
 *   willing to edit localStorage. That is a deliberate trade, not an oversight.
 *   Nothing on the client is ever the source of truth when we can reach the edge.
 */

const enc = new TextEncoder();

/* ---- JSON plumbing -------------------------------------------------------- */

export const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  },
});

export const bad = (message, status = 400) => json({ error: message }, status);

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

/* ---- HMAC ----------------------------------------------------------------- */

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
}

export async function hmacHex(secret, message) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Length-independent comparison, so a wrong guess leaks no timing signal. */
export function safeEqual(a, b) {
  const A = enc.encode(String(a));
  const B = enc.encode(String(b));
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] || 0) ^ (B[i] || 0);
  return diff === 0;
}

/* ---- Licence keys and tokens ---------------------------------------------- */

const ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ2346789';   // no O/0, I/1, L, S/5, B/8 confusion

/** MAGA-XXXX-XXXX-XXXX. Typed by a human on a phone, so ambiguity is removed. */
export function makeLicence() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = 'MAGA';
  for (let i = 0; i < 12; i++) {
    if (i % 4 === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Accept whatever the user typed: any case, any separator, or none at all. */
export function normaliseLicence(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw.startsWith('MAGA') || raw.length !== 16) return null;
  return 'MAGA-' + raw.slice(4, 8) + '-' + raw.slice(8, 12) + '-' + raw.slice(12, 16);
}

export async function mintToken(secret, licence) {
  const payload = JSON.stringify({ k: licence, v: 1, iat: Math.floor(Date.now() / 1000) });
  const body = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return body + '.' + await hmacHex(secret, body);
}

/**
 * @returns {{licence: string}|null} the payload if the signature checks out.
 */
export async function readToken(secret, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!safeEqual(sig, await hmacHex(secret, body))) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || typeof payload.k !== 'string') return null;
    return { licence: payload.k };
  } catch {
    return null;
  }
}

/* ---- Stripe --------------------------------------------------------------- */

export async function stripe(env, path, { method = 'GET', form } = {}) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: {
      authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'content-type': 'application/x-www-form-urlencoded',
      'stripe-version': '2024-06-20',
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ('Stripe returned ' + res.status);
    throw new Error(msg);
  }
  return data;
}

/* ---- Store ---------------------------------------------------------------- */

export const kLicence = (licence) => 'licence:' + licence;
export const kSession = (id) => 'session:' + id;

/**
 * Record a paid purchase, once. Both the success redirect and the webhook call
 * this, and either may arrive first, so it has to be idempotent: the session
 * key is what makes a double call return the same licence instead of a second one.
 */
export async function recordPurchase(env, session) {
  const existing = await env.LICENCES.get(kSession(session.id));
  if (existing) return existing;

  const licence = makeLicence();
  const record = {
    licence,
    session: session.id,
    email: (session.customer_details && session.customer_details.email) || null,
    amount: session.amount_total,
    currency: session.currency,
    at: new Date().toISOString(),
  };
  await env.LICENCES.put(kLicence(licence), JSON.stringify(record));
  await env.LICENCES.put(kSession(session.id), licence);
  return licence;
}

/* ---- Configuration guard --------------------------------------------------- */

/**
 * Every endpoint calls this first. A half-configured deployment must fail loudly
 * with a message the game can show, not 500 into a blank screen.
 */
export function requireConfig(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    return json({
      error: 'Payments are not configured on this deployment.',
      missing,
    }, 503);
  }
  return null;
}

export const hasConfig = (env, keys) => keys.every((k) => !!env[k]);
