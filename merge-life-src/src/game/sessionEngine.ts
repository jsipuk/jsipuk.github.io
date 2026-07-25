import type {
  ActiveSessionState,
  GameSettings,
  SaveGame,
  Session,
  SessionEndReason,
  SessionLengthMinutes,
} from '@/types';
import { createId } from '@/utils/ids';
import {
  DAY_MS,
  dayKey,
  daysBetween,
  dayKeysInMonth,
  MINUTE_MS,
  startOfMonth,
  startOfWeek,
} from '@/utils/time';

/** Grace window after the timer expires, so an in-progress merge can finish. */
export const GRACE_PERIOD_MS = 30_000;
/** How long before the end the calm "two minutes left" notice appears. */
export const TWO_MINUTE_NOTICE_MS = 2 * MINUTE_MS;
export const DEFAULT_SESSION_MINUTES: SessionLengthMinutes = 10;
export const DEFAULT_MAX_SESSIONS_PER_DAY = 2;
/** Default previous weekly gaming baseline: 9 hours 10 minutes. */
export const DEFAULT_WEEKLY_BASELINE_MINUTES = 9 * 60 + 10;

export const SESSION_LENGTH_OPTIONS: { minutes: SessionLengthMinutes; label: string }[] = [
  { minutes: 5, label: 'Quick Session' },
  { minutes: 10, label: 'Standard Session' },
  { minutes: 15, label: 'Longer Session' },
];

export type SessionPhase = 'idle' | 'running' | 'final-minutes' | 'grace' | 'ended';

/* ------------------------------------------------------------------ */
/* Daily limits                                                        */
/* ------------------------------------------------------------------ */

export function sessionsOnDay(sessions: Session[], timestamp: number): Session[] {
  const key = dayKey(timestamp);
  return sessions.filter((session) => session.dayKey === key);
}

export function sessionsUsedToday(sessions: Session[], now = Date.now()): number {
  return sessionsOnDay(sessions, now).length;
}

export interface DailyLimitState {
  used: number;
  limit: number;
  canStart: boolean;
  /** True when the workshop is open but read-only for the rest of the day. */
  viewingOnly: boolean;
}

export function dailyLimitState(save: SaveGame, now = Date.now()): DailyLimitState {
  const used = sessionsUsedToday(save.sessions, now);
  const limit = save.settings.maxSessionsPerDay;
  return {
    used,
    limit,
    canStart: used < limit,
    viewingOnly: used >= limit,
  };
}

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                   */
/* ------------------------------------------------------------------ */

export function createSession(
  minutes: SessionLengthMinutes,
  now = Date.now(),
  id = createId('session'),
): Session {
  return {
    id,
    startedAt: now,
    endedAt: null,
    plannedDurationMs: minutes * MINUTE_MS,
    actualDurationMs: 0,
    endedOnTime: false,
    endReason: null,
    itemsCreated: 0,
    merges: 0,
    ordersCompleted: 0,
    discoveries: [],
    watchesCompleted: 0,
    progressEarned: 0,
    dayKey: dayKey(now),
  };
}

export function createActiveSessionState(session: Session): ActiveSessionState {
  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    plannedDurationMs: session.plannedDurationMs,
    graceStartedAt: null,
    twoMinuteNoticeShown: false,
  };
}

export function timeRemaining(active: ActiveSessionState, now = Date.now()): number {
  return Math.max(0, active.startedAt + active.plannedDurationMs - now);
}

export function graceRemaining(active: ActiveSessionState, now = Date.now()): number {
  const expiresAt = active.startedAt + active.plannedDurationMs;
  if (now < expiresAt) return GRACE_PERIOD_MS;
  return Math.max(0, expiresAt + GRACE_PERIOD_MS - now);
}

