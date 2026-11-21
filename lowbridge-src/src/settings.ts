// Per-device preferences and the M0 lap log. Browser storage can be missing or
// throw (private mode, blocked site data), so every access is guarded and the
// game runs without it. Story progress moves to IndexedDB in M1.

import type { SteeringPreset } from './rules/controls.ts';
import type { LapRecord } from './rules/session.ts';

const SETTINGS_KEY = 'lowbridge.settings.v1';
const LAPS_KEY = 'lowbridge.m0.laps.v1';
const MAX_LAPS = 40;

export interface Settings {
  preset: SteeringPreset;
  muted: boolean;
  /** null follows the system setting. */
  reduceMotion: boolean | null;
}

export interface StoredLap extends LapRecord {
  build: string;
  at: string;
}

const DEFAULTS: Settings = { preset: 'pad', muted: false, reduceMotion: null };

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
    preset: s.preset === 'wheel' ? 'wheel' : DEFAULTS.preset,
    muted: s.muted === true,
    reduceMotion: typeof s.reduceMotion === 'boolean' ? s.reduceMotion : null,
  };
}

export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);

export function loadLaps(): StoredLap[] {
  const laps = read<StoredLap[]>(LAPS_KEY);
  return Array.isArray(laps) ? laps.filter((l) => l && typeof l.lapSeconds === 'number').slice(-MAX_LAPS) : [];
}

export function appendLap(record: LapRecord, build: string): StoredLap[] {
  const laps = [...loadLaps(), { ...record, build, at: new Date().toISOString() }].slice(-MAX_LAPS);
  write(LAPS_KEY, laps);
  return laps;
}

export function clearLaps(): void {
  write(LAPS_KEY, []);
}

export function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
