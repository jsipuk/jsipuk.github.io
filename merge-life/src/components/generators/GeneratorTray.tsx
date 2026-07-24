'use client';

import { ItemArt } from '@/components/board/ItemArt';
import { Button, classNames } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';
import { useGameStore } from '@/state/gameStore';
import type { Generator } from '@/types';

/**
 * Generators have a fixed number of uses per session. When they run out they
 * simply stop — there is no timer, no refill, no advert and no purchase.
 */
export function GeneratorTray({ enabled }: { enabled: boolean }) {
  const generators = useGameStore((state) => state.save.generators);
  const takeGeneratorPart = useGameStore((state) => state.takeGeneratorPart);
  const playFeedback = useFeedback();

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {generators.map((generator) => (
        <li key={generator.id}>
          <GeneratorCard
            generator={generator}
            enabled={enabled}
            onUse={() => {
              takeGeneratorPart(generator.id);
              playFeedback('create');
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function GeneratorCard({
  generator,
  enabled,
  onUse,
}: {
  generator: Generator;
  enabled: boolean;
  onUse: () => void;
}) {
  const depleted = generator.usesRemaining <= 0;
  const usable = enabled && !depleted;

  return (
    <div
      className={classNames(
        'ml-card flex h-full flex-col gap-3 p-4',
        depleted && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-surface-sunken/70 p-1.5">
          <ItemArt
            definition={{
              art: generator.art,
              tone: generator.tone,
              level: 1,
              chainId: generator.chainId,
            }}
            className="h-full w-full"
            title={generator.name}
          />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight text-ink">{generator.name}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{generator.description}</p>
        </div>
      </div>

      <div className="mt-auto">
        <p className="mb-2 text-sm tabular-nums text-ink-soft">
          {depleted ? (
            <span>That tray is finished for this session.</span>
          ) : (
            <>
              <span className="font-semibold text-ink">{generator.usesRemaining}</span> of{' '}
              {generator.usesPerSession} uses left this session
            </>
          )}
        </p>
        <Button
          variant={usable ? 'primary' : 'secondary'}
          full
          disabled={!usable}
          onClick={onUse}
          aria-label={
            depleted
              ? `${generator.name} is finished for this session`
              : `Take a part from the ${generator.name}. ${generator.usesRemaining} uses left this session.`
          }
        >
          {depleted ? 'Finished for this session' : 'Take a part'}
        </Button>
      </div>
    </div>
  );
}
