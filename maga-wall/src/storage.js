/* Local persistence: settings, high scores, and a run counter.
 *
 * Deliberately does NOT touch entitlement — that lives in its own store under
 * its own key so a corrupt or cleared purchase record can never take the
 * player's high score with it, and vice versa.
 *
 * Every read is defensive. localStorage throws in private mode on some
 * browsers, and a half-written JSON blob should degrade to defaults rather
 * than a white screen.
 */

const K_SETTINGS = 'magawall.settings.v1';
const K_SCORES = 'magawall.scores.v1';

export const DEFAULT_SETTINGS = {
  music: true,
  sfx: true,
  crt: true,
  shake: true,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return { ...fallback };
    return { ...fallback, ...v };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;   // private mode, quota, disabled storage — all survivable
  }
}

export function loadSettings() {
  const s = read(K_SETTINGS, DEFAULT_SETTINGS);
  for (const k of Object.keys(DEFAULT_SETTINGS)) s[k] = !!s[k];
  return s;
}

export const saveSettings = (s) => write(K_SETTINGS, s);

const DEFAULT_SCORES = { best: 0, bestWave: 0, runs: 0, table: [] };

export function loadScores() {
  const s = read(K_SCORES, DEFAULT_SCORES);
  s.best = Number(s.best) || 0;
  s.bestWave = Number(s.bestWave) || 0;
  s.runs = Number(s.runs) || 0;
  s.table = Array.isArray(s.table) ? s.table.slice(0, 5) : [];
  return s;
}

/**
 * Record a finished run. Returns the updated store plus whether it was a
 * personal best, so the game-over screen can make a fuss about it.
 */
export function recordRun(score, wave) {
  const s = loadScores();
  const isBest = score > s.best;
  s.best = Math.max(s.best, score);
  s.bestWave = Math.max(s.bestWave, wave);
  s.runs += 1;
  s.table.push({ score, wave, at: Date.now() });
  s.table.sort((a, b) => b.score - a.score);
  s.table = s.table.slice(0, 5);
  write(K_SCORES, s);
  return { scores: s, isBest };
}

/** Used by the trial gate. Counting starts before a run, not after it. */
export function countStart() {
  const s = loadScores();
  s.runs += 1;
  write(K_SCORES, s);
  return s.runs;
}

export function resetScores() {
  const s = { ...DEFAULT_SCORES };
  write(K_SCORES, s);
  return s;
}

/** True when the browser will actually keep anything we write. */
export function storageAvailable() {
  try {
    localStorage.setItem('magawall.probe', '1');
    localStorage.removeItem('magawall.probe');
    return true;
  } catch {
    return false;
  }
}
