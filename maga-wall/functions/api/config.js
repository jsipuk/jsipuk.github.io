/* GET /api/config — what the game needs to know before drawing the paywall. */
import { json, hasConfig } from '../_lib.js';

const NEEDED = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'LICENCE_SECRET'];

export async function onRequestGet({ env }) {
  return json({
    // The price is a label only. The amount actually charged comes from the
    // Stripe Price object, so this can never disagree with the receipt in a way
    // that matters — but keep them in step anyway.
    price: env.PRICE_LABEL || '$4.99',
    configured: hasConfig(env, NEEDED),
    webhook: !!env.STRIPE_WEBHOOK_SECRET,
  });
}
