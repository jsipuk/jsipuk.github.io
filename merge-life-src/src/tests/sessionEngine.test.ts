import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '@/db/defaultSave';
import {
  averageSessionLength,
  closeSession,
  createActiveSessionState,
  createSession,
  dailyLimitState,
  DEFAULT_WEEKLY_BASELINE_MINUTES,
  generatorsEnabled,
  GRACE_PERIOD_MS,
  interactionsEnabled,
  longestBreakDays,
  monthlyPlayDays,
  playTimeThisWeek,
  playTimeToday,
  recoverInterruptedSession,
  sessionPhase,
  sessionsUsedToday,
  shouldShowTwoMinuteNotice,
  timeReclaimedThisWeek,
  timeRemaining,
  wellbeingSummary,
} from '@/game/sessionEngine';
import type { SaveGame, Session } from '@/types';
import { dayKey, DAY_MS, formatDuration, MINUTE_MS } from '@/utils/time';

const START = new Date('2026-07-24T10:00:00').getTime();

function finishedSession(startedAt: number, minutes: number, endedOnTime = true): Session {
  return {
    id: `s-${startedAt}`,
    startedAt,
    endedAt: startedAt + minutes * MINUTE_MS,
    plannedDurationMs: 10 * MINUTE_MS,
    actualDurationMs: minutes * MINUTE_MS,
    endedOnTime,
    endReason: endedOnTime ? 'timer' : 'player',
    itemsCreated: 0,
    merges: 0,
    ordersCompleted: 0,
    discoveries: [],
    watchesCompleted: 0,
    progressEarned: 0,
    dayKey: dayKey(startedAt),
  };
}

describe('session timer', () => {
  it('counts down from the planned length', () => {
    const session = createSession(10, START);
    const active = createActiveSessionState(session);
    expect(timeRemaining(active, START)).toBe(10 * MINUTE_MS);
    expect(timeRemaining(active, START + 4 * MINUTE_MS)).toBe(6 * MINUTE_MS);
    expect(timeRemaining(active, START + 30 * MINUTE_MS)).toBe(0);
  });

  it('moves through running, final minutes, grace and ended', () => {
    const active = createActiveSessionState(createSession(10, START));
    expect(sessionPhase(active, START)).toBe('running');
    expect(sessionPhase(active, START + 8 * MINUTE_MS + 1)).toBe('final-minutes');
    expect(sessionPhase(active, START + 10 * MINUTE_MS)).toBe('grace');
    expect(sessionPhase(active, START + 10 * MINUTE_MS + GRACE_PERIOD_MS)).toBe('ended');
    expect(sessionPhase(null, START)).toBe('idle');
  });

  it('shows the two-minute notice exactly once', () => {
    const active = createActiveSessionState(createSession(10, START));
    expect(shouldShowTwoMinuteNotice(active, START + 7 * MINUTE_MS)).toBe(false);
    expect(shouldShowTwoMinuteNotice(active, START + 8 * MINUTE_MS + 1)).toBe(true);
    const shown = { ...active, twoMinuteNoticeShown: true };
    expect(shouldShowTwoMinuteNotice(shown, START + 8 * MINUTE_MS + 1)).toBe(false);
  });

  it('disables generators at the end but allows 30 seconds to finish a merge', () => {
    const active = createActiveSessionState(createSession(5, START));
    const justAfter = START + 5 * MINUTE_MS + 1000;

    expect(generatorsEnabled(active, START + MINUTE_MS)).toBe(true);
    expect(generatorsEnabled(active, justAfter)).toBe(false);
    expect(interactionsEnabled(active, justAfter)).toBe(true);
    expect(interactionsEnabled(active, START + 5 * MINUTE_MS + GRACE_PERIOD_MS + 1)).toBe(false);
  });

  it('closes a session with an honest duration', () => {
    const session = createSession(10, START);
    const closed = closeSession(session, { now: START + 6 * MINUTE_MS, reason: 'player' });
    expect(closed.actualDurationMs).toBe(6 * MINUTE_MS);
    expect(closed.endedOnTime).toBe(false);
    expect(closed.endedAt).toBe(START + 6 * MINUTE_MS);
  });

  it('counts a timer-ended session as ended on time', () => {
    const session = createSession(10, START);
    const closed = closeSession(session, { now: START + 10 * MINUTE_MS, reason: 'timer' });
    expect(closed.endedOnTime).toBe(true);
  });

  it('caps recorded time for an abandoned tab', () => {
    const session = createSession(10, START);
    const active = createActiveSessionState(session);
    const recovered = recoverInterruptedSession(session, active, START + 6 * 60 * MINUTE_MS);
    expect(recovered.actualDurationMs).toBe(10 * MINUTE_MS + GRACE_PERIOD_MS);
    expect(recovered.endReason).toBe('interrupted');
  });
});

