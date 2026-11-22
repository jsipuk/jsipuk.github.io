// Per-device preferences. Browser storage can be missing or
// throw (private mode, blocked site data), so every access is guarded and the
// game runs without it. Story progress is saved in IndexedDB (src/rules/save.ts).

import type { SteeringPreset } from './rules/controls.ts';
import { DEFAULT_PRESET } from './rules/controls.ts';
import { DEFAULT_JACKET, JACKETS } from './art.ts';

const SETTINGS_KEY = 'lowbridge.settings.v1';

export interface Settings {
  preset: SteeringPreset;
  muted: boolean;
  /** null follows the system setting. */
  reduceMotion: boolean | null;
  jacket: string;
}

const DEFAULTS: Settings = { preset: DEFAULT_PRESET, muted: false, reduceMotion: null, jacket: DEFAULT_JACKET };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are a convenience; the session carries on without them.
  }
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY) ?? {};
  return {
    // Saved choices of the retired steering B fall back to the default.
    preset: s.preset === 'pad' || s.preset === 'hybrid' ? s.preset : DEFAULTS.preset,
    muted: s.muted === true,
    reduceMotion: typeof s.reduceMotion === 'boolean' ? s.reduceMotion : null,
    jacket: JACKETS.some((j) => j.id === s.jacket) ? (s.jacket as string) : DEFAULTS.jacket,
  };
}

export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);

export function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
