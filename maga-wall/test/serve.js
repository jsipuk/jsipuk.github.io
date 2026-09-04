/* Local dev server: serves public/ and mounts functions/api/ the way
 * Cloudflare Pages does, so the whole purchase flow can be exercised without
 * deploying and without a Stripe account.
 *
 *   node test/serve.js                 # game only; payments report unconfigured
 *   node test/serve.js --fake-stripe   # full purchase flow against a fake Stripe
 *
 * `wrangler pages dev public` is the real thing and should be used before
 * shipping; this exists so the flow is testable in CI and offline.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8100);
const FAKE = process.argv.includes('--fake-stripe');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

/* ---- A fake Stripe, so the flow is testable with no account --------------- */

const fakeSessions = new Map();
if (FAKE) {
  let n = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.stripe.com/')) return realFetch(url, init);
    if (u.endsWith('/v1/checkout/sessions') && init.method === 'POST') {
      const body = new URLSearchParams(init.body);
      const id = 'cs_test_fake' + (++n);
      fakeSessions.set(id, {
        id, payment_status: 'paid', amount_total: 499, currency: 'usd',
        customer_details: { email: 'buyer@example.com' },
      });
      // Skip the hosted page: bounce straight back to the success URL.
      const back = body.get('success_url').replace('{CHECKOUT_SESSION_ID}', id);
      return new Response(JSON.stringify({ id, url: back }), { status: 200 });
    }
    const m = /\/v1\/checkout\/sessions\/([^/?]+)$/.exec(u);
    if (m) {
      const s = fakeSessions.get(decodeURIComponent(m[1]));
      return new Response(JSON.stringify(s || { error: { message: 'No such session' } }),
        { status: s ? 200 : 404 });
    }
    return new Response('{}', { status: 404 });
  };
}

/* ---- An in-memory stand-in for the KV namespace --------------------------- */

const store = new Map();
const env = {
  STRIPE_SECRET_KEY: FAKE ? 'sk_test_fake' : '',
  STRIPE_PRICE_ID: FAKE ? 'price_fake' : '',
  STRIPE_WEBHOOK_SECRET: FAKE ? 'whsec_fake' : '',
  LICENCE_SECRET: 'local-dev-secret',
  PRICE_LABEL: '$4.99',
  LICENCES: {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  },
};

/* ---- Routing --------------------------------------------------------------- */

async function handleApi(req, url, bodyText) {
  const name = url.pathname.replace(/^\/api\//, '');
  if (!/^[a-z]+$/.test(name)) return new Response('Not found', { status: 404 });
  let mod;
  try { mod = await import('../functions/api/' + name + '.js'); }
  catch { return new Response('Not found', { status: 404 }); }

  const handler = req.method === 'GET' ? mod.onRequestGet : mod.onRequestPost;
  if (!handler) return new Response('Method not allowed', { status: 405 });

  const request = new Request(url.href, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' ? undefined : bodyText,
  });
  return handler({ request, env, params: {} });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost:' + PORT));

  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    try {
      const out = await handleApi(req, url, bodyText);
      const buf = Buffer.from(await out.arrayBuffer());
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(buf);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }

  // Static, with traversal refused rather than sanitised.
  let rel = normalize(decodeURIComponent(url.pathname));
  if (rel.includes('..')) { res.writeHead(403); res.end('No'); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = join(PUB, rel);
  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error('dir');
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${PORT}/  ${FAKE ? '(fake Stripe: checkout auto-succeeds)' : '(payments unconfigured)'}`);
});
