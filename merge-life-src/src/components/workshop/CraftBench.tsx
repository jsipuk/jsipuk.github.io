'use client';

import { useMemo, useState } from 'react';
import { getDefinition } from '@/data/itemChains';
import { MIN_CRAFT_LEVEL } from '@/data/watchArchetypes';
import { ItemArt } from '@/components/board/ItemArt';
import { Badge, Button, Card, classNames, EmptyState } from '@/components/ui';
import { allItems, findItemById } from '@/game/mergeEngine';
import { checkCraftEligibility, type CraftComponents } from '@/game/watchBuilder';
import { useFeedback } from '@/hooks/useFeedback';
import { useGameStore } from '@/state/gameStore';
import type { ChainId, CollectionEntry, MergeItem } from '@/types';
import { WatchIllustration } from '@/components/collection/WatchIllustration';

const SLOTS: { chainId: ChainId; label: string; hint: string }[] = [
  { chainId: 'watch-movement', label: 'Movement', hint: 'Escapement or better' },
  { chainId: 'watch-exterior', label: 'Case', hint: 'Crystal and bezel or better' },
  { chainId: 'watch-design', label: 'Dial', hint: 'Watch dial or better' },
];

/**
 * Casing up a watch: one movement, one case, one dial. Always a deliberate,
 * confirmed action — the three parts are only consumed when the player presses
 * the build button.
 */
export function CraftBench({ interactive }: { interactive: boolean }) {
  const board = useGameStore((state) => state.save.board);
  const craftSelection = useGameStore((state) => state.craftSelection);
  const toggleCraftComponent = useGameStore((state) => state.toggleCraftComponent);
  const clearCraftSelection = useGameStore((state) => state.clearCraftSelection);
  const craftWatch = useGameStore((state) => state.craftWatch);
  const playFeedback = useFeedback();
  const [built, setBuilt] = useState<CollectionEntry | null>(null);

  const eligibleByChain = useMemo(() => {
    const items = allItems(board).filter((item) => item.level >= MIN_CRAFT_LEVEL);
    return SLOTS.reduce<Record<string, MergeItem[]>>((acc, slot) => {
      acc[slot.chainId] = items
        .filter((item) => item.chainId === slot.chainId)
        .sort((a, b) => b.level - a.level);
      return acc;
    }, {});
  }, [board]);

  const chosen = SLOTS.reduce<Partial<CraftComponents>>((acc, slot) => {
    const item = craftSelection
      .map((id) => findItemById(board, id))
      .find((candidate) => candidate?.chainId === slot.chainId);
    if (slot.chainId === 'watch-movement') acc.movement = item ?? undefined;
    if (slot.chainId === 'watch-exterior') acc.exterior = item ?? undefined;
    if (slot.chainId === 'watch-design') acc.design = item ?? undefined;
    return acc;
  }, {});

  const eligibility = checkCraftEligibility(chosen);
  const anyEligibleParts = SLOTS.some((slot) => (eligibleByChain[slot.chainId] ?? []).length > 0);

  const build = () => {
    const entry = craftWatch();
    if (entry) {
      setBuilt(entry);
      playFeedback('complete');
    }
  };

  if (built) {
    return (
      <Card>
        <p className="ml-label">Added to your collection, permanently</p>
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <WatchIllustration archetypeId={built.archetypeId} className="h-36 w-36 shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-ink">{built.name}</h3>
            <p className="text-ink-soft">
              {built.archetypeName} · serial {built.serial}
            </p>
            <p className="mt-2 text-sm text-ink-soft">{built.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setBuilt(null)}>
                Back to the bench
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Case up a watch</h2>
          <p className="text-sm text-ink-soft">
            One movement, one case, one dial. Better parts make rarer watches.
          </p>
        </div>
        {craftSelection.length > 0 ? (
          <Button variant="quiet" onClick={clearCraftSelection}>
            Clear selection
          </Button>
        ) : null}
      </div>

      {!anyEligibleParts ? (
        <EmptyState title={`No parts are ready yet`}>
          Parts can be cased up once they reach level {MIN_CRAFT_LEVEL} in their chain. Keep
          merging — nothing you have made will be lost.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {SLOTS.map((slot) => {
            const options = eligibleByChain[slot.chainId] ?? [];
            const selectedId = craftSelection.find(
              (id) => findItemById(board, id)?.chainId === slot.chainId,
            );
            return (
              <fieldset key={slot.chainId}>
                <legend className="ml-label mb-1.5">
                  {slot.label} <span className="normal-case tracking-normal">· {slot.hint}</span>
                </legend>
                {options.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-ink-soft">
                    Nothing ready in this chain yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {options.map((item) => {
                      const definition = getDefinition(item.definitionId);
                      const selected = selectedId === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={!interactive}
                            aria-pressed={selected}
                            aria-label={`Choose ${definition.name}, level ${definition.level}, as the ${slot.label.toLowerCase()}`}
                            onClick={() => toggleCraftComponent(item.id)}
                            className={classNames(
                              'ml-touch flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors duration-200 ease-calm disabled:opacity-60',
                              selected
                                ? 'border-2 border-sage bg-surface-sunken/50'
                                : 'border-line bg-surface-raised hover:bg-surface-sunken/40',
                            )}
                          >
                            <ItemArt definition={definition} className="h-8 w-8 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-ink">
                                {definition.name}
                              </span>
                              <span className="block text-xs text-ink-soft">
                                Level {definition.level}
                                {selected ? ' · chosen' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!interactive || !eligibility.ok} onClick={build}>
          Build this watch
        </Button>
        {eligibility.ok && eligibility.archetype ? (
          <Badge tone="sage">Will make a {eligibility.archetype.name}</Badge>
        ) : (
          <p className="text-sm text-ink-soft">{eligibility.reason}</p>
        )}
      </div>
    </Card>
  );
}
