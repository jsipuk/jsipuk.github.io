# Deploying Build The MAGA Wall

Cloudflare Pages for the game, Cloudflare Pages Functions for the $4.99 unlock,
Stripe for the money. One deploy, one origin, no CORS, no separate server.

Free tier covers all of it comfortably: Pages is unlimited static requests,
Functions gives 100,000 requests/day, KV gives 100,000 reads and 1,000 writes a
day. A write only happens when somebody buys.

---

## 0. What you need first

- A Cloudflare account (free).
- A Stripe account with payouts enabled — this takes ID verification and bank
  details, so start it before you need it.
- A domain, if you want one. Optional; Pages gives you `something.pages.dev`.

**Nothing below is done for you.** No keys exist in this repository, and the game
deliberately refuses to sell anything until they do.

---

## 1. Stripe: create the product

In the Stripe dashboard, **test mode** first (toggle top right).

1. **Product catalogue → Add product.**
   - Name: `Build The MAGA Wall`
   - Price: `4.99`, currency of your choice, **One off** (not recurring).
2. Copy the **price ID**. It looks like `price_1QabcdEFGH...`. Not the product
   ID — the price ID.
3. **Developers → API keys →** copy the **secret key** (`sk_test_...`).

Keep both. You will paste them into Cloudflare, never into this repo.

---

## 2. Cloudflare Pages: create the site

**Workers & Pages → Create → Pages → Connect to Git**, pick the repository, then:

| Setting | Value |
|---|---|
| Production branch | your main branch |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `public` |
| Root directory | `maga-wall` |

There is no build step. The `public` folder is the site exactly as it is served.

Cloudflare picks up `maga-wall/functions/` automatically and mounts it at
`/api/*`. You do not configure that anywhere.

Deploy. You should get a working game at `https://<project>.pages.dev` with the
paywall saying payments are not configured yet. That is correct — carry on.

---

## 3. KV: somewhere to keep the licences

**Workers & Pages → KV → Create namespace**, call it `magawall-licences`.

Then in your Pages project: **Settings → Functions → KV namespace bindings →
Add binding** for **both** Production and Preview:

| Variable name | KV namespace |
|---|---|
| `LICENCES` | `magawall-licences` |

The variable name must be exactly `LICENCES`. The code looks for `env.LICENCES`.

---

## 4. Environment variables

**Settings → Environment variables.** Add these to **Production**. Mark the
first three as **Secret** (click Encrypt) so they cannot be read back.

| Name | Value | Secret? |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...`, later `sk_live_...` | Yes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 5 | Yes |
| `LICENCE_SECRET` | a long random string you generate | Yes |
| `STRIPE_PRICE_ID` | `price_...` | No |
| `PRICE_LABEL` | `$4.99` | No |
| `AUTOMATIC_TAX` | `true` or `false` — see step 7 | No |

Generate `LICENCE_SECRET` with something like:

```
openssl rand -base64 48
```

**Every licence ever issued is signed with `LICENCE_SECRET`. Change it and every
customer is locked out.** Set it once, save it in a password manager, leave it
alone.

Redeploy after adding variables — Pages does not apply them to an existing build.

---

## 5. The Stripe webhook

Belt and braces: the game mints the licence when the buyer lands back on the
success page, and this makes sure the purchase is recorded even if they close the
tab mid-redirect.

**Stripe → Developers → Webhooks → Add endpoint:**

- URL: `https://<your-site>/api/webhook`
- Events: `checkout.session.completed`

Copy the **signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` and
redeploy.

The endpoint verifies the signature and rejects anything older than five
minutes, so a captured request cannot be replayed.

---

## 6. Test it before you go live

With **test keys** still in place, open the game, spend the three free rounds,
and buy. Use Stripe's test card:

```
4242 4242 4242 4242   any future expiry   any CVC   any postcode
```

Check all of this:

- [ ] You land back on the game and it says **WALL UNLOCKED** with a licence key.
- [ ] The key is `MAGA-XXXX-XXXX-XXXX` and also appears on the Settings screen.
- [ ] Reloading keeps it unlocked.
- [ ] **Stripe → Payments** shows the £/$4.99 payment.
- [ ] **Cloudflare → KV → magawall-licences** has a `licence:MAGA-...` entry.
- [ ] On a second device (or a private window), **ALREADY PAID?** with that key
      unlocks the game.
- [ ] A made-up key does not.

Locally, without any Stripe account at all:

```
cd maga-wall
node test/serve.js --fake-stripe
# then open http://127.0.0.1:8100/?pay=live
```

`?pay=live` forces the real payment path on a development machine, where the
game would otherwise use its free local unlock. The fake Stripe skips the hosted
page and bounces straight back as if you had paid.

---

## 7. Going live

1. Stripe: flip out of test mode, redo the product, take the **live** price ID
   and **live** secret key.
2. Add a **live** webhook endpoint; its signing secret is different.
3. Update the three Cloudflare variables. Redeploy.
4. Buy it once yourself with a real card, then refund yourself in Stripe.

**Tax.** If you set `AUTOMATIC_TAX=true` you must first enable Stripe Tax and
register in the jurisdictions where you owe it. Selling a digital game to
consumers in the UK and EU means VAT is due in the buyer's country from the
first sale — there is no threshold for cross-border digital sales. Talk to an
accountant before switching it on; leaving it `false` does not make the
liability go away, it just means Stripe is not calculating it for you.

**Consumer law.** Before taking real money you need, on the site:

- the price including tax, and what exactly is being sold;
- terms of sale and a privacy notice;
- refund and cancellation rights. In the UK/EU digital goods normally carry a
  14-day right to cancel, which the buyer waives on immediate download — you
  must ask for that waiver explicitly at checkout;
- a business contact address.

Stripe Checkout can collect terms acceptance for you: turn on **Terms of service
agreement** in the Checkout settings and give it your URLs. **None of this is
implemented in the game.** It is a legal requirement, not a feature.

---

## 8. Running it

**Refunds.** Refund in Stripe as normal. That does *not* revoke the licence —
deliberately, so a partial refund cannot brick a paying customer. To actually
revoke: delete the `licence:MAGA-...` key from the KV namespace. The game
re-checks on every online boot and will lock itself within one launch.

**A customer lost their key.** Find their payment in Stripe, take the checkout
session id, look up `session:cs_...` in KV — the value is their licence key.

**Changing the price.** Make a new Price in Stripe, update `STRIPE_PRICE_ID` and
`PRICE_LABEL`, redeploy. Existing licences are unaffected.

**Shipping a game update.** Bump `VERSION` in `public/sw.js`, or returning
players keep the old build from their service-worker cache. This is the single
easiest thing to forget.

---

## 9. Honest limits

- **Offline, the game trusts its cached token.** It has to; a PWA that locks you
  out on a train is worse than one that can be cheated by someone willing to
  edit `localStorage`. Any client-side game can be unlocked by a determined
  person. This makes casual copying pointless and keeps the edge authoritative
  whenever it can be reached.
- **A licence key can be shared.** There is no device limit and no account
  system. Adding one means adding logins, which for a $4.99 parody game costs
  more in support than it saves in piracy.
- **The key must reach the buyer.** It is shown after purchase and on the
  Settings screen, but it is **not** emailed — that needs a mail provider
  (Resend, Postmark, MailChannels) wired into the webhook. Until then, a buyer
  who clears their browser data and loses the key needs you to look it up in KV.
  Worth doing before any real volume.
- **No analytics, no accounts, no tracking.** Scores and settings never leave
  the device.
