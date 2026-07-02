/* Lightweight, dependency-free checks for the commission calculation logic.
   Run with:  node commission-calculator/test/calc.test.js */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'calc.js'), 'utf8');
const calc = new Function(
  src + '\n;return { defaultPlan, validatePlan, validateDeal, selectTier, calculateCommission };'
)();

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ ' + msg);
  }
};
const approx = (a, b, msg, epsilon = 1e-6) => ok(Math.abs(a - b) < epsilon, `${msg} (got ${a}, expected ${b})`);

function basePlan(overrides = {}) {
  return {
    ...calc.defaultPlan(),
    ...overrides,
  };
}

// ---------------------------------------------------------------- validation

{
  const errors = calc.validatePlan(calc.defaultPlan());
  ok(errors.length === 0, 'default plan is valid');
}

{
  const errors = calc.validatePlan(basePlan({ quota: 0 }));
  ok(errors.some((e) => /quota/i.test(e)), 'rejects zero quota');
}

{
  const errors = calc.validatePlan(basePlan({ quota: -5 }));
  ok(errors.some((e) => /quota/i.test(e)), 'rejects negative quota');
}

{
  const errors = calc.validatePlan(basePlan({ deductionPct: 149 }));
  ok(errors.some((e) => /deduction/i.test(e)), 'rejects deduction % above 100');
}

{
  const errors = calc.validatePlan(basePlan({ deductionPct: -1 }));
  ok(errors.some((e) => /deduction/i.test(e)), 'rejects negative deduction %');
}

{
  const errors = calc.validatePlan(basePlan({ tiers: [] }));
  ok(errors.some((e) => /tier/i.test(e)), 'rejects empty tier list');
}

{
  const errors = calc.validatePlan(basePlan({ tiers: [{ minAttainmentPct: 50, multiplier: 1 }] }));
  ok(errors.some((e) => /0%/.test(e)), 'rejects tiers with no 0% floor');
}

{
  const errors = calc.validatePlan(basePlan({ baseCommissionRate: NaN }));
  ok(errors.some((e) => /rate/i.test(e)), 'rejects non-numeric commission rate');
}

{
  const errors = calc.validateDeal({ acv: 10000, tcv: 30000 });
  ok(errors.length === 0, 'valid deal passes');
}

{
  const errors = calc.validateDeal({ acv: 0, tcv: 0 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects zero ACV');
  ok(errors.some((e) => /TCV/.test(e)), 'rejects zero TCV');
}

{
  const errors = calc.validateDeal({ acv: -100, tcv: 500 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects negative ACV');
}

{
  const errors = calc.validateDeal({ acv: 'abc', tcv: 500 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects non-numeric ACV');
}

{
  const errors = calc.validateDeal({ acv: 20000, tcv: 10000 });
  ok(errors.some((e) => /TCV cannot be less/i.test(e)), 'rejects TCV lower than ACV');
}

{
  const errors = calc.validateDeal({});
  ok(errors.length === 2, 'rejects fully empty deal with both field errors');
}

// ---------------------------------------------------------------- tier selection

{
  const tiers = [
    { minAttainmentPct: 0, multiplier: 1 },
    { minAttainmentPct: 100, multiplier: 1.2 },
    { minAttainmentPct: 150, multiplier: 1.5 },
  ];
  ok(calc.selectTier(tiers, 0).multiplier === 1, 'picks base tier at 0% attainment');
  ok(calc.selectTier(tiers, 99.9).multiplier === 1, 'stays in base tier just below threshold');
  ok(calc.selectTier(tiers, 100).multiplier === 1.2, 'picks accelerator tier exactly at threshold');
  ok(calc.selectTier(tiers, 140).multiplier === 1.2, 'stays in accelerator tier below next threshold');
  ok(calc.selectTier(tiers, 150).multiplier === 1.5, 'picks top tier at threshold');
  ok(calc.selectTier(tiers, 500).multiplier === 1.5, 'stays in top tier far above threshold');
}

{
  // Order independence: tiers supplied out of order should behave the same.
  const tiers = [
    { minAttainmentPct: 150, multiplier: 1.5 },
    { minAttainmentPct: 0, multiplier: 1 },
    { minAttainmentPct: 100, multiplier: 1.2 },
  ];
  ok(calc.selectTier(tiers, 120).multiplier === 1.2, 'sorts unordered tiers before selecting');
}

// ---------------------------------------------------------------- core commission math

{
  // Simple case: no prior attainment, ACV-only commissionable value, base tier.
  const plan = basePlan({ quota: 100000, priorAttainment: 0, baseCommissionRate: 10, tcvCreditPct: 0, deductionPct: 49 });
  const deal = { acv: 20000, tcv: 20000 };
  const r = calc.calculateCommission(plan, deal);

  approx(r.commissionableValue, 20000, 'ACV-only deal: commissionable value equals ACV when TCV=ACV');
  approx(r.attainmentPctAfter, 20, 'ACV-only deal: attainment % after deal');
  ok(r.tier.multiplier === 1, 'ACV-only deal: stays in base tier');
  approx(r.grossCommission, 2000, 'ACV-only deal: gross = 20000 * 10% * 1.0');
  approx(r.deductionAmount, 980, 'ACV-only deal: deduction = 49% of gross');
  approx(r.netCommission, 1020, 'ACV-only deal: net = gross - deduction');
}

{
  // TCV credit partially counted toward commissionable value.
  const plan = basePlan({ quota: 100000, priorAttainment: 0, baseCommissionRate: 10, tcvCreditPct: 50, deductionPct: 49 });
  const deal = { acv: 20000, tcv: 50000 }; // uplift = 30000, credited = 15000
  const r = calc.calculateCommission(plan, deal);

  approx(r.tcvUplift, 30000, 'TCV credit: uplift is TCV - ACV');
  approx(r.tcvCredited, 15000, 'TCV credit: 50% of uplift credited');
  approx(r.commissionableValue, 35000, 'TCV credit: commissionable value = ACV + credited uplift');
}

{
  // Crossing into an accelerator tier because of prior attainment.
  const plan = basePlan({ quota: 100000, priorAttainment: 90000, baseCommissionRate: 10, tcvCreditPct: 0, deductionPct: 49 });
  const deal = { acv: 20000, tcv: 20000 }; // total attainment = 110000 -> 110%
  const r = calc.calculateCommission(plan, deal);

  approx(r.attainmentPctAfter, 110, 'accelerator: attainment % crosses 100%');
  ok(r.tier.multiplier === 1.2, 'accelerator: whole deal credited at accelerator multiplier');
  approx(r.grossCommission, 2400, 'accelerator: gross = 20000 * 10% * 1.2');
}

{
  // Zero deduction means net equals gross.
  const plan = basePlan({ deductionPct: 0 });
  const deal = { acv: 10000, tcv: 10000 };
  const r = calc.calculateCommission(plan, deal);
  approx(r.netCommission, r.grossCommission, 'zero deduction: net equals gross');
}

{
  // 100% deduction wipes out net commission.
  const plan = basePlan({ deductionPct: 100 });
  const deal = { acv: 10000, tcv: 10000 };
  const r = calc.calculateCommission(plan, deal);
  approx(r.netCommission, 0, '100% deduction: net commission is zero');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
