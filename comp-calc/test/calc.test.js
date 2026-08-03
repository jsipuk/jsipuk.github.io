/* Lightweight, dependency-free checks for the commission calculation logic.
   Run with:  node comp-calc/test/calc.test.js */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'calc.js'), 'utf8');
const calc = new Function(
  src +
    '\n;return { emptyPlan, examplePlan, isEmptyPlan, validatePlan, validateDeal, tierBands, graduatedNewBusinessCommission, calculateCommission };'
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

// Test fixture, not anybody's compensation plan. Round numbers on purpose:
// a $1M quota and a 2% base rate make every expected figure checkable by
// hand, and nothing real is committed to this public repository.
function basePlan(overrides = {}) {
  return {
    quota: 1000000,
    priorAttainment: 0,
    baseCommissionRate: 2,
    tcvCreditPct: 0,
    deductionPct: 50,
    tiers: [
      { minAttainmentPct: 0, multiplier: 0.5 },
      { minAttainmentPct: 50, multiplier: 1 },
      { minAttainmentPct: 100, multiplier: 2 },
    ],
    renewalRatePct: 1,
    oyNbMultiplier: 0.5,
    ...overrides,
  };
}

// -------------------------------------------------------------- first run

{
  const plan = calc.emptyPlan();
  const errors = calc.validatePlan(plan);
  ok(errors.length > 0, 'empty first-run plan does not validate until it is filled in');
  ok(calc.isEmptyPlan(plan), 'empty first-run plan is reported as empty');
  const seeded = Object.entries(plan).filter(([k, v]) => k !== 'tiers' && v !== null);
  ok(seeded.length === 0, 'empty first-run plan seeds no figures at all');
  ok(plan.tiers.length === 1 && plan.tiers[0].minAttainmentPct === 0, 'empty plan still offers one 0% tier row');
}

{
  const plan = calc.examplePlan();
  ok(calc.validatePlan(plan).length === 0, 'example plan is valid');
  ok(!calc.isEmptyPlan(plan), 'example plan is not reported as empty');
}

{
  ok(calc.isEmptyPlan(basePlan({ quota: null })) === false, 'a plan with any figure set is not empty');
}

// ---------------------------------------------------------------- validation

{
  const errors = calc.validatePlan(basePlan());
  ok(errors.length === 0, 'fixture plan is valid');
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
  const errors = calc.validatePlan(basePlan({ renewalRatePct: -1 }));
  ok(errors.some((e) => /renewal/i.test(e)), 'rejects negative renewal rate');
}

{
  const errors = calc.validatePlan(basePlan({ oyNbMultiplier: -0.1 }));
  ok(errors.some((e) => /out-year/i.test(e)), 'rejects negative OY NB multiplier');
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
  const errors = calc.validateDeal({ dealType: 'newBusiness', acv: 10000, tcv: 30000 });
  ok(errors.length === 0, 'valid new business deal passes');
}

{
  const errors = calc.validateDeal({ dealType: 'newBusiness', acv: 0, tcv: 0 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects zero ACV');
  ok(errors.some((e) => /TCV/.test(e)), 'rejects zero TCV');
}

{
  const errors = calc.validateDeal({ dealType: 'newBusiness', acv: -100, tcv: 500 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects negative ACV');
}

{
  const errors = calc.validateDeal({ dealType: 'newBusiness', acv: 'abc', tcv: 500 });
  ok(errors.some((e) => /ACV/.test(e)), 'rejects non-numeric ACV');
}

{
  const errors = calc.validateDeal({ dealType: 'newBusiness', acv: 20000, tcv: 10000 });
  ok(errors.some((e) => /TCV cannot be less/i.test(e)), 'rejects TCV lower than ACV');
}

{
  const errors = calc.validateDeal({});
  ok(errors.length === 2, 'rejects fully empty deal (defaults to new business) with both field errors');
}

{
  const errors = calc.validateDeal({ dealType: 'renewal', acv: 5000 });
  ok(errors.length === 0, 'valid renewal deal passes without TCV');
}

{
  const errors = calc.validateDeal({ dealType: 'renewal', acv: 0 });
  ok(errors.length === 1 && /Renewal ACV/.test(errors[0]), 'rejects zero renewal ACV with renewal-specific label');
}

{
  const errors = calc.validateDeal({ dealType: 'oyNb', acv: 5000 });
  ok(errors.length === 0, 'valid out-year new business deal passes without TCV');
}

{
  const errors = calc.validateDeal({ dealType: 'oyNb', acv: -1 });
  ok(errors.length === 1 && /Out-year ACV/.test(errors[0]), 'rejects negative out-year ACV with OY-specific label');
}

{
  const errors = calc.validateDeal({ dealType: 'bogus', acv: 100 });
  ok(errors.length === 1 && /Unknown deal type/.test(errors[0]), 'rejects unknown deal type');
}

// ---------------------------------------------------------------- tier bands

{
  const tiers = [
    { minAttainmentPct: 0, multiplier: 0.5 },
    { minAttainmentPct: 50, multiplier: 1 },
    { minAttainmentPct: 100, multiplier: 2 },
  ];
  const bands = calc.tierBands(tiers);
  ok(bands.length === 3, 'expands tiers into bands');
  ok(bands[0].maxAttainmentPct === 50, 'first band ends where second begins');
  ok(bands[2].maxAttainmentPct === Infinity, 'last band is open-ended');
}

{
  // Order independence.
  const tiers = [
    { minAttainmentPct: 100, multiplier: 2 },
    { minAttainmentPct: 0, multiplier: 0.5 },
    { minAttainmentPct: 50, multiplier: 1 },
  ];
  const bands = calc.tierBands(tiers);
  ok(bands[0].minAttainmentPct === 0 && bands[1].minAttainmentPct === 50 && bands[2].minAttainmentPct === 100, 'sorts unordered tiers');
}

// ---------------------------------------------------------- full-quota worked example

// A whole year at exactly 100% attainment, done by hand on the fixture:
// $1,000,000 of quota, a 2% base rate, and the first two bands split at 50%.
//   first  $500,000 at 2% x 0.5 = 1.0%  ->  $5,000
//   second $500,000 at 2% x 1.0 = 2.0%  -> $10,000
//                                 total -> $15,000 gross, $7,500 net at 50%.
{
  const plan = basePlan();
  const deal = { dealType: 'newBusiness', acv: 1000000, tcv: 1000000 };
  const r = calc.calculateCommission(plan, deal);

  approx(r.attainmentPctAfter, 100, 'full quota: reaches exactly 100% attainment');
  ok(r.segments.length === 2, 'full quota: a full-quota deal from zero spans exactly the first two tiers');
  approx(r.segments[0].width, 500000, 'full quota: first tier band is the first 50% of quota');
  approx(r.segments[1].width, 500000, 'full quota: second tier band is the next 50% of quota');
  approx(r.segments[0].commission, 5000, 'full quota: first band pays the base rate at 0.5x');
  approx(r.segments[1].commission, 10000, 'full quota: second band pays the base rate at 1x');
  approx(r.grossCommission, 15000, 'full quota: gross is the sum of both bands', 0.01);
  approx(r.netCommission, 7500, 'full quota: net is gross less the deduction', 0.01);
}

// ---------------------------------------------------------------- graduated New Business math

{
  // A deal entirely within the base (0-50%) tier.
  const plan = basePlan({ quota: 1000000, priorAttainment: 0 });
  const deal = { dealType: 'newBusiness', acv: 200000, tcv: 200000 };
  const r = calc.calculateCommission(plan, deal);

  approx(r.attainmentPctAfter, 20, 'within base tier: attainment % after deal');
  ok(r.segments.length === 1, 'within base tier: only one tier touched');
  approx(r.segments[0].multiplier, 0.5, 'within base tier: base tier multiplier used');
  approx(r.grossCommission, 200000 * (2 * 0.5) / 100, 'within base tier: gross matches single-tier rate');
}

{
  // A deal that straddles the 50% boundary should earn a blend of both tiers.
  const plan = basePlan({ quota: 1000000, priorAttainment: 400000 });
  const deal = { dealType: 'newBusiness', acv: 200000, tcv: 200000 }; // 40% -> 60%
  const r = calc.calculateCommission(plan, deal);

  approx(r.attainmentPctBefore, 40, 'straddling deal: attainment % before');
  approx(r.attainmentPctAfter, 60, 'straddling deal: attainment % after');
  ok(r.segments.length === 2, 'straddling deal: touches two tiers');
  approx(r.segments[0].width, 100000, 'straddling deal: 100k in the 0-50% tier');
  approx(r.segments[1].width, 100000, 'straddling deal: 100k in the 50-100% tier');
  const expected = 100000 * (2 * 0.5) / 100 + 100000 * (2 * 1) / 100;
  approx(r.grossCommission, expected, 'straddling deal: gross is the sum of both tiers\' contributions');
}

{
  // Prior attainment already booked should not be re-charged commission —
  // only the new deal's own incremental slice earns anything.
  const plan = basePlan({ quota: 1000000, priorAttainment: 900000 });
  const deal = { dealType: 'newBusiness', acv: 50000, tcv: 50000 }; // 90% -> 95%, all within 50-100% tier
  const r = calc.calculateCommission(plan, deal);

  ok(r.segments.length === 1, 'incremental deal: only touches the tier it falls in');
  approx(r.segments[0].width, 50000, 'incremental deal: full deal value counted, not cumulative total');
  approx(r.grossCommission, 50000 * (2 * 1) / 100, 'incremental deal: only this deal\'s value is charged');
}

{
  // TCV credit still applies before the graduated calc runs.
  const plan = basePlan({ quota: 1000000, priorAttainment: 0, tcvCreditPct: 50 });
  const deal = { dealType: 'newBusiness', acv: 100000, tcv: 300000 }; // uplift 200k, credited 100k -> commissionable 200k
  const r = calc.calculateCommission(plan, deal);

  approx(r.commissionableValue, 200000, 'TCV credit: commissionable value includes credited uplift');
  approx(r.attainmentPctAfter, 20, 'TCV credit: attainment reflects commissionable value, not raw ACV');
}

// ---------------------------------------------------------------- renewal & out-year new business

{
  const plan = basePlan({ renewalRatePct: 1.5, deductionPct: 49 });
  const deal = { dealType: 'renewal', acv: 100000 };
  const r = calc.calculateCommission(plan, deal);

  ok(r.dealType === 'renewal', 'renewal: result tagged with deal type');
  ok(r.segments.length === 0, 'renewal: no tiered segments');
  approx(r.grossCommission, 1500, 'renewal: flat rate applied to renewal ACV');
  approx(r.netCommission, 1500 * 0.51, 'renewal: deduction still applied to net');
}

{
  const plan = basePlan({ baseCommissionRate: 2, oyNbMultiplier: 0.25, deductionPct: 50 });
  const deal = { dealType: 'oyNb', acv: 100000 };
  const r = calc.calculateCommission(plan, deal);

  ok(r.dealType === 'oyNb', 'OY NB: result tagged with deal type');
  ok(r.segments.length === 0, 'OY NB: no tiered segments');
  approx(r.ratePct, 2 * 0.25, 'OY NB: effective rate is BCR x OY multiplier');
  approx(r.grossCommission, 100000 * (2 * 0.25) / 100, 'OY NB: gross uses BCR x OY multiplier, not full BCR');
}

{
  // Zero deduction means net equals gross, across all deal types.
  const plan = basePlan({ deductionPct: 0 });
  ['newBusiness', 'renewal', 'oyNb'].forEach((dealType) => {
    const deal = { dealType, acv: 10000, tcv: 10000 };
    const r = calc.calculateCommission(plan, deal);
    approx(r.netCommission, r.grossCommission, `zero deduction (${dealType}): net equals gross`);
  });
}

{
  // 100% deduction wipes out net commission, across all deal types.
  const plan = basePlan({ deductionPct: 100 });
  ['newBusiness', 'renewal', 'oyNb'].forEach((dealType) => {
    const deal = { dealType, acv: 10000, tcv: 10000 };
    const r = calc.calculateCommission(plan, deal);
    approx(r.netCommission, 0, `100% deduction (${dealType}): net commission is zero`);
  });
}

// ------------------------------------------------- no real plan in the source

// This repository is public. calc.js is served as-is to anyone who opens the
// page, and is readable on GitHub whatever the page does, so it must never
// carry a real compensation plan again. A plan is "real-looking" here if its
// rates are precise to more than two decimal places, or its quota is an
// oddly specific figure: invented examples are round.
{
  const shipped = { ...calc.emptyPlan(), ...calc.examplePlan() };
  const rateFields = ['baseCommissionRate', 'renewalRatePct', 'oyNbMultiplier', 'deductionPct', 'tcvCreditPct'];

  rateFields.forEach((field) => {
    const v = shipped[field];
    const decimals = String(v).includes('.') ? String(v).split('.')[1].length : 0;
    ok(decimals <= 2, `shipped ${field} (${v}) is a round number, not a real plan's rate`);
  });

  ok(shipped.quota % 100000 === 0, `shipped quota (${shipped.quota}) is a round figure, not a real quota`);
  ok(shipped.priorAttainment === 0, 'shipped example starts from zero attainment');

  shipped.tiers.forEach((t, i) => {
    const decimals = String(t.multiplier).includes('.') ? String(t.multiplier).split('.')[1].length : 0;
    ok(decimals <= 1, `shipped tier ${i + 1} multiplier (${t.multiplier}) is round`);
    ok(t.minAttainmentPct % 50 === 0, `shipped tier ${i + 1} threshold (${t.minAttainmentPct}%) is round`);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
