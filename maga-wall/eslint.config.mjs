/* Enough linting to catch the mistakes that actually happen here: a typo'd
 * identifier, a stranded import, a duplicated object key. No style rules —
 * the code is hand-formatted and consistent already.
 *
 *   npx eslint .
 */

const BROWSER = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  history: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  performance: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  console: 'readonly', fetch: 'readonly', AudioContext: 'readonly', webkitAudioContext: 'readonly',
  Response: 'readonly', Request: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  crypto: 'readonly', btoa: 'readonly', atob: 'readonly', TextEncoder: 'readonly',
  caches: 'readonly', self: 'readonly', Promise: 'readonly',
};

const NODE = {
  process: 'readonly', Buffer: 'readonly', console: 'readonly',
  setTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', Response: 'readonly', Request: 'readonly',
  crypto: 'readonly', btoa: 'readonly', atob: 'readonly', TextEncoder: 'readonly',
  globalThis: 'readonly', fetch: 'writable', performance: 'readonly',
};

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unreachable': 'error',
  'no-const-assign': 'error',
  'no-self-assign': 'error',
  'no-fallthrough': 'error',
  'no-cond-assign': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  eqeqeq: ['error', 'smart'],
};

export default [
  { ignores: ['node_modules/**', '.wrangler/**'] },
  {
    files: ['public/src/**/*.js', 'public/sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: BROWSER },
    rules,
  },
  {
    // Cloudflare Workers: browser-shaped globals, no DOM.
    files: ['functions/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: BROWSER },
    rules,
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: NODE },
    rules,
  },
];
