/* ══════════════════════════  TUNABLE HEURISTICS  ══════════════════════════

   Everything in this block is a guess, not a published rule. Beckett has never
   released its final-grade formula and PSA publishes centering figures for the
   10 and 9 thresholds only; the rest is reverse-engineered from submission
   data by the collecting community. The front/back weightings below are ours
   on top of that — a judgement about how much a bad back should cost a card
   when graders demonstrably weight the front far more heavily.

   This is the whole reason the vault records what each card actually came
   back as. Once you have twenty or thirty real results, tune these numbers
   against the evidence instead of against intuition, and re-check the vault
   summary to see whether the predictions moved the right way.
   ────────────────────────────────────────────────────────────────────────── */

export const WEIGHTS = {
  /* Corners and edges anchor on the front. If the worst BACK region scores
     below that anchor, the subgrade drops by this much — once, not per
     region. */
  BACK_CORNER_PENALTY: 0.5,
  BACK_EDGE_PENALTY: 0.5,

  /* Surface takes the front score outright. A back surface this far below it
     (or further) costs the penalty. */
  BACK_SURFACE_GAP: 2,
  BACK_SURFACE_PENALTY: 0.5,

  /* How a set of four region scores collapses to one subgrade: never more
     than ANCHOR_CEILING above the worst of them, and otherwise a weighted
     blend that leans hard on the worst. */
  ANCHOR_CEILING: 0.5,
  ANCHOR_MIN_WEIGHT: 0.65,
  ANCHOR_AVG_WEIGHT: 0.35,

  /* Back centering can only pull the centering subgrade down by this much. */
  CENTERING_BACK_MAX_DROP: 1,

  /* PSA runs looser than BGS on corners/edges/surface, so BGS-scale subs get
     this much headroom before PSA's whole-number floor is applied. */
  PSA_HEADROOM: 0.5,

  /* Used only when a region was never photographed. The report always names
     these rather than letting them pass as measured. */
  UNPHOTOGRAPHED_DEFAULT: 9,
};

/* ───────────────────────  VENDOR RULEBOOKS  ───────────────────────
   Centering tolerance tables. Entry = [worst-axis ratio ceiling, subgrade].
   PSA front/back published for 10 and 9; lower rungs are the widely
   cited community figures. BGS/CGC tolerances are community-derived —
   Beckett has never published the formula.
──────────────────────────────────────────────────────────────────── */

export const PSA_FRONT = [[55, 10], [60, 9], [65, 8], [70, 7], [75, 6], [80, 5], [85, 4], [90, 3], [95, 2], [100, 1]];
export const PSA_BACK = [[75, 10], [90, 9], [93, 8], [96, 7], [98, 6], [100, 5]];
export const BGS_FRONT = [[50.6, 10], [55, 9.5], [60, 9], [65, 8.5], [70, 8], [75, 7.5], [80, 7], [85, 6.5], [90, 6], [100, 5]];
export const BGS_BACK = [[55, 10], [60, 9.5], [70, 9], [80, 8.5], [85, 8], [90, 7.5], [95, 7], [100, 6.5]];

export const lookup = (table, ratio) => {
  for (const [ceil, grade] of table) if (ratio <= ceil + 0.001) return grade;
  return 1;
};

export const half = (n) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));

export function centeringSub(table, frontWorst, backWorst) {
  const f = lookup(table[0], frontWorst);
  const b = backWorst == null ? 10 : lookup(table[1], backWorst);
  // Front is weighted more heavily; back can only pull the sub down by 1.
  return half(Math.min(f, Math.max(b, f - WEIGHTS.CENTERING_BACK_MAX_DROP)));
}

/* BGS final-grade engine.
   Half-point rule → double-low anchor → point-bump exception → second-lowest cap. */
