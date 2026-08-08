/* ══════════════════════  CONSAU BRAND TOKENS  ══════════════════════
   Gradebench is a CONSAU product. Everything below traces back to the
   CONSAU brand guidelines; anything derived is marked as such so the
   canonical palette stays unambiguous. */

/* ── The palette, verbatim from the guidelines ── */
export const BRAND = {
  deepNavy: '#0B1320',   // foundation — ~60% of any surface
  teal: '#00BFA6',       // accent — ~20%
  oceanBlue: '#2563EB',  // energy — ~10%
  mistGreen: '#7EE2B8',
  warmWhite: '#F7F7F5',
  slate: '#6B7280',
};

/* ── Derived UI surfaces ──
   Not new brand colours: tints of Deep Navy for panels and rules, and
   lifts of Slate for text that has to stay legible on a dark ground
   (Slate itself fails contrast as body copy on Deep Navy). */
const SURFACE = {
  panel: '#131D2E',
  panel2: '#1B2739',
  rule: '#22304A',
  slateLift: '#93A1B5',  // Slate, lifted for body text on navy
  slateDim: '#61728B',   // Slate, dimmed for captions on navy
};

/* ── Semantic colours ──
   The guidelines have no caution or negative colour. A grading tool has to
   say "this corner is damaged", so these two sit outside the palette,
   deliberately muted so they never compete with Teal for attention.
   Severity is always icon + word as well as colour — never colour alone. */
const SEMANTIC = {
  caution: '#E0A33C',
  negative: '#E8825A',
};

export const C = {
  // surfaces
  navy: BRAND.deepNavy,
  panel: SURFACE.panel,
  panel2: SURFACE.panel2,
  rule: SURFACE.rule,
  // text
  ink: BRAND.warmWhite,
  muted: SURFACE.slateLift,
  faint: SURFACE.slateDim,
  // brand accents
  teal: BRAND.teal,
  blue: BRAND.oceanBlue,
  mist: BRAND.mistGreen,
  white: BRAND.warmWhite,
  slate: BRAND.slate,
  // semantic
  caution: SEMANTIC.caution,
  negative: SEMANTIC.negative,
};

/* ── Typography ──
   Inter is the CONSAU typeface. One family, four weights, no exceptions —
   which is why numeric readouts use tabular figures rather than a mono face.
   The family itself is bundled from @fontsource-variable/inter in main.jsx,
   so there is no webfont request to fail. */
export const font = "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const W = {
  light: 300,     // captions / supporting text
  regular: 400,   // body copy / UI text
  semibold: 600,  // subheadings / emphasis
  bold: 700,      // headings / impact
};

/* Label style used for section eyebrows — replaces the old mono treatment. */
export const eyebrow = {
  fontWeight: W.semibold,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

/* Figures that update in place (grades, ratios, token counts) get tabular
   numerals so they stop jittering as digits change. */
export const numeric = {
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.01em',
};
