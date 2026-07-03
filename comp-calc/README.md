# Commission Calculator

A small, personal calculator for estimating sales commission on a deal.
Save your compensation-plan assumptions once, then enter a deal's value and
see estimated gross and net commission with a full breakdown. Supports
three deal types — New Business, Renewal, and Out-Year New Business —
since they're commonly paid at different rates.

**Currency:** deal values (ACV, TCV, quota, attainment) are entered and
shown in **USD $** — that's the currency deals are quoted in. Commission
payouts (gross, net, deductions) are calculated and shown in **GBP £** —
that's this plan's actual rate structure (a dollar deal value times a
percentage rate produces a pound commission figure), not a live currency
conversion. No FX conversion happens anywhere in the code — see
`formatUSD`/`formatGBP2` in [`app.js`](./app.js), which are kept
deliberately separate so a dollar figure can never accidentally get a £
sign or vice versa.

The large dollar fields (quota, attainment, ACV, out-year lines) add
thousands separators live as you type — e.g. typing `1000000` shows
`1,000,000`. Commas are stripped back out before any maths runs
(`parseFormattedNumber` in `app.js`); the underlying number is unaffected.

It's a **static, no-build web app** (plain HTML + CSS + vanilla JavaScript),
so it drops straight into this GitHub Pages site with zero tooling.

## Run locally

It's just static files — open `index.html` directly, or serve the folder:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000/comp-calc/
```

## Updating your commission assumptions

Everything under **Compensation plan** is editable and saved to this
browser's `localStorage` (key `comp-calc:plan`) when you click
**Save plan** — nothing is sent over the network. It survives refreshes and
comes back next time you open the page on the same browser/device.

- **Annual quota** — your New Business ACV target for the period.
- **Attainment already booked this period** — New Business ACV already
  closed before this deal, so the calculator knows which tier band(s) this
  deal's value falls into.
- **Base Commission Rate — BCR (%)** — the base rate applied to New
  Business ACV inside each achievement tier below, and used as the base
  rate for Out-Year New Business.
- **TCV credit (%)** — how much of the value *beyond* year one (i.e.
  `TCV − ACV`) counts toward New Business commission. Set to `0` if your
  plan only pays on ACV; set to `100` if it pays on full TCV.
- **Average deductions / tax (%)** — used to turn gross commission into an
  estimated net figure. Defaults to **49%**, fully editable.
- **Renewal rate (%)** — a flat rate applied to Renewal ACV, no tiers or
  acceleration. Defaults to **0.4253%**.
- **Out-Year New Business multiplier** — applied to BCR (not tiered) for
  Out-Year New Business ACV, representing commission paid annually in each
  year after the first on a multi-year deal.
- **New Business achievement tiers** — one row per band: "From attainment
  (%)" is the quota-attainment threshold (must include a `0%` row as the
  floor), and "Multiplier" is applied to New Business ACV *within* that
  band only (see "How the maths works" below). Add or remove rows with
  **+ Add tier** / the **×** button.

Click **Reset to defaults** to restore the starting values shown below and
overwrite the saved plan.

### Starting defaults

The calculator ships pre-loaded with a real six-tier New Business
compensation structure rather than arbitrary placeholders, so it's usable
immediately:

| Tier | Attainment band | Multiplier |
| --- | --- | --- |
| 1 | 0–50% | 0.90× |
| 2 | 50–100% | 1.10× |
| 3 | 100–150% | 1.50× |
| 4 | 150–200% | 2.00× |
| 5 | 200–300% | 1.25× |
| 6 | 300%+ | 1.00× |

...with a $1,700,000 quota, a 2.2402% BCR, a 0.4253% Renewal rate, and a
0.25× Out-Year New Business multiplier. Every one of these is editable —
they're just a sensible, non-empty starting point.

## Calculating a deal

1. Choose the **Deal type**: New Business, Renewal, or Out-Year New
   Business. The ACV field's label and whether the out-year section is
   shown update automatically.
2. Enter the deal's ACV. For New Business, optionally click **+ Add line**
   once per future contract year to build up TCV instead of typing one
   lump number — e.g. ACV `$100,000` + one out-year line of `$200,000`
   gives a **Total TCV** of `$300,000`, shown live as you type. Remove a
   line with its **×** button.
3. Click **Calculate**.
4. Read the **Gross commission** and **Net commission** cards — this is
   Year 1, the New Business ACV commission. If you added any out-year
   lines, a **Commission by year** panel also appears: Year 1 is the same
   ACV figure, and Year 2, Year 3, etc. are each out-year line priced at
   the Out-Year New Business rate (BCR × OY multiplier) — the same
   calculation as the standalone Out-Year New Business deal type, just
   applied per line automatically, plus a total across all years.
5. Expand **Calculation breakdown** to see every step of the Year 1 maths.

The plan panel doesn't need to be re-saved before calculating — Calculate
always uses whatever is currently in the plan fields, so you can try
"what if my quota were higher" without committing it first. Click **Save
plan** when you want to keep changes for next time.

## How the maths works

All logic lives in [`calc.js`](./calc.js), kept deliberately separate from
the DOM/UI code in [`app.js`](./app.js) so the formulas are easy to read,
change, and test in isolation. Each deal type is calculated differently:

### New Business — graduated (cumulative) tiers

Commission builds up progressively as attainment climbs each band, like a
tax bracket — **not** a cliff where the whole deal jumps to one rate. A
deal that straddles a tier boundary earns a blend of both tiers' rates on
the portion of its value that falls in each one.

```
tcvUplift            = max(TCV − ACV, 0)
tcvCredited          = tcvUplift × (TCV credit % / 100)
commissionableValue  = ACV + tcvCredited

attainmentBefore     = ACV already booked this period
attainmentAfter      = attainmentBefore + commissionableValue

# for every tier band that overlaps the dollar range
# [attainmentBefore, attainmentAfter], at BCR × tier multiplier:
grossCommission      = Σ (dollars of this deal's value inside the band) × (BCR × band multiplier / 100)

deductionAmount      = grossCommission × (deduction % / 100)
netCommission        = grossCommission − deductionAmount
```

Only this deal's own incremental value is charged — attainment already
booked before it is not re-taxed.

### Renewal — flat rate

```
grossCommission = renewalACV × (renewal rate % / 100)
deductionAmount = grossCommission × (deduction % / 100)
netCommission   = grossCommission − deductionAmount
```

No tiers, no quota attainment, no acceleration.

### Out-Year New Business — flat rate off BCR

```
effectiveRate   = BCR × Out-Year New Business multiplier
grossCommission = outYearACV × (effectiveRate / 100)
deductionAmount = grossCommission × (deduction % / 100)
netCommission   = grossCommission − deductionAmount
```

Also no tiers or acceleration — this models a fixed rate paid annually on
years two-plus of a multi-year deal.

### Verified against a real plan

The New Business formula is checked in the test suite against a real
worked example: a $1,700,000 quota with the six tiers above and a 2.2402%
BCR produces exactly **£38,083.40** of New Business commission at 100%
attainment from a standing start — which is 85% of that plan's total
£44,804.27 OTE (the other 15% being Renewal).

## Tests

Dependency-free tests cover the graduated tier math (including deals that
straddle a tier boundary), the Renewal and Out-Year New Business flat-rate
paths, deduction math, validation of empty/negative/invalid inputs, and the
real-plan example above:

```bash
node comp-calc/test/calc.test.js
```

## Privacy

No accounts, no backend, no analytics, no network calls. Your plan
assumptions live only in this browser via `localStorage`.