describe('duration formatting', () => {
  it('never reports a real session as zero', () => {
    expect(formatDuration(0, { short: true })).toBe('0m');
    expect(formatDuration(35_000, { short: true })).toBe('35s');
    expect(formatDuration(35_000)).toBe('less than a minute');
    expect(formatDuration(9 * MINUTE_MS, { short: true })).toBe('9m');
    expect(formatDuration((8 * 60 + 20) * MINUTE_MS)).toBe('8 hours and 20 minutes');
  });
});

describe('daily session limits', () => {
  function saveWithSessions(sessions: Session[], maxPerDay = 2): SaveGame {
    const save = createDefaultSave({ now: START });
    return { ...save, sessions, settings: { ...save.settings, maxSessionsPerDay: maxPerDay } };
  }

  it('allows two sessions a day by default', () => {
    const save = saveWithSessions([finishedSession(START, 10)]);
    const state = dailyLimitState(save, START + MINUTE_MS);
    expect(state.used).toBe(1);
    expect(state.limit).toBe(2);
    expect(state.canStart).toBe(true);
    expect(state.viewingOnly).toBe(false);
  });

  it('switches to viewing mode after the limit is reached', () => {
    const save = saveWithSessions([
      finishedSession(START, 10),
      finishedSession(START + 60 * MINUTE_MS, 10),
    ]);
    const state = dailyLimitState(save, START + 2 * 60 * MINUTE_MS);
    expect(state.canStart).toBe(false);
    expect(state.viewingOnly).toBe(true);
  });

  it('resets at the calendar day rollover, not 24 hours later', () => {
    const lateSession = finishedSession(new Date('2026-07-24T23:40:00').getTime(), 10);
    const save = saveWithSessions([lateSession, { ...lateSession, id: 'late-2' }]);

    const justBeforeMidnight = new Date('2026-07-24T23:55:00').getTime();
    const justAfterMidnight = new Date('2026-07-25T00:05:00').getTime();

    expect(dailyLimitState(save, justBeforeMidnight).canStart).toBe(false);
    expect(dailyLimitState(save, justAfterMidnight).canStart).toBe(true);
    expect(sessionsUsedToday(save.sessions, justAfterMidnight)).toBe(0);
  });

  it('honours a raised limit from settings', () => {
    const save = saveWithSessions(
      [finishedSession(START, 10), finishedSession(START + MINUTE_MS, 10)],
      4,
    );
    expect(dailyLimitState(save, START + 2 * MINUTE_MS).canStart).toBe(true);
  });
});

