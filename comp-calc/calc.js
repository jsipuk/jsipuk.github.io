/* Commission calculation logic — pure functions, no DOM, no storage.
 * Loaded as a plain script in the browser (see index.html) and evaluated
 * the same way in test/calc.test.js, so keep this file dependency-free.
 *
 * Data model
 * ----------
 * Plan (the editable compensation assumptions):
 *   {
 *     quota:              number   // annual quota, in the same currency as deals
 *     priorAttainment:    number   // amount already booked this period, before this deal
 *     baseCommissionRate: number   // base commission rate, as a percentage (e.g. 10 = 10%)
 *     tcvCreditPct:       number   // % of (TCV - ACV) credited as commissionable value, 0-100
 *     deductionPct:       number   // average tax/deductions, as a percentage (default 49)
 *     tiers: [
 *       { minAttainmentPct: number, multiplier: number }, ...
 *     ]                            // achievement bands: from X% quota attainment, apply this multiplier
 *   }
 *
 * Deal (a single opportunity being sized):
 *   {
 *     acv: number   // annual contract value
 *     tcv: number   // total contract value (>= acv for multi-year deals)
 *   }
 */

// A generic, clearly-placeholder starting plan. None of these are anyone's
// real comp plan numbers — they exist so the app is usable on first load
// and every field is meant to be edited.
function defaultPlan() {
  return {
    quota: 100000,
    priorAttainment: 0,
    baseCommissionRate: 10,
    tcvCreditPct: 0,
    deductionPct: 49,
    tiers: [
      { minAttainmentPct: 0, multiplier: 1 },
      { minAttainmentPct: 100, multiplier: 1.2 },
      { minAttainmentPct: 150, multiplier: 1.5 },
    ],
  };
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Returns an array of human-readable error strings; empty array means valid.
function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return ['Plan is missing.'];

  if (!isFiniteNumber(plan.quota) || plan.quota <= 0) {
    errors.push('Quota must be a positive number.');
  }
  if (!isFiniteNumber(plan.priorAttainment) || plan.priorAttainment < 0) {
    errors.push('Attainment so far cannot be negative.');
  }
  if (!isFiniteNumber(plan.baseCommissionRate) || plan.baseCommissionRate < 0) {
    errors.push('Base commission rate cannot be negative.');
  }
  if (!isFiniteNumber(plan.tcvCreditPct) || plan.tcvCreditPct < 0 || plan.tcvCreditPct > 100) {
    errors.push('TCV credit % must be between 0 and 100.');
  }
  if (!isFiniteNumber(plan.deductionPct) || plan.deductionPct < 0 || plan.deductionPct > 100) {
    errors.push('Deduction % must be between 0 and 100.');
  }
  if (!Array.isArray(plan.tiers) || plan.tiers.length === 0) {
    errors.push('At least one achievement tier is required.');
  } else {
    plan.tiers.forEach((t, i) => {
      if (!isFiniteNumber(t.minAttainmentPct) || t.minAttainmentPct < 0) {
        errors.push(`Tier ${i + 1}: attainment threshold must be zero or more.`);
      }
      if (!isFiniteNumber(t.multiplier) || t.multiplier < 0) {
        errors.push(`Tier ${i + 1}: multiplier cannot be negative.`);
      }
    });
    const hasZeroFloor = plan.tiers.some((t) => isFiniteNumber(t.minAttainmentPct) && t.minAttainmentPct === 0);
    if (!hasZeroFloor) {
      errors.push('One tier must start at 0% attainment so every deal has a matching band.');
    }
  }
  return errors;
}

function validateDeal(deal) {
  const errors = [];
  if (!deal || typeof deal !== 'object') return ['Deal is missing.'];

  if (!isFiniteNumber(deal.acv) || deal.acv <= 0) {
    errors.push('ACV must be a positive number.');
  }
  if (!isFiniteNumber(deal.tcv) || deal.tcv <= 0) {
    errors.push('TCV must be a positive number.');
  }
  if (isFiniteNumber(deal.acv) && isFiniteNumber(deal.tcv) && deal.tcv < deal.acv) {
    errors.push('TCV cannot be less than ACV.');
  }
  return errors;
}

// Picks the tier that applies at a given attainment percentage: the
// highest tier whose threshold is at or below the attainment reached.
function selectTier(tiers, attainmentPct) {
  const sorted = [...tiers].sort((a, b) => a.minAttainmentPct - b.minAttainmentPct);
  let selected = sorted[0];
  for (const tier of sorted) {
    if (tier.minAttainmentPct <= attainmentPct) {
      selected = tier;
    } else {
      break;
    }
  }
  return selected;
}

// Calculates gross/net commission for a deal under a plan, plus a
// step-by-step breakdown suitable for display. Assumes plan/deal have
// already passed validatePlan/validateDeal.
function calculateCommission(plan, deal) {
  const tcvUplift = Math.max(deal.tcv - deal.acv, 0);
  const tcvCredited = tcvUplift * (plan.tcvCreditPct / 100);
  const commissionableValue = deal.acv + tcvCredited;

  const attainmentBefore = plan.priorAttainment;
  const attainmentAfter = attainmentBefore + commissionableValue;
  const attainmentPctAfter = (attainmentAfter / plan.quota) * 100;

  const tier = selectTier(plan.tiers, attainmentPctAfter);

  const grossCommission = commissionableValue * (plan.baseCommissionRate / 100) * tier.multiplier;
  const deductionAmount = grossCommission * (plan.deductionPct / 100);
  const netCommission = grossCommission - deductionAmount;

  return {
    commissionableValue,
    tcvUplift,
    tcvCredited,
    attainmentBefore,
    attainmentAfter,
    attainmentPctAfter,
    tier,
    grossCommission,
    deductionAmount,
    netCommission,
  };
}

// Browser: attach to window so app.js can use these without a bundler.
if (typeof window !== 'undefined') {
  window.CommissionCalc = {
    defaultPlan,
    validatePlan,
    validateDeal,
    selectTier,
    calculateCommission,
  };
}
