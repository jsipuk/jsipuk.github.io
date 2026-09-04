/* Purchase entitlement.
 *
 * The game asks this module exactly one question — `canPlay()` — and knows
 * nothing about Stripe, licences or tokens. Everything below the provider
 * interface can be swapped without touching a line of game code.
 *
 * HOW THE REAL ONE WORKS
 *
 *   1. UNLOCK  -> POST /api/checkout, then hand the browser to Stripe Checkout.
 *   2. Stripe redirects back to /?purchase=<session_id>.
 *   3. POST /api/claim exchanges that for a licence key and a signed token.
 *      The token is an HMAC minted on the edge; the browser never sees the key
 *      that signs it, so it cannot forge one.
 *   4. On every online boot the token is re-checked at /api/licence. If the
 *      edge says it is invalid, the game locks itself again.
 *
 * WHAT THIS DOES NOT DO, said plainly: offline, the game trusts its cached
 * token. It has to — a PWA that locks you out on a train is a worse product
 * than one that can be cheated by somebody willing to edit localStorage. A
 * determined person can always unlock a client-side game. This design makes
 * casual copying pointless and keeps the edge as the source of truth whenever
 * it can be reached, which is the right trade for a $4.99 arcade game.
 */

import { TRIAL_RUNS } from './config.js';

const K_ENT = 'magawall.entitlement.v1';

/* -------------------------------------------------------------------------- */
/* Store — deliberately separate from scores and settings                     */
/* -------------------------------------------------------------------------- */

const BLANK = { unlocked: false, provider: null, token: null, licence: null, at: 0 };

function readStore() {
  try {
    const raw = localStorage.getItem(K_ENT);
    if (!raw) return { ...BLANK };
    const v = JSON.parse(raw);
    return {
      unlocked: v.unlocked === true,
      provider: typeof v.provider === 'string' ? v.provider : null,
      token: typeof v.token === 'string' ? v.token : null,
      licence: typeof v.licence === 'string' ? v.licence : null,
      at: Number(v.at) || 0,
    };
  } catch {
    return { ...BLANK };
  }
}

