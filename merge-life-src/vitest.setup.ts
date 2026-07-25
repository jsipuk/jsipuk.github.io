import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// jsdom does not implement matchMedia; several components query it for
// prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!('structuredClone' in globalThis)) {
  (globalThis as unknown as { structuredClone: unknown }).structuredClone = (value: unknown) =>
    JSON.parse(JSON.stringify(value));
}

vi.stubGlobal('scrollTo', () => {});