export function bgsFinal(subs) {
  const entries = Object.entries(subs);
  if (entries.every(([, v]) => v === 10))
    return { grade: 10, rule: 'All four subgrades are 10 — Pristine, Black Label.' };

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const low = sorted[0][1];
  const second = sorted[1][1];
  const lowKeys = entries.filter(([, v]) => v === low).map(([k]) => k);

  let g, rule;
  if (lowKeys.length >= 2) {
    g = low;
    rule = `Double-low anchor: ${lowKeys.join(' and ')} are tied at ${low}, so the final grade sits on that number.`;
  } else {
    const agg = entries.filter(([k]) => k !== lowKeys[0])
                       .reduce((s, [, v]) => s + (v - low), 0);
    const bumpable = lowKeys[0] === 'edges' || lowKeys[0] === 'surface';
    if (bumpable && agg > 4 && second - low >= 2) {
      g = low + 1;
      rule = `Point-bump exception: ${lowKeys[0]} is drastically low (${low}) and the other three exceed it by ${agg} in aggregate, so a full point is allowed.`;
    } else {
      g = low + 0.5;
      rule = `Half-point rule: ${lowKeys[0]} is the single lowest subgrade at ${low}, so the final grade caps 0.5 above it.`;
    }
  }
  if (g > second) {
    g = second;
    rule += ` Capped at the second-lowest subgrade (${second}).`;
  }
  return { grade: Math.min(10, g), rule };
}

/* PSA engine. PSA runs looser than BGS on corners/edges/surface and much
   looser on back centering, so BGS-scale subs get a half-point of headroom,
   then the lowest anchors a whole-number grade. */
export function psaFinal(bgsSubs, psaCentering) {
  const bump = (v) => half(Math.min(10, v + WEIGHTS.PSA_HEADROOM));
  const subs = {
    centering: psaCentering,
    corners: bump(bgsSubs.corners),
    edges: bump(bgsSubs.edges),
    surface: bump(bgsSubs.surface),
  };
  const vals = Object.values(subs).sort((a, b) => a - b);
  const min = vals[0];
  const limiter = Object.entries(subs).sort((a, b) => a[1] - b[1])[0][0];
  const grade = Math.max(1, Math.min(10, Math.floor(min)));
  return { grade, subs, limiter };
}

export const BGS_LABEL = { 10: 'Pristine', 9.5: 'Gem Mint', 9: 'Mint', 8.5: 'NM-MT+', 8: 'NM-MT', 7.5: 'NM+', 7: 'Near Mint', 6.5: 'EX-MT+', 6: 'EX-MT' };
export const PSA_LABEL = { 10: 'Gem Mint', 9: 'Mint', 8: 'NM-MT', 7: 'Near Mint', 6: 'EX-MT', 5: 'Excellent', 4: 'VG-EX', 3: 'Very Good', 2: 'Good', 1: 'Poor' };

/* ─────────────────────────  AGGREGATION  ─────────────────────────
   Front data anchors every pillar; back data can only pull it down. Each
   helper returns the subgrade plus enough provenance for the report to say
   which regions it actually saw. */

