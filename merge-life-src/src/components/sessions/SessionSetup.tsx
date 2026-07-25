'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, classNames } from '@/components/ui';
import { dailyLimitState, SESSION_LENGTH_OPTIONS } from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';
import type { SessionLengthMinutes } from '@/types';

const basePathAware = (path: string) => path;

/**
 * Session length is chosen deliberately, and the timer only starts when the
 * player presses the button. Nothing starts on its own.
 */
export function SessionSetup({ hasBoard }: { hasBoard: boolean }) {
  const router = useRouter();
  const settings = useGameStore((state) => state.save.settings);
  const save = useGameStore((state) => state.save);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const beginSession = useGameStore((state) => state.beginSession);
  const activeSession = useGameStore((state) => state.save.activeSession);

  const limit = dailyLimitState(save);

  const start = () => {
    if (!activeSession) beginSession(settings.preferredSessionMinutes);
    router.push(basePathAware('/workshop'));
  };

  return (
    <Card>
      <fieldset>
        <legend className="ml-label mb-2">Session length</legend>
        <div className="grid grid-cols-3 gap-2">
          {SESSION_LENGTH_OPTIONS.map((option) => {
            const selected = settings.preferredSessionMinutes === option.minutes;
            return (
              <button
                key={option.minutes}
                type="button"
                onClick={() =>
                  updateSettings({ preferredSessionMinutes: option.minutes as SessionLengthMinutes })
                }
                aria-pressed={selected}
                className={classNames(
                  'ml-touch rounded-2xl border px-3 py-3 text-left transition-colors duration-200 ease-calm',
                  selected
                    ? 'border-2 border-ink bg-surface-sunken/60'
                    : 'border-line bg-surface-raised hover:bg-surface-sunken/40',
                )}
              >
                <span className="block text-sm font-semibold text-ink">{option.label}</span>
                <span className="block text-sm tabular-nums text-ink-soft">
                  {option.minutes} minutes {selected ? '· selected' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        {activeSession ? (
          <Button variant="primary" full onClick={start}>
            Continue where you left off
          </Button>
        ) : limit.canStart ? (
          <Button variant="primary" full onClick={start}>
            Begin intentional session
          </Button>
        ) : (
          <div className="space-y-3">
            <Button variant="secondary" full onClick={() => router.push(basePathAware('/workshop'))}>
              Open the workshop to look around
            </Button>
            <p className="text-sm text-ink-soft">
              You have used both of today&rsquo;s sessions. The workshop, your collection and your
              stats are all still here to browse. Nothing is lost by stopping now.
            </p>
          </div>
        )}
      </div>

      {hasBoard && limit.canStart ? (
        <p className="mt-3 text-sm text-ink-soft">
          Your bench is exactly as you left it. The timer starts only when you press the button.
        </p>
      ) : null}
    </Card>
  );
}
