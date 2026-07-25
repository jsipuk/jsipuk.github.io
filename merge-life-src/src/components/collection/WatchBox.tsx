'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { WATCH_ARCHETYPES } from '@/data/watchArchetypes';
import { Badge, Button, Card, classNames, Stat } from '@/components/ui';
import { undiscoveredArchetypes } from '@/game/watchBuilder';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGameStore } from '@/state/gameStore';
import type { CollectionEntry, WatchArchetypeId } from '@/types';
import { formatDate } from '@/utils/time';
import { WatchIllustration } from './WatchIllustration';

type SortOrder = 'newest' | 'oldest' | 'type';

/**
 * The watch box.
 *
 * Completed watches are permanent: they stay here whatever happens to the board
 * afterwards. Archetypes not yet built are shown as quiet silhouettes rather
 * than locked slots with a price on them.
 */
export function WatchBox() {
  const collection = useGameStore((state) => state.save.collection);
  const [filter, setFilter] = useState<WatchArchetypeId | 'all'>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [openId, setOpenId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const visible = useMemo(() => {
    const filtered =
      filter === 'all' ? collection : collection.filter((entry) => entry.archetypeId === filter);
    const sorted = [...filtered];
    if (sort === 'newest') sorted.sort((a, b) => b.completedAt - a.completedAt);
    if (sort === 'oldest') sorted.sort((a, b) => a.completedAt - b.completedAt);
    if (sort === 'type') sorted.sort((a, b) => a.archetypeName.localeCompare(b.archetypeName));
    return sorted;
  }, [collection, filter, sort]);

  const missing = undiscoveredArchetypes(collection);
  const opened = collection.find((entry) => entry.id === openId) ?? null;

  if (opened) {
    return <WatchDetail entry={opened} onClose={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Watches built" value={collection.length} />
        <Stat
          label="Archetypes discovered"
          value={`${WATCH_ARCHETYPES.length - missing.length} of ${WATCH_ARCHETYPES.length}`}
        />
        <Stat
          label="Most recent"
          value={
            collection.length > 0
              ? formatDate(Math.max(...collection.map((entry) => entry.completedAt)))
              : '—'
          }
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <fieldset className="min-w-0">
            <legend className="ml-label mb-1.5">Filter by archetype</legend>
            <div className="ml-scrollbar-none flex gap-2 overflow-x-auto pb-1">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All
              </FilterChip>
              {WATCH_ARCHETYPES.map((archetype) => (
                <FilterChip
                  key={archetype.id}
                  active={filter === archetype.id}
                  onClick={() => setFilter(archetype.id)}
                >
                  {archetype.name}
                </FilterChip>
              ))}
            </div>
          </fieldset>

          <label className="ml-auto text-sm">
            <span className="ml-label mb-1.5 block">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="ml-touch rounded-pill border border-line bg-surface-raised px-4 py-2 text-sm text-ink"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="type">By type</option>
            </select>
          </label>
        </div>
      </Card>

      {/* Watch box: a lined tray of slots */}
      <div className="rounded-card border border-line bg-[rgb(var(--ml-surface-sunken))] p-3 shadow-inset sm:p-4">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((entry) => (
            <motion.li
              key={entry.id}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0.01 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setOpenId(entry.id)}
                className="ml-touch flex w-full flex-col items-center gap-2 rounded-2xl border border-line
                  bg-surface-raised p-3 text-center shadow-card transition-colors duration-200 ease-calm
                  hover:bg-surface"
              >
                <WatchIllustration archetypeId={entry.archetypeId} className="h-24 w-24" />
                <span className="text-sm font-semibold leading-tight text-ink">{entry.name}</span>
                <span className="text-xs text-ink-soft">{entry.archetypeName}</span>
                <span className="text-xs tabular-nums text-ink-faint">
                  {formatDate(entry.completedAt)}
                </span>
              </button>
            </motion.li>
          ))}

          {filter === 'all'
            ? missing.map((archetype) => (
                <li key={archetype.id}>
                  <div
                    className="flex h-full flex-col items-center gap-2 rounded-2xl border border-dashed
                      border-line bg-surface/40 p-3 text-center"
                  >
                    <WatchIllustration
                      archetypeId={archetype.id}
                      className="h-24 w-24 opacity-60"
                      silhouette
                    />
                    <span className="text-sm font-semibold text-ink-soft">{archetype.name}</span>
                    <span className="text-xs text-ink-faint">Not built yet</span>
                  </div>
                </li>
              ))
            : null}
        </ul>

        {visible.length === 0 && filter !== 'all' ? (
          <p className="px-2 py-6 text-center text-sm text-ink-soft">
            No watches of this type yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames(
        'ml-touch shrink-0 rounded-pill border px-4 py-2 text-sm transition-colors duration-200 ease-calm',
        active
          ? 'border-2 border-ink bg-surface-sunken/60 font-semibold text-ink'
          : 'border-line bg-surface-raised text-ink-soft hover:bg-surface-sunken/40',
      )}
    >
      {children}
    </button>
  );
}

function WatchDetail({ entry, onClose }: { entry: CollectionEntry; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="quiet" onClick={onClose} className="-ml-3">
        <span aria-hidden="true">←</span> Back to the watch box
      </Button>

      <Card>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="w-full max-w-[240px] shrink-0 rounded-card bg-surface-sunken/50 p-4">
            <WatchIllustration archetypeId={entry.archetypeId} className="h-full w-full" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{entry.name}</h2>
            <p className="mt-0.5 text-ink-soft">{entry.archetypeName}</p>
            <p className="mt-3 text-ink">{entry.description}</p>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Detail label="Serial number" value={entry.serial} />
              <Detail label="Date completed" value={formatDate(entry.completedAt)} />
              <Detail label="Case style" value={entry.caseStyle} />
              <Detail label="Dial style" value={entry.dialStyle} />
              <Detail label="Accent" value={entry.accentStyle} />
            </dl>

            <div className="mt-5">
              <h3 className="ml-label mb-2">Components used</h3>
              <ul className="flex flex-wrap gap-2">
                {entry.components.map((component) => (
                  <li key={component.definitionId}>
                    <Badge tone="brass">
                      {component.name} · level {component.level}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ml-label">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
