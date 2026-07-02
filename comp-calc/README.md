# Commission Calculator

A small, personal calculator for estimating sales commission on a deal.
Save your compensation-plan assumptions once, then enter a deal's ACV/TCV
and see estimated gross and net commission with a full breakdown.

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

- **Annual quota** — your target for the period.
- **Attainment already booked this period** — anything already closed
  before this deal, so the calculator can tell whether this deal pushes you
  into a higher achievement tier.
- **Base commission rate (%)** — the flat rate applied to commissionable
  deal value before any tier multiplier.
- **TCV credit (%)** — how much of the value *beyond* year one (i.e.
  `TCV − ACV`) counts toward commission. Set to `0` if your plan only pays
  on ACV; set to `100` if it pays on full TCV.
- **Average deductions / tax (%)** — used to turn gross commission into an
  estimated net figure. Defaults to **49%**, fully editable.
- **Achievement tiers** — one row per band: "From attainment (%)" is the
  quota-attainment threshold (must include a `0%` row as the floor), and
  "Multiplier" is what gets applied to commissionable value once that
  threshold is reached. Add or remove rows with **+ Add tier** / the
  **×** button.

Click **Reset to defaults** to restore the generic starting values
(placeholder numbers, not a real plan) and overwrite the saved plan.

## Calculating a deal

1. Enter **ACV** (Annual Contract Value) and **TCV** (Total Contract Value)
   for the deal.
2. Click **Calculate**.
3. Read the **Gross commission** and **Net commission** cards, and expand
   **Calculation breakdown** to see every step of the maths.

The plan panel doesn't need to be re-saved before calculating — Calculate
always uses whatever is currently in the plan fields, so you can try
"what if my quota were higher" without committing it first. Click **Save
plan** when you want to keep changes for next time.

## How the maths works

All logic lives in [`calc.js`](./calc.js), kept deliberately separate from
the DOM/UI code in [`app.js`](./app.js) so the formulas are easy to read,
change, and test in isolation.

```
tcvUplift            = max(TCV − ACV, 0)
tcvCredited          = tcvUplift × (TCV credit % / 100)
commissionableValue  = ACV + tcvCredited

attainmentAfter      = attainment already booked + commissionableValue
attainmentPctAfter   = attainmentAfter / quota × 100

tier                 = highest tier whose threshold ≤ attainmentPctAfter

grossCommission      = commissionableValue × (base rate % / 100) × tier.multiplier
deductionAmount      = grossCommission × (deduction % / 100)
netCommission        = grossCommission − deductionAmount
```

The whole deal is credited at the tier reached *after* adding it — a
common "marginal deal, final tier" approach. If your plan needs something
different (e.g. splitting a deal across tiers, or a separate accelerator
curve), that all happens in `calculateCommission()` in `calc.js` — the UI
doesn't need to change.

## Tests

Dependency-free tests cover tier selection, ACV/TCV blending, deduction
math, and validation of empty/negative/invalid inputs:

```bash
node comp-calc/test/calc.test.js
```

## Privacy

No accounts, no backend, no analytics, no network calls. Your plan
assumptions live only in this browser via `localStorage`.