export function sessionPhase(
  active: ActiveSessionState | null,
  now = Date.now(),
): SessionPhase {
  if (!active) return 'idle';
  const remaining = timeRemaining(active, now);
  if (remaining > TWO_MINUTE_NOTICE_MS) return 'running';
  if (remaining > 0) return 'final-minutes';
  if (graceRemaining(active, now) > 0) return 'grace';
  return 'ended';
}

/** Generators stop dispensing once the planned time is up. */
export function generatorsEnabled(active: ActiveSessionState | null, now = Date.now()): boolean {
  if (!active) return false;
  return timeRemaining(active, now) > 0;
}

/** Merges and moves stay allowed through the grace window. */
export function interactionsEnabled(active: ActiveSessionState | null, now = Date.now()): boolean {
  if (!active) return false;
  const phase = sessionPhase(active, now);
  return phase === 'running' || phase === 'final-minutes' || phase === 'grace';
}

export function shouldShowTwoMinuteNotice(
  active: ActiveSessionState | null,
  now = Date.now(),
): boolean {
  if (!active || active.twoMinuteNoticeShown) return false;
  const remaining = timeRemaining(active, now);
  return remaining <= TWO_MINUTE_NOTICE_MS && remaining > 0;
}

export interface CloseSessionOptions {
  now?: number;
  reason?: SessionEndReason;
}

/**
 * Closes a session, recording an honest duration. A session counts as "ended on
 * time" when the player let the timer finish, or closed within the grace window.
 * Play time is capped at the planned length plus grace so a forgotten tab can
 * never inflate the wellbeing figures.
 */
export function closeSession(session: Session, options: CloseSessionOptions = {}): Session {
  const now = options.now ?? Date.now();
  const reason = options.reason ?? 'player';
  const plannedEnd = session.startedAt + session.plannedDurationMs;
  const actualDurationMs = Math.max(
    0,
    Math.min(now, plannedEnd + GRACE_PERIOD_MS) - session.startedAt,
  );
  const endedOnTime = reason === 'timer' || now >= plannedEnd - 1000;

  return {
    ...session,
    endedAt: now,
    actualDurationMs,
    endedOnTime,
    endReason: reason,
  };
}

/**
 * Recovers a session that was interrupted (tab closed, device asleep) without a
 * clean exit. The recorded duration is capped at the planned length plus grace,
 * so an abandoned tab never inflates play time.
 */
export function recoverInterruptedSession(
  session: Session,
  active: ActiveSessionState,
  now = Date.now(),
): Session {
  const cap = active.startedAt + active.plannedDurationMs + GRACE_PERIOD_MS;
  const endedAt = Math.min(now, cap);
  return {
    ...session,
    endedAt,
    actualDurationMs: Math.max(0, endedAt - session.startedAt),
    endedOnTime: now >= active.startedAt + active.plannedDurationMs,
    endReason: 'interrupted',
  };
}

/* ------------------------------------------------------------------ */
/* Wellbeing figures                                                   */
/* ------------------------------------------------------------------ */

function completedSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => session.endedAt !== null);
}

/**
 * How long a session has actually taken. A session still in progress counts the
 * time elapsed so far, capped at its planned length plus grace, so the numbers
 * the player sees are true while they are playing rather than only afterwards.
 */
export function sessionDuration(session: Session, now = Date.now()): number {
  if (session.endedAt !== null) return session.actualDurationMs;
  const cap = session.startedAt + session.plannedDurationMs + GRACE_PERIOD_MS;
  return Math.max(0, Math.min(now, cap) - session.startedAt);
}

export function playTimeBetween(
  sessions: Session[],
  from: number,
  to: number,
  now = Date.now(),
): number {
  return sessions
    .filter((session) => session.startedAt >= from && session.startedAt < to)
    .reduce((total, session) => total + sessionDuration(session, now), 0);
}

export function playTimeToday(sessions: Session[], now = Date.now()): number {
  const key = dayKey(now);
  return sessions
    .filter((session) => session.dayKey === key)
    .reduce((total, session) => total + sessionDuration(session, now), 0);
}

