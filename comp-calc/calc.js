/* Commission calculation logic — pure functions, no DOM, no storage.
 * Loaded as a plain script in the browser (see index.html) and evaluated
 * the same way in test/calc.test.js, so keep this file dependency-free.
 *
 * Data model
 * ----------
 * Plan (the editable compensation assumptions):
 *   {
 *     quota:              number   // annual New Business ACV quota. null in the
 *                                  // first-run state, before anything is entered.
 *     priorAttainment:    number   // NB ACV already booked this period, before this deal
 *     baseCommissionRate: number   // BCR, as a percentage (e.g. 1.5 = 1.5%).
 *                                  // Applied to New Business ACV within each tier band, and
 *                                  // used as the base for the Out-Year New Business rate.
 *     tcvCreditPct:       number   // % of (TCV - ACV) credited as NB commissionable value
 *     deductionPct:       number   // average tax/deductions, as a percentage
 *     tiers: [
 *       { minAttainmentPct: number, multiplier: number }, ...
 *     ]                            // graduated achievement bands: every dollar of NB ACV
 *                                  // attainment is paid at the multiplier for the band it
 *                                  // falls in (like a tax bracket, not a single cliff rate)
 *     renewalRatePct:     number   // flat % applied to Renewal ACV — no tiers, no quota attainment
 *     oyNbMultiplier:     number   // flat multiplier on BCR for Out-Year New Business ACV —
 *                                  // no tiers, no quota attainment; paid annually in each out-year
 *   }
 *
 * Deal (a single opportunity being sized):
 *   {
 *     dealType: 'newBusiness' | 'renewal' | 'oyNb'   // defaults to 'newBusiness'
 *     acv: number   // meaning depends on dealType: NB ACV, Renewal ACV, or Out-Year ACV
 *     tcv: number   // total contract value — only used when dealType is 'newBusiness'
 *   }
 */

const DEAL_TYPES = ['newBusiness', 'renewal', 'oyNb'];

// This repository is public, so no real compensation plan is committed to it.
// The app ships empty and the user types their own numbers in, which are then
// held in this browser's localStorage and nowhere else. Two starting points
// exist and neither describes anybody's actual plan:
//
//   emptyPlan()   - the genuine first-run state: every figure blank, one tier
//                   row so the tier editor has something to show. Deliberately
//                   fails validatePlan() until the user fills it in.
//   examplePlan() - round, obviously-invented numbers, loaded only when the
//                   user asks for them, so the shape of a plan is visible
//                   without shipping a real one.
function emptyPlan() {
  return {
    quota: null,
    priorAttainment: null,
    baseCommissionRate: null,
    tcvCreditPct: null,
    deductionPct: null,
    tiers: [{ minAttainmentPct: 0, multiplier: 1 }],
    renewalRatePct: null,
    oyNbMultiplier: null,
  };
}

// Illustrative only: a $1M quota, a 1% base rate, and one accelerator at
// 100% attainment. Round on purpose, so it can never be mistaken for a
// real plan.
function examplePlan() {
  return {
    quota: 1000000,
    priorAttainment: 0,
    baseCommissionRate: 1,
    tcvCreditPct: 0,
    deductionPct: 40,
    tiers: [
      { minAttainmentPct: 0, multiplier: 1 },
      { minAttainmentPct: 100, multiplier: 2 },
    ],
    renewalRatePct: 0.5,
    oyNbMultiplier: 0.5,
  };
}

