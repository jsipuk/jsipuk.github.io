import Anthropic from '@anthropic-ai/sdk';

/* ─────────────────────────  ROLES  ─────────────────────────
   Ten slots. Only `front-full` is required; everything else degrades. The
   canonical order below is the order images are sent to the model and the
   order the manifest describes them in — the two must never drift apart, so
   both are derived from this one array. */

export const ROLES = [
  'front-full',
  'front-tl',
  'front-tr',
  'front-br',
  'front-bl',
  'back-full',
  'back-tl',
  'back-tr',
  'back-br',
  'back-bl',
];

const ROLE_LABEL = {
  'front-full': 'the full card FRONT',
  'front-tl': 'a macro of the FRONT top-left corner',
  'front-tr': 'a macro of the FRONT top-right corner',
  'front-br': 'a macro of the FRONT bottom-right corner',
  'front-bl': 'a macro of the FRONT bottom-left corner',
  'back-full': 'the full card BACK',
  'back-tl': 'a macro of the BACK top-left corner',
  'back-tr': 'a macro of the BACK top-right corner',
  'back-br': 'a macro of the BACK bottom-right corner',
  'back-bl': 'a macro of the BACK bottom-left corner',
};

const CORNER_ROLES = ROLES.filter((r) => !r.endsWith('-full'));
const EDGE_KEY = (side) => [`${side}-top`, `${side}-right`, `${side}-bottom`, `${side}-left`];

/* ────────────────────  NORMALISATION  ────────────────────
   The model occasionally drops a key or returns a string where an array was
   asked for. Normalising here keeps a bad response from blanking the whole
   report screen. Regions that were never photographed come back as `null`
   rather than a quietly invented 9 — the report says so out loud. */

const half = (n) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));

const cell = (v) => {
  if (!v || typeof v !== 'object') return null;
  const s = typeof v.s === 'number' && isFinite(v.s) ? half(v.s) : null;
  if (s == null) return null;
  return { s, f: typeof v.f === 'string' ? v.f.trim() : '' };
};

const flawList = (f) => {
  if (Array.isArray(f)) return f.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (typeof f === 'string' && f.trim()) return [f.trim()];
  return [];
};

export function normalise(payload, suppliedRoles) {
  const has = (role) => suppliedRoles.includes(role);
  const sides = ['front', 'back'].filter((s) => has(`${s}-full`));

  const corners = {};
  for (const role of CORNER_ROLES) {
    corners[role] = has(role) ? cell(payload?.corners?.[role]) : null;
  }

  const edges = {};
  for (const side of ['front', 'back']) {
    for (const key of EDGE_KEY(side)) {
      edges[key] = sides.includes(side) ? cell(payload?.edges?.[key]) : null;
    }
  }

  const surface = {};
  for (const side of ['front', 'back']) {
    if (!sides.includes(side)) {
      surface[side] = null;
      continue;
    }
    const raw = payload?.surface?.[side];
    const s = typeof raw?.s === 'number' && isFinite(raw.s) ? half(raw.s) : null;
    surface[side] = s == null ? null : { s, f: flawList(raw?.f) };
  }

  return {
    corners,
    edges,
    surface,
    supplied: suppliedRoles,
    imageQuality: ['good', 'fair', 'poor'].includes(payload?.imageQuality) ? payload.imageQuality : 'unknown',
    confidence: typeof payload?.confidence === 'number' ? Math.max(0, Math.min(1, payload.confidence)) : 0.5,
    summary: typeof payload?.summary === 'string' ? payload.summary : '',
  };
}

/* Pull the JSON object out of a response that may carry a preamble or fences.
   Structured outputs make this near-redundant, but it costs nothing and saves
   the report screen if the format constraint is ever dropped. */
export function extractJSON(text) {
  const stripped = text.replace(/```json|```/g, '').trim();
  const a = stripped.indexOf('{');
  const b = stripped.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) throw new Error('No JSON object found.');
  return JSON.parse(stripped.slice(a, b + 1));
}

/* ─────────────────────  REQUEST BUILDING  ───────────────────── */

const CELL_SCHEMA = {
  type: 'object',
  properties: {
    s: { type: 'number' },
    f: { type: 'string' },
  },
  required: ['s', 'f'],
  additionalProperties: false,
};

const SURFACE_SCHEMA = {
  type: 'object',
  properties: {
    s: { type: 'number' },
    f: { type: 'array', items: { type: 'string' } },
  },
  required: ['s', 'f'],
  additionalProperties: false,
};

const objectOf = (keys, schema) => ({
  type: 'object',
  properties: Object.fromEntries(keys.map((k) => [k, schema])),
  required: keys,
  additionalProperties: false,
});