function writeStore(v) {
  try { localStorage.setItem(K_ENT, JSON.stringify(v)); return true; } catch { return false; }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  let data = null;
  try { data = await res.json(); } catch { /* an HTML error page, most likely */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

/** Local-only unlock, for development and for offline demo builds. */
export const devProvider = {
  id: 'dev',
  label: 'DEV UNLOCK',
  production: false,
  async price() { return 'FREE'; },
  async purchase() { return { unlocked: true }; },
  async restore() { return { unlocked: false, message: 'Dev builds have nothing to restore.' }; },
  async revalidate() { return 'unknown'; },
};

/**
 * Stripe Checkout via the Pages Functions in /functions/api.
 * Nothing here holds a Stripe key; the browser only ever talks to our own origin.
 */
export const stripeProvider = {
  id: 'stripe',
  label: 'UNLOCK',
  production: true,

  async price() {
    const r = await api('/api/config');
    if (!r.ok) return null;
    return r.data.configured ? (r.data.price || null) : null;
  },

  /** Resolves by navigating away, or throws with something worth showing. */
  async purchase() {
    // Carry our own query through Stripe so campaign tags, and the dev
    // ?pay=live override, survive the round trip.
    const r = await api('/api/checkout', { query: location.search.replace(/^\?/, '') });
    if (!r.ok || !r.data.url) {
      throw new Error(r.data.error || 'Could not reach the payment service.');
    }
    location.href = r.data.url;
    // Navigation has been asked for; keep the button busy until it happens.
    return { unlocked: false, pending: true };
  },

  async restore(licence) {
    const r = await api('/api/restore', { licence });
    if (r.status === 404) return { unlocked: false, message: 'No purchase found for that key.' };
    if (!r.ok || !r.data.token) {
      return { unlocked: false, message: r.data.error || 'Could not check that key.' };
    }
    return { unlocked: true, token: r.data.token, licence: r.data.licence };
  },

  /**
   * @returns {'valid'|'invalid'|'unknown'} — 'unknown' when we simply could not
   * ask, which must never lock a paying customer out.
   */
  async revalidate(token) {
    try {
      const r = await api('/api/licence', { token });
      if (!r.ok) return 'unknown';
      return r.data.valid ? 'valid' : 'invalid';
    } catch {
      return 'unknown';
    }
  },

  /** Redeem the ?purchase=<session_id> Stripe sends us back with. */
  async claim(session) {
    const r = await api('/api/claim', { session });
    if (!r.ok || !r.data.token) {
      throw new Error(r.data.error || 'Payment went through but the unlock failed. Use Restore with your licence key, or contact support.');
    }
    return { unlocked: true, token: r.data.token, licence: r.data.licence };
  },
};

/* -------------------------------------------------------------------------- */

/**
 * @param {object} opts
 * @param {object} opts.provider one of the providers above
 * @param {() => number} opts.runsPlayed runs this device has started
 */
export function createEntitlement({ provider = devProvider, runsPlayed = () => 0 } = {}) {
  let store = readStore();
  let priceLabel = null;

  const isUnlocked = () => store.unlocked;
  const trialLeft = () => Math.max(0, TRIAL_RUNS - runsPlayed());
  const canPlay = () => isUnlocked() || trialLeft() > 0;

  function grant(result) {
    store = {
      unlocked: true,
      provider: provider.id,
      token: result.token || null,
      licence: result.licence || null,
      at: Date.now(),
    };
    writeStore(store);
  }

  function revoke() {
    store = { ...BLANK };
    writeStore(store);
  }

  async function purchase() {
    const result = await provider.purchase();
    if (result && result.unlocked) grant(result);
    return result;
  }

  async function restore(licence) {
    const result = await provider.restore(licence);
    if (result && result.unlocked) grant(result);
    return result;
  }

  /** Look up the price for the paywall. Cached; null when unconfigured. */
  async function price() {
    if (priceLabel !== null) return priceLabel;
    try { priceLabel = await provider.price(); } catch { priceLabel = null; }
    return priceLabel;
  }

  /**
   * Called once on boot. Redeems a fresh Stripe redirect if there is one, then
   * re-checks any stored token against the edge.
   * @returns {Promise<{claimed?: boolean, licence?: string, error?: string}>}
   */
  async function sync(searchParams) {
    const out = {};
    const purchaseParam = searchParams && searchParams.get('purchase');

    if (purchaseParam && purchaseParam.startsWith('cs_') && provider.claim) {
      try {
        const result = await provider.claim(purchaseParam);
        grant(result);
        out.claimed = true;
        out.licence = result.licence;
      } catch (e) {
        out.error = e && e.message ? e.message : 'Unlock failed.';
      }
    }

    if (store.unlocked && store.token && provider.revalidate) {
      const verdict = await provider.revalidate(store.token);
      // Only a definite 'invalid' revokes. 'unknown' means we could not ask.
      if (verdict === 'invalid') { revoke(); out.revoked = true; }
    }
    return out;
  }

  return {
    provider,
    isUnlocked,
    trialLeft,
    canPlay,
    purchase,
    restore,
    price,
    sync,
    revoke,
    get licence() { return store.licence; },
    get state() { return { ...store }; },
  };
}

/* -------------------------------------------------------------------------- */
/* Which provider to use                                                      */
/* -------------------------------------------------------------------------- */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

/**
 * Is this a development machine?
 *
 * Deliberately NOT influenced by anything in the query string. An earlier
 * version honoured ?dev=1 anywhere, which meant a player could append it to the
 * live site and be handed the free local unlock. Where the game is running is a
 * fact about the deployment; the URL is user input.
 */
export function isLocalHost() {
  try {
    if (location.protocol === 'file:') return true;
    const h = location.hostname;
    if (LOCAL_HOSTS.has(h)) return true;
    if (h.endsWith('.local') || h.endsWith('.localhost')) return true;
    // Private ranges, so the game can be tested on a real phone over the LAN.
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    return false;
  } catch {
    return false;   // if we cannot tell, assume production and charge for it
  }
}

export const isDevEnvironment = isLocalHost;

/**
 * ?pay=live runs the real Stripe path on a dev machine, for testing checkout
 * against Stripe's test keys. It can only ever make the game harder to unlock,
 * so it is safe to honour from the URL.
 */
export function forceLivePayments() {
  try { return new URLSearchParams(location.search).get('pay') === 'live'; } catch { return false; }
}

/** The provider this deployment should use. */
export function pickProvider() {
  return (isLocalHost() && !forceLivePayments()) ? devProvider : stripeProvider;
}
