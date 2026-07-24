import type { Config } from 'tailwindcss';

/**
 * Warm workshop palette. Everything is expressed through CSS custom properties
 * so the high-contrast accessibility mode can re-theme the whole app by
 * swapping variables on <html> rather than by duplicating class names.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--ml-surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--ml-surface-raised) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--ml-surface-sunken) / <alpha-value>)',
        ink: 'rgb(var(--ml-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ml-ink-soft) / <alpha-value>)',
        'ink-faint': 'rgb(var(--ml-ink-faint) / <alpha-value>)',
        line: 'rgb(var(--ml-line) / <alpha-value>)',
        brass: 'rgb(var(--ml-brass) / <alpha-value>)',
        sage: 'rgb(var(--ml-sage) / <alpha-value>)',
        slate: 'rgb(var(--ml-slate) / <alpha-value>)',
        clay: 'rgb(var(--ml-clay) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1.25rem',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(60 42 28 / 0.06), 0 12px 28px -18px rgb(60 42 28 / 0.45)',
        raised: '0 2px 4px rgb(60 42 28 / 0.08), 0 22px 40px -24px rgb(60 42 28 / 0.55)',
        inset: 'inset 0 1px 2px rgb(60 42 28 / 0.12)',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'gentle-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'gentle-in': 'gentle-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
