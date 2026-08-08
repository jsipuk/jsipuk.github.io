/* Design tokens, lifted from the artifact unchanged. Split into their own
   module only so Caliper and SlabLabel can import them without reaching back
   into App and creating a cycle. */

export const C = {
  bench: '#0F1419',
  panel: '#171F27',
  panel2: '#1E2830',
  rule: '#2C3A46',
  ink: '#E9EDF1',
  muted: '#8298AC',
  faint: '#5A6E80',
  amber: '#F0B429',
  steel: '#5AA0F2',
  paper: '#F4F2EC',
};

export const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
`;

export const sans = "'Archivo', system-ui, sans-serif";
export const serif = "'Instrument Serif', Georgia, serif";
export const mono = "'JetBrains Mono', ui-monospace, monospace";