function anchor(scores) {
  const min = Math.min(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return half(Math.min(
    min + WEIGHTS.ANCHOR_CEILING,
    min * WEIGHTS.ANCHOR_MIN_WEIGHT + avg * WEIGHTS.ANCHOR_AVG_WEIGHT,
  ));
}

const CORNER_NAME = { tl: 'top-left', tr: 'top-right', br: 'bottom-right', bl: 'bottom-left' };
const EDGE_NAME = { top: 'top', right: 'right', bottom: 'bottom', left: 'left' };

const pick = (map, side, keys) =>
  keys
    .map((k) => [k, map[`${side}-${k}`]])
    .filter(([, v]) => v && typeof v.s === 'number');

/* Corners. Anchor on the front macros; if the worst back corner is below that
   anchor, drop the subgrade once. */
export function cornerSubgrade(corners) {
  const keys = Object.keys(CORNER_NAME);
  const front = pick(corners, 'front', keys);
  const back = pick(corners, 'back', keys);
  const missing = [];

  if (!front.length) {
    missing.push('no front corner macros');
    if (!back.length) {
      return {
        value: WEIGHTS.UNPHOTOGRAPHED_DEFAULT,
        missing: ['no corner macros on either side'],
        worst: null,
        note: 'No corner photos were supplied, so corners were not assessed.',
        backPenalty: false,
      };
    }
  }

  const basis = front.length ? front : back;
  const anchored = anchor(basis.map(([, v]) => v.s));
  if (front.length && front.length < 4) missing.push(`${4 - front.length} front corner(s) not photographed`);

  let value = anchored;
  let backPenalty = false;
  if (front.length && back.length) {
    const worstBack = Math.min(...back.map(([, v]) => v.s));
    if (worstBack < anchored) {
      value = half(Math.max(1, anchored - WEIGHTS.BACK_CORNER_PENALTY));
      backPenalty = true;
    }
    if (back.length < 4) missing.push(`${4 - back.length} back corner(s) not photographed`);
  } else if (front.length) {
    missing.push('no back corner macros');
  }

  const worstEntry = [...basis].sort((a, b) => a[1].s - b[1].s)[0];
  const side = front.length ? 'front' : 'back';
  return {
    value,
    missing,
    worst: `${side} ${CORNER_NAME[worstEntry[0]]}`,
    backPenalty,
    note: front.length
      ? `Anchored on ${front.length} front macro${front.length === 1 ? '' : 's'}${backPenalty ? ', pulled down 0.5 by the back' : ''}.`
      : 'No front macros — anchored on the back corners alone, which graders weight far less.',
  };
}

/* Edges. Same shape as corners: front anchors, worst back edge can cost 0.5. */
export function edgeSubgrade(edges) {
  const keys = Object.keys(EDGE_NAME);
  const front = pick(edges, 'front', keys);
  const back = pick(edges, 'back', keys);
  const missing = [];

  if (!front.length) {
    return {
      value: WEIGHTS.UNPHOTOGRAPHED_DEFAULT,
      missing: ['no front edge data'],
      worst: null,
      backPenalty: false,
      note: 'The front card photo produced no edge scores.',
    };
  }

  const anchored = anchor(front.map(([, v]) => v.s));
  let value = anchored;
  let backPenalty = false;

  if (back.length) {
    const worstBack = Math.min(...back.map(([, v]) => v.s));
    if (worstBack < anchored) {
      value = half(Math.max(1, anchored - WEIGHTS.BACK_EDGE_PENALTY));
      backPenalty = true;
    }
  } else {
    missing.push('back edges not photographed');
  }

  const worstEntry = [...front].sort((a, b) => a[1].s - b[1].s)[0];
  return {
    value,
    missing,
    worst: `front ${EDGE_NAME[worstEntry[0]]}`,
    backPenalty,
    note: `Anchored on the four front edges${backPenalty ? ', pulled down 0.5 by the back' : ''}.`,
  };
}

/* Surface. Take the front score; a back surface two or more points below it
   costs 0.5. */
export function surfaceSubgrade(surface) {
  const front = surface?.front;
  const back = surface?.back;
  const missing = [];

  if (!front || typeof front.s !== 'number') {
    return {
      value: WEIGHTS.UNPHOTOGRAPHED_DEFAULT,
      missing: ['no front surface data'],
      backPenalty: false,
      flaws: [],
      note: 'The front card photo produced no surface score.',
    };
  }

  let value = half(front.s);
  let backPenalty = false;
  if (back && typeof back.s === 'number') {
    if (front.s - back.s >= WEIGHTS.BACK_SURFACE_GAP) {
      value = half(Math.max(1, value - WEIGHTS.BACK_SURFACE_PENALTY));
      backPenalty = true;
    }
  } else {
    missing.push('back surface not photographed');
  }

  return {
    value,
    missing,
    backPenalty,
    flaws: [
      ...(front.f || []).map((f) => `front: ${f}`),
      ...((back && back.f) || []).map((f) => `back: ${f}`),
    ],
    note: backPenalty
      ? 'Front surface score, pulled down 0.5 — the back is two or more points worse.'
      : 'Front surface score.',
  };
}
