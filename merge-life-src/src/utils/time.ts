/**
 * Local-time helpers.
 *
 * Everything in Merge Life is measured against the player's local calendar so
 * "today" means what they expect, including across daylight-saving changes.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Local calendar day key, e.g. "2026-07-24". */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Start of the ISO week (Monday) containing `timestamp`, in local time. */
export function startOfWeek(timestamp: number): number {
  const date = new Date(startOfDay(timestamp));
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - weekday);
  return date.getTime();
}

export function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function daysInMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Whole days between two day keys (b - a). */
export function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`).getTime();
  const b = new Date(`${bKey}T00:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function isSameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}

/** "8 hours 20 minutes", "45 minutes", "0 minutes". Never abbreviated to noise. */
export function formatDuration(ms: number, options: { short?: boolean } = {}): string {
  const safe = Math.max(0, Math.round(ms));
  const totalMinutes = Math.floor(safe / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (options.short) {
    if (safe > 0 && totalMinutes === 0) return `${Math.max(1, Math.round(safe / 1000))}s`;
    if (hours === 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  if (safe > 0 && totalMinutes === 0) return 'less than a minute';

  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  if (hours === 0) return minuteLabel;
  if (minutes === 0) return hourLabel;
  return `${hourLabel} and ${minuteLabel}`;
}

/** "09:58" style countdown for the session timer. */
export function formatCountdown(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** All day keys in the local month containing `timestamp`. */
export function dayKeysInMonth(timestamp: number): string[] {
  const start = startOfMonth(timestamp);
  const total = daysInMonth(timestamp);
  const keys: string[] = [];
  for (let i = 0; i < total; i += 1) {
    keys.push(dayKey(start + i * DAY_MS + HOUR_MS * 6));
  }
  return keys;
}