describe('wellbeing figures', () => {
  it('adds up play time for today and this week', () => {
    const sessions = [
      finishedSession(START, 10),
      finishedSession(START - DAY_MS, 15),
      finishedSession(START - 20 * DAY_MS, 30),
    ];
    expect(playTimeToday(sessions, START)).toBe(10 * MINUTE_MS);
    const week = playTimeThisWeek(sessions, START);
    expect(week).toBeGreaterThanOrEqual(10 * MINUTE_MS);
    expect(week).toBeLessThanOrEqual(25 * MINUTE_MS);
  });

  it('calculates time reclaimed against the weekly baseline', () => {
    const settings = createDefaultSave({ now: START }).settings;
    expect(settings.weeklyBaselineMinutes).toBe(DEFAULT_WEEKLY_BASELINE_MINUTES);

    // Baseline 9h10m, 50 minutes played this week -> 8h20m reclaimed.
    const sessions = [finishedSession(START, 30), finishedSession(START, 20)];
    const reclaimed = timeReclaimedThisWeek(sessions, settings, START);
    expect(reclaimed).toBe((8 * 60 + 20) * MINUTE_MS);
  });

  it('never reports negative reclaimed time', () => {
    const settings = { ...createDefaultSave({ now: START }).settings, weeklyBaselineMinutes: 10 };
    const sessions = [finishedSession(START, 45)];
    expect(timeReclaimedThisWeek(sessions, settings, START)).toBe(0);
  });

  it('averages session length over finished sessions only', () => {
    const unfinished: Session = { ...finishedSession(START, 10), endedAt: null };
    expect(averageSessionLength([finishedSession(START, 10), finishedSession(START, 20), unfinished])).toBe(
      15 * MINUTE_MS,
    );
    expect(averageSessionLength([])).toBe(0);
  });

  it('counts days played and days off without judgement', () => {
    const sessions = [
      finishedSession(new Date('2026-07-02T12:00:00').getTime(), 10),
      finishedSession(new Date('2026-07-05T12:00:00').getTime(), 10),
      finishedSession(new Date('2026-07-05T18:00:00').getTime(), 10),
    ];
    const now = new Date('2026-07-10T12:00:00').getTime();
    const monthly = monthlyPlayDays(sessions, now);
    expect(monthly.daysPlayed).toBe(2);
    expect(monthly.totalDaysConsidered).toBe(10);
    expect(monthly.daysNotPlayed).toBe(8);
  });

  it('measures the longest break, including one still running', () => {
    const sessions = [
      finishedSession(new Date('2026-07-01T12:00:00').getTime(), 10),
      finishedSession(new Date('2026-07-05T12:00:00').getTime(), 10),
    ];
    // 1st to 5th is a three-day gap; five days since the last session.
    expect(longestBreakDays(sessions, new Date('2026-07-10T12:00:00').getTime())).toBe(4);
    expect(longestBreakDays([], START)).toBe(0);
  });

  it('summarises everything the dashboard needs', () => {
    const base = createDefaultSave({ now: START });
    const save: SaveGame = {
      ...base,
      sessions: [finishedSession(START - DAY_MS, 10), finishedSession(START, 5, false)],
    };
    const summary = wellbeingSummary(save, START);
    expect(summary.totalSessions).toBe(2);
    expect(summary.endedOnTime).toBe(1);
    expect(summary.today).toBe(5 * MINUTE_MS);
    expect(summary.totalWatchesBuilt).toBe(0);
  });
});

describe('time already spent in a running session', () => {
  it('counts towards today, this week and time reclaimed', () => {
    const running: Session = {
      ...finishedSession(START, 0),
      endedAt: null,
      actualDurationMs: 0,
      plannedDurationMs: 10 * MINUTE_MS,
    };
    const now = START + 4 * MINUTE_MS;

    expect(playTimeToday([running], now)).toBe(4 * MINUTE_MS);
    expect(playTimeThisWeek([running], now)).toBe(4 * MINUTE_MS);

    const settings = createDefaultSave({ now: START }).settings;
    expect(timeReclaimedThisWeek([running], settings, now)).toBe(
      (DEFAULT_WEEKLY_BASELINE_MINUTES - 4) * MINUTE_MS,
    );
  });

  it('is capped at the planned length plus grace, even if the tab is left open', () => {
    const running: Session = {
      ...finishedSession(START, 0),
      endedAt: null,
      actualDurationMs: 0,
      plannedDurationMs: 10 * MINUTE_MS,
    };
    expect(playTimeToday([running], START + 6 * 60 * MINUTE_MS)).toBe(
      10 * MINUTE_MS + GRACE_PERIOD_MS,
    );
  });

  it('does not count towards averages or the ended-on-time tally until it closes', () => {
    const running: Session = { ...finishedSession(START, 0), endedAt: null, actualDurationMs: 0 };
    expect(averageSessionLength([running])).toBe(0);
    expect(wellbeingSummary(
      { ...createDefaultSave({ now: START }), sessions: [running] },
      START + MINUTE_MS,
    ).totalSessions).toBe(0);
  });
});

describe('returning after time away', () => {
  it('keeps the board, generators and orders untouched after several inactive days', () => {
    const base = createDefaultSave({ now: START - 12 * DAY_MS });
    const save: SaveGame = {
      ...base,
      generators: base.generators.map((generator) => ({ ...generator, usesRemaining: 2 })),
      sessions: [finishedSession(START - 12 * DAY_MS, 10)],
    };

    const now = START;
    const limit = dailyLimitState(save, now);
    expect(limit.used).toBe(0);
    expect(limit.canStart).toBe(true);

    // Nothing about coming back changes what is on the bench.
    expect(save.generators.every((generator) => generator.usesRemaining === 2)).toBe(true);
    expect(playTimeToday(save.sessions, now)).toBe(0);
    expect(timeReclaimedThisWeek(save.sessions, save.settings, now)).toBe(
      DEFAULT_WEEKLY_BASELINE_MINUTES * MINUTE_MS,
    );
    expect(longestBreakDays(save.sessions, now)).toBe(11);
  });
});
