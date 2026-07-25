'use client';

import { useState } from 'react';
import { Button, Card, SectionTitle, Stat } from '@/components/ui';
import { wellbeingSummary } from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';
import { formatDuration, MINUTE_MS } from '@/utils/time';

/**
 * An honest local usage dashboard.
 *
 * No red badges, no guilt, no targets to hit. It reports what happened and
 * makes clear that time not spent here is the point.
 */
export function WellbeingDashboard() {
  const save = useGameStore((state) => state.save);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const summary = wellbeingSummary(save);

  const [baselineHours, setBaselineHours] = useState(() =>
    Math.floor(save.settings.weeklyBaselineMinutes / 60),
  );
  const [baselineMinutes, setBaselineMinutes] = useState(
    () => save.settings.weeklyBaselineMinutes % 60,
  );

  const saveBaseline = () => {
    const total = Math.max(0, baselineHours * 60 + baselineMinutes);
    updateSettings({ weeklyBaselineMinutes: total });
  };

  return (
    <div className="space-y-6">
      <Card>
        <p className="ml-label">This week</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          You reclaimed {formatDuration(summary.timeReclaimedThisWeek)} this week.
        </p>
        <p className="mt-2 text-ink-soft">
          That is your previous weekly gaming baseline of{' '}
          {formatDuration(save.settings.weeklyBaselineMinutes * MINUTE_MS)} minus the{' '}
          {formatDuration(summary.week)} you have spent in Merge Life this week.
        </p>
        <p className="mt-3 text-ink">Taking days off does not reduce progress.</p>
      </Card>

      <section aria-labelledby="time-heading">
        <SectionTitle hint="Measured locally on this device. Nothing is uploaded anywhere.">
          <span id="time-heading">Play time</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Today" value={formatDuration(summary.today, { short: true })} />
          <Stat label="This week" value={formatDuration(summary.week, { short: true })} />
          <Stat label="This month" value={formatDuration(summary.month, { short: true })} />
          <Stat label="Sessions" value={summary.totalSessions} />
          <Stat
            label="Average session"
            value={formatDuration(summary.averageSessionMs, { short: true })}
          />
          <Stat
            label="Ended on time"
            value={`${summary.endedOnTime} of ${summary.totalSessions}`}
          />
        </div>
      </section>

      <section aria-labelledby="rhythm-heading">
        <SectionTitle hint="Days off are shown plainly, as information rather than a score.">
          <span id="rhythm-heading">Rhythm this month</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Days played" value={summary.daysPlayedThisMonth} />
          <Stat label="Days not played" value={summary.daysNotPlayedThisMonth} />
          <Stat
            label="Longest break"
            value={`${summary.longestBreakDays} day${summary.longestBreakDays === 1 ? '' : 's'}`}
          />
          <Stat label="Watches built" value={summary.totalWatchesBuilt} />
        </div>
      </section>

      <Card>
        <SectionTitle hint="Used only to work out how much time you have reclaimed.">
          Your previous weekly gaming baseline
        </SectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="ml-label mb-1 block">Hours</span>
            <input
              type="number"
              min={0}
              max={100}
              value={baselineHours}
              onChange={(event) => setBaselineHours(Number(event.target.value))}
              className="ml-touch w-24 rounded-2xl border border-line bg-surface-raised px-3 py-2 tabular-nums text-ink"
            />
          </label>
          <label className="text-sm">
            <span className="ml-label mb-1 block">Minutes</span>
            <input
              type="number"
              min={0}
              max={59}
              value={baselineMinutes}
              onChange={(event) => setBaselineMinutes(Number(event.target.value))}
              className="ml-touch w-24 rounded-2xl border border-line bg-surface-raised px-3 py-2 tabular-nums text-ink"
            />
          </label>
          <Button variant="secondary" onClick={saveBaseline}>
            Save baseline
          </Button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          The default is 9 hours 10 minutes a week. Change it to whatever your honest previous
          figure was — it only affects the reclaimed-time calculation.
        </p>
      </Card>
    </div>
  );
}