function buildSchema(suppliedRoles, sides) {
  const cornerKeys = CORNER_ROLES.filter((r) => suppliedRoles.includes(r));
  const edgeKeys = sides.flatMap(EDGE_KEY);

  const properties = {
    edges: objectOf(edgeKeys, CELL_SCHEMA),
    surface: objectOf(sides, SURFACE_SCHEMA),
    imageQuality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    confidence: { type: 'number' },
    summary: { type: 'string' },
  };
  if (cornerKeys.length) properties.corners = objectOf(cornerKeys, CELL_SCHEMA);

  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function buildPrompt(suppliedRoles, sides) {
  const manifest = suppliedRoles
    .map((role, i) => `  [${i + 1}] ${role} — ${ROLE_LABEL[role]}`)
    .join('\n');

  const cornerKeys = CORNER_ROLES.filter((r) => suppliedRoles.includes(r));
  const cornerLine = cornerKeys.length
    ? `Corners: score ONLY these, one entry each, keyed exactly as listed — ${cornerKeys.join(', ')}. Judge each from its own macro. Look for whitening, fraying, dings, rounding and layer separation.`
    : 'Corners: no corner macros were supplied. Omit the "corners" key entirely — do not guess corner condition from the full-card shots.';

  const edgeKeys = sides.flatMap(EDGE_KEY);
  const surfaceLine = sides
    .map((s) => `"${s}"`)
    .join(' and ');

  return `You are a trading-card condition inspector. Grade on the Beckett half-point scale (1.0-10.0, steps of 0.5) where 10 is flawless under magnification and 9 means one minor flaw visible.

Images are supplied in this exact order:
${manifest}

Judge only what is actually visible. If an image is blurry, glared or too low-resolution to assess a region, score it conservatively and say so in that region's flaw text. Do not invent defects. Ignore centering entirely — it is measured separately with calipers.

${cornerLine}

Edges: score each of ${edgeKeys.join(', ')}. Read each edge primarily from its side's full-card shot, but cross-check against the corner macros for that side — the macros show where each edge terminates and often reveal chipping the full-card shot is too coarse to resolve. Look for chipping, whitening, rough cuts and dents.

Surface: score ${surfaceLine} separately from the corresponding full-card shot. Look for scratches, scuffs, print lines, print dots, gloss breaks, indentations and staining. Return each side's flaws as an array of short strings.

Set imageQuality to your overall read on the photography, confidence to how much you would stand behind these numbers, and summary to one sentence on what limits this card.`;
}

/* ─────────────────────────  THE CALL  ───────────────────────── */

export async function runInspection({ images, sides, apiKey, model }) {
  if (!Array.isArray(images) || !images.length) throw new Error('No images were sent.');

  const byRole = new Map();
  for (const img of images) {
    if (!img || !ROLES.includes(img.role)) throw new Error(`Unknown image role: ${img?.role}`);
    if (typeof img.dataUrl !== 'string' || !img.dataUrl.startsWith('data:image/jpeg;base64,')) {
      throw new Error(`Image for ${img.role} was not a base64 JPEG data URL.`);
    }
    byRole.set(img.role, img.dataUrl);
  }
  if (!byRole.has('front-full')) throw new Error('The front full-card photo is required.');

  // Canonical order, not whatever order the client happened to send.
  const suppliedRoles = ROLES.filter((r) => byRole.has(r));
  const sideList = ['front', 'back'].filter(
    (s) => byRole.has(`${s}-full`) && (sides ? sides[s] !== false : true),
  );

  const client = new Anthropic({ apiKey });

  const content = [
    ...suppliedRoles.map((role) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: byRole.get(role).split(',')[1],
      },
    })),
    { type: 'text', text: buildPrompt(suppliedRoles, sideList) },
  ];

  let response;
  try {
    response = await client.messages.create({
      model,
      /* Eight corners, eight edges and two surface blocks do not fit in the
         1000 the single-image artifact used. On claude-opus-5 thinking is on
         by default and shares this budget with the response, so the ceiling
         has to clear both — 2500 would truncate the JSON mid-object. */
      max_tokens: 8000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: buildSchema(suppliedRoles, sideList) },
      },
      messages: [{ role: 'user', content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      throw new Error('Rate limited by the Anthropic API. Wait a moment and inspect again.');
    }
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error('The Anthropic API rejected your key. Check ANTHROPIC_API_KEY in .env.');
    }
    if (e instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error ${e.status}: ${e.message}`);
    }
    throw e;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to inspect these images.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The inspection ran past its token ceiling and came back incomplete. Try again.');
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = normalise(extractJSON(text), suppliedRoles);

  return {
    inspection: parsed,
    meta: {
      model: response.model,
      usage: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
      supplied: suppliedRoles,
      sides: sideList,
    },
  };
}