export function playTimeThisWeek(sessions: Session[], now = Date.now()): number {
  return playTimeBetween(sessions, startOfWeek(now), now + DAY_MS, now);
}

export function playTimeThisMonth(sessions: Session[], now = Date.now()): number {
  return playTimeBetween(sessions, startOfMonth(now), now + DAY_MS, now);
}

/**
 * Time reclaimed = the player's previous weekly gaming baseline minus the time
 * they have actually spent in Merge Life this week. Never negative-framed: if
 * they play more than their baseline the figure is simply zero.
 */
export function timeReclaimedThisWeek(
  sessions: Session[],
  settings: GameSettings,
  now = Date.now(),
): number {
  const baselineMs = settings.weeklyBaselineMinutes * MINUTE_MS;
  const played = playTimeThisWeek(sessions, now);
  return Math.max(0, baselineMs - played);
}

export function averageSessionLength(sessions: Session[]): number {
  const finished = completedSessions(sessions);
  if (finished.length === 0) return 0;
  const total = finished.reduce((sum, session) => sum + session.actualDurationMs, 0);
  return Math.round(total / finished.length);
}

export interface MonthlyPlayDays {
  daysPlayed: number;
  daysNotPlayed: number;
  totalDaysConsidered: number;
}

/** Counts days played so far this month; future days are not counted as missed. */
export function monthlyPlayDays(sessions: Session[], now = Date.now()): MonthlyPlayDays {
  const monthKeys = dayKeysInMonth(now);
  const todayKey = dayKey(now);
  const elapsed = monthKeys.filter((key) => key <= todayKey);
  const played = new Set(
    sessions.map((session) => session.dayKey).filter((key) => elapsed.includes(key)),
  );
  return {
    daysPlayed: played.size,
    daysNotPlayed: elapsed.length - played.size,
    totalDaysConsidered: elapsed.length,
  };
}

/**
 * Longest run of consecutive days with no play, in days. Reported neutrally —
 * breaks are fine, and nothing is lost by taking them.
 */
export function longestBreakDays(sessions: Session[], now = Date.now()): number {
  const keys = Array.from(new Set(completedSessions(sessions).map((session) => session.dayKey))).sort();
  if (keys.length === 0) return 0;

  let longest = 0;
  for (let i = 1; i < keys.length; i += 1) {
    longest = Math.max(longest, daysBetween(keys[i - 1], keys[i]) - 1);
  }
  const sinceLast = daysBetween(keys[keys.length - 1], dayKey(now)) - 1;
  return Math.max(longest, Math.max(0, sinceLast));
}

export function sessionsEndedOnTime(sessions: Session[]): number {
  return completedSessions(sessions).filter((session) => session.endedOnTime).length;
}

export interface WellbeingSummary {
  today: number;
  week: number;
  month: number;
  totalSessions: number;
  averageSessionMs: number;
  endedOnTime: number;
  daysPlayedThisMonth: number;
  daysNotPlayedThisMonth: number;
  longestBreakDays: number;
  timeReclaimedThisWeek: number;
  totalWatchesBuilt: number;
}

export function wellbeingSummary(save: SaveGame, now = Date.now()): WellbeingSummary {
  const { sessions, settings, collection } = save;
  const monthly = monthlyPlayDays(sessions, now);
  return {
    today: playTimeToday(sessions, now),
    week: playTimeThisWeek(sessions, now),
    month: playTimeThisMonth(sessions, now),
    totalSessions: completedSessions(sessions).length,
    averageSessionMs: averageSessionLength(sessions),
    endedOnTime: sessionsEndedOnTime(sessions),
    daysPlayedThisMonth: monthly.daysPlayed,
    daysNotPlayedThisMonth: monthly.daysNotPlayed,
    longestBreakDays: longestBreakDays(sessions, now),
    timeReclaimedThisWeek: timeReclaimedThisWeek(sessions, settings, now),
    totalWatchesBuilt: collection.length,
  };
}