// True when a plan carries no user-entered figures at all — the first-run
// state. Used to decide whether to show the "nothing saved yet" hint.
function isEmptyPlan(plan) {
  if (!plan || typeof plan !== 'object') return true;
  const numericFields = [
    'quota',
    'priorAttainment',
    'baseCommissionRate',
    'tcvCreditPct',
    'deductionPct',
    'renewalRatePct',
    'oyNbMultiplier',
  ];
  return numericFields.every((f) => !isFiniteNumber(plan[f]));
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
  if (!isFiniteNumber(plan.renewalRatePct) || plan.renewalRatePct < 0) {
    errors.push('Renewal rate cannot be negative.');
  }
  if (!isFiniteNumber(plan.oyNbMultiplier) || plan.oyNbMultiplier < 0) {
    errors.push('Out-Year New Business multiplier cannot be negative.');
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

  const dealType = deal.dealType || 'newBusiness';
  if (!DEAL_TYPES.includes(dealType)) {
    return ['Unknown deal type.'];
  }

  const acvLabel = dealType === 'renewal' ? 'Renewal ACV' : dealType === 'oyNb' ? 'Out-year ACV' : 'ACV';
  if (!isFiniteNumber(deal.acv) || deal.acv <= 0) {
    errors.push(`${acvLabel} must be a positive number.`);
  }

  if (dealType === 'newBusiness') {
    if (!isFiniteNumber(deal.tcv) || deal.tcv <= 0) {
      errors.push('TCV must be a positive number.');
    }
    if (isFiniteNumber(deal.acv) && isFiniteNumber(deal.tcv) && deal.tcv < deal.acv) {
      errors.push('TCV cannot be less than ACV.');
    }
  }

  return errors;
}

// Expands tiers (each with just a starting threshold) into bands with an
// explicit end, sorted ascending. The last band runs to +Infinity.
function tierBands(tiers) {
  const sorted = [...tiers].sort((a, b) => a.minAttainmentPct - b.minAttainmentPct);
  return sorted.map((t, i) => ({
    minAttainmentPct: t.minAttainmentPct,
    maxAttainmentPct: i + 1 < sorted.length ? sorted[i + 1].minAttainmentPct : Infinity,
    multiplier: t.multiplier,
  }));
}

// Graduated ("tax bracket") commission on New Business ACV: every dollar of
// attainment is paid at the multiplier for the band it falls in, so a deal
// that crosses a tier boundary earns a blend of both tiers' rates rather
// than jumping the whole deal to one cliff rate. fromDollar/toDollar mark
// the attainment range this specific deal occupies (prior attainment, and
// prior attainment + this deal's commissionable value).
function graduatedNewBusinessCommission(plan, fromDollar, toDollar) {
  const bands = tierBands(plan.tiers);
  const segments = [];
  let grossCommission = 0;

  for (const band of bands) {
    const bandFromDollar = (band.minAttainmentPct / 100) * plan.quota;
    const bandToDollar = band.maxAttainmentPct === Infinity ? Infinity : (band.maxAttainmentPct / 100) * plan.quota;
    const overlapStart = Math.max(fromDollar, bandFromDollar);
    const overlapEnd = Math.min(toDollar, bandToDollar);
    const width = Math.max(0, overlapEnd - overlapStart);
    if (width > 0) {
      const ratePct = plan.baseCommissionRate * band.multiplier;
      const commission = width * (ratePct / 100);
      grossCommission += commission;
      segments.push({
        minAttainmentPct: band.minAttainmentPct,
        maxAttainmentPct: band.maxAttainmentPct,
        multiplier: band.multiplier,
        ratePct,
        width,
        commission,
      });
    }
  }

  return { grossCommission, segments };
}

// Calculates gross/net commission for a deal under a plan, plus a
// step-by-step breakdown suitable for display. Assumes plan/deal have
// already passed validatePlan/validateDeal.
function calculateCommission(plan, deal) {
  const dealType = deal.dealType || 'newBusiness';

  if (dealType === 'renewal') {
    const commissionableValue = deal.acv;
    const ratePct = plan.renewalRatePct;
    const grossCommission = commissionableValue * (ratePct / 100);
    const deductionAmount = grossCommission * (plan.deductionPct / 100);
    return {
      dealType,
      commissionableValue,
      ratePct,
      segments: [],
      grossCommission,
      deductionAmount,
      netCommission: grossCommission - deductionAmount,
    };
  }

  if (dealType === 'oyNb') {
    const commissionableValue = deal.acv;
    const ratePct = plan.baseCommissionRate * plan.oyNbMultiplier;
    const grossCommission = commissionableValue * (ratePct / 100);
    const deductionAmount = grossCommission * (plan.deductionPct / 100);
    return {
      dealType,
      commissionableValue,
      ratePct,
      multiplier: plan.oyNbMultiplier,
      segments: [],
      grossCommission,
      deductionAmount,
      netCommission: grossCommission - deductionAmount,
    };
  }

  // newBusiness
  const tcvUplift = Math.max(deal.tcv - deal.acv, 0);
  const tcvCredited = tcvUplift * (plan.tcvCreditPct / 100);
  const commissionableValue = deal.acv + tcvCredited;

  const attainmentBefore = plan.priorAttainment;
  const attainmentAfter = attainmentBefore + commissionableValue;
  const attainmentPctBefore = (attainmentBefore / plan.quota) * 100;
  const attainmentPctAfter = (attainmentAfter / plan.quota) * 100;

  const { grossCommission, segments } = graduatedNewBusinessCommission(plan, attainmentBefore, attainmentAfter);
  const deductionAmount = grossCommission * (plan.deductionPct / 100);

  return {
    dealType,
    tcvUplift,
    tcvCredited,
    commissionableValue,
    attainmentBefore,
    attainmentAfter,
    attainmentPctBefore,
    attainmentPctAfter,
    segments,
    grossCommission,
    deductionAmount,
    netCommission: grossCommission - deductionAmount,
  };
}

// Browser: attach to window so app.js can use these without a bundler.
if (typeof window !== 'undefined') {
  window.CommissionCalc = {
    DEAL_TYPES,
    emptyPlan,
    examplePlan,
    isEmptyPlan,
    validatePlan,
    validateDeal,
    tierBands,
    graduatedNewBusinessCommission,
    calculateCommission,
  };
}
