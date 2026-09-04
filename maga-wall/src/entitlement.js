/* Purchase entitlement.
 *
 * ============================ READ THIS FIRST =============================
 * NOTHING HERE TAKES MONEY. There is no payment provider wired up, and the
 * unlock this module grants is a flag in localStorage that any user can set
 * themselves with the developer console. That is fine for a demo and is NOT
 * fine for a paid release.
 *
 * To actually sell this you need, at minimum:
 *   1. A merchant account and a provider SDK (Stripe Checkout, Paddle, RevenueCat
 *      for the store-wrapped builds, ...). Those need production credentials
 *      that must not live in this repository.
 *   2. A server that creates the checkout session and, on the provider's
 *      webhook, records the purchase against an account or a licence key.
 *   3. A verification call on boot that asks that server whether this user has
 *      paid — client-side state must never be the source of truth.
 *   4. Restore-purchase backed by the same server, keyed on something the user
 *      can present on a new device (account login, or an emailed licence key).
 *   5. Consumer-law copy: price, what is being sold, refund and cancellation
 *      rights, terms, privacy. UK/EU distance-selling rules apply.
 * ==========================================================================
 *
 * The point of this file is the SHAPE. The game asks `ent.isUnlocked()` and
 * nothing else; swapping the provider is a one-line change in createEntitlement.
 */

import { TRIAL_RUNS } from './config.js';

const K_ENT = 'magawall.entitlement.v1';

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A provider is: an id, a display price, and two async methods.
 * purchase() resolves to true when the user is now entitled.
 * restore() resolves to true when a previous purchase was found.
 */

/** Local-only unlock. For development and for demo builds. */
export const devProvider = {
  id: 'dev',
  label: 'DEV UNLOCK',
  price: 'FREE',
  production: false,
  async purchase() { return true; },
  async restore() { return false; },
};

/**
 * The shape a real integration would take. Left deliberately unimplemented so
 * that nobody can mistake it for a working till.
 */
export function stripeProvider({ checkoutUrl, verifyUrl } = {}) {
  return {
    id: 'stripe',
    label: 'BUY',
    price: '',                 // must come from the provider, never hard-coded
    production: false,
    configured: !!(checkoutUrl && verifyUrl),
    async purchase() {
      throw new Error(
        'Stripe is not configured. Needs a checkout URL, a webhook-backed '
        + 'server to record the purchase, and a verify endpoint.',
      );
    },
    async restore() {
      throw new Error('Restore needs the same server-side purchase record.');
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

function readStore() {
  try {
    const raw = localStorage.getItem(K_ENT);
    if (!raw) return { unlocked: false, provider: null, at: 0 };
    const v = JSON.parse(raw);
    return {
      unlocked: v.unlocked === true,
      provider: typeof v.provider === 'string' ? v.provider : null,
      at: Number(v.at) || 0,
    };
  } catch {
    return { unlocked: false, provider: null, at: 0 };
  }
}

function writeStore(v) {
  try { localStorage.setItem(K_ENT, JSON.stringify(v)); return true; } catch { return false; }
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} opts
 * @param {object} opts.provider one of the providers above
 * @param {() => number} opts.runsPlayed how many runs this device has started
 */
export function createEntitlement({ provider = devProvider, runsPlayed = () => 0 } = {}) {
  let store = readStore();

  const isUnlocked = () => store.unlocked;

  /** Runs left in the free trial. 0 means the paywall is due. */
  const trialLeft = () => Math.max(0, TRIAL_RUNS - runsPlayed());

  /** The one question the game actually asks before letting a run start. */
  const canPlay = () => isUnlocked() || trialLeft() > 0;

  async function purchase() {
    const ok = await provider.purchase();
    if (ok) {
      store = { unlocked: true, provider: provider.id, at: Date.now() };
      writeStore(store);
    }
    return ok;
  }

  async function restore() {
    const ok = await provider.restore();
    if (ok) {
      store = { unlocked: true, provider: provider.id, at: Date.now() };
      writeStore(store);
    }
    return ok;
  }

  /** Development affordance, exposed on the paywall screen only in dev mode. */
  function revoke() {
    store = { unlocked: false, provider: null, at: 0 };
    writeStore(store);
  }

  return {
    provider,
    isUnlocked,
    trialLeft,
    canPlay,
    purchase,
    restore,
    revoke,
    get state() { return { ...store }; },
  };
}

/** Dev mode when served from localhost / a file, or with ?dev=1 in the URL. */
export function isDevEnvironment() {
  try {
    const h = location.hostname;
    if (new URLSearchParams(location.search).has('dev')) return true;
    return h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:';
  } catch {
    return true;
  }
}
