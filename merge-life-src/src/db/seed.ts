import { getDefinition } from '@/data/itemChains';
import { buildWatch } from '@/game/watchBuilder';
import { createItem, placeItem } from '@/game/mergeEngine';
import { generateOrders } from '@/game/orderEngine';
import type { Board, SaveGame, Session } from '@/types';
import { setIdSeed } from '@/utils/ids';
import { dayKey, DAY_MS, MINUTE_MS } from '@/utils/time';
import { createDefaultSave } from './defaultSave';

/**
 * Development-only seeded save.
 *
 * Deterministic: the same seed always produces the same board, watches and
 * history, which makes it useful for screenshots and manual testing.
 * Production always starts from `createDefaultSave`.
 */

const SEED_LAYOUT: [string, number, number][] = [
  ['watch-movement-1', 0, 0],
  ['watch-movement-1', 1, 0],
  ['watch-movement-2', 2, 0],
  ['watch-movement-2', 3, 0],
  ['watch-movement-3', 4, 0],
  ['watch-movement-4', 5, 0],
  ['watch-exterior-1', 0, 1],
  ['watch-exterior-1', 1, 1],
  ['watch-exterior-2', 2, 1],
  ['watch-exterior-3', 3, 1],
  ['watch-exterior-4', 4, 1],
  ['watch-design-1', 0, 2],
  ['watch-design-2', 1, 2],
  ['watch-design-2', 2, 2],
  ['watch-design-4', 3, 2],
  ['watch-movement-5', 0, 3],
  ['watch-exterior-5', 1, 3],
  ['watch-design-5', 2, 3],
];

function seedBoard(board: Board, now: number): Board {
  let next = board;
  SEED_LAYOUT.forEach(([definitionId, col, row], index) => {
    const item = createItem(definitionId, { col, row }, { now: now - index * MINUTE_MS });
    next = placeItem(next, item, { col, row });
  });
  return next;
}

function seedSessions(now: number): Session[] {
  const history: { daysAgo: number; minutes: number; planned: number; onTime: boolean }[] = [
    { daysAgo: 9, minutes: 10, planned: 10, onTime: true },
    { daysAgo: 8, minutes: 7, planned: 10, onTime: false },
    { daysAgo: 5, minutes: 15, planned: 15, onTime: true },
    { daysAgo: 4, minutes: 10, planned: 10, onTime: true },
    { daysAgo: 1, minutes: 5, planned: 5, onTime: true },
  ];

  return history.map((entry, index) => {
    const startedAt = now - entry.daysAgo * DAY_MS;
    return {
      id: `seed-session-${index + 1}`,
      startedAt,
      endedAt: startedAt + entry.minutes * MINUTE_MS,
      plannedDurationMs: entry.planned * MINUTE_MS,
      actualDurationMs: entry.minutes * MINUTE_MS,
      endedOnTime: entry.onTime,
      endReason: entry.onTime ? 'timer' : 'player',
      itemsCreated: 18 + index * 3,
      merges: 12 + index * 2,
      ordersCompleted: index % 3,
      progressEarned: 18 * (index % 3),
      discoveries: [],
      watchesCompleted: index === 2 || index === 4 ? 1 : 0,
      dayKey: dayKey(startedAt),
    } satisfies Session;
  });
}

export interface SeedOptions {
  now?: number;
  seed?: number;
}

export function createSeededSave(options: SeedOptions = {}): SaveGame {
  const now = options.now ?? Date.now();
  setIdSeed(options.seed ?? 20260724);

  const base = createDefaultSave({ now, saveId: 'seed-save' });
  const board = seedBoard(base.board, now);

  const discovered = Array.from(
    new Set([
      ...SEED_LAYOUT.map(([definitionId]) => definitionId),
      'watch-movement-6',
      'watch-exterior-6',
      'watch-design-6',
    ]),
  );

  const sessions = seedSessions(now);

  // Two finished watches, built from deterministic components.
  const componentAt = (definitionId: string) =>
    createItem(definitionId, { col: 0, row: 0 }, { now });

  const first = buildWatch(
    {
      movement: componentAt('watch-movement-4'),
      exterior: componentAt('watch-exterior-4'),
      design: componentAt('watch-design-4'),
    },
    { now: now - 5 * DAY_MS, serialCounters: {}, id: 'seed-watch-1' },
  );
  const second = buildWatch(
    {
      movement: componentAt('watch-movement-5'),
      exterior: componentAt('watch-exterior-5'),
      design: componentAt('watch-design-4'),
    },
    { now: now - DAY_MS, serialCounters: first.serialCounters, id: 'seed-watch-2' },
  );

  const totalPlayMs = sessions.reduce((sum, session) => sum + session.actualDurationMs, 0);

  return {
    ...base,
    board,
    discoveredDefinitionIds: discovered,
    collection: [first.entry, second.entry],
    serialCounters: second.serialCounters,
    unlockedDecorationIds: ['better-workbench', 'desk-lamp', 'tool-rack'],
    sessions,
    activeOrders: generateOrders({ reach: 5, seed: 1234, now, count: 3 }),
    completedOrders: [],
    stats: {
      ...base.stats,
      totalPlayMs,
      totalSessions: sessions.length,
      totalMerges: sessions.reduce((sum, session) => sum + session.merges, 0),
      totalItemsCreated: sessions.reduce((sum, session) => sum + session.itemsCreated, 0),
      totalOrdersCompleted: sessions.reduce((sum, session) => sum + session.ordersCompleted, 0),
      totalWatchesBuilt: 2,
      sessionsEndedOnTime: sessions.filter((session) => session.endedOnTime).length,
      daysPlayed: Array.from(new Set(sessions.map((session) => session.dayKey))).sort(),
      workshopProgress: 260,
      cosmeticTokens: 7,
    },
    settings: { ...base.settings, hasSeenIntro: true },
  };
}

/** Human-readable summary of what the seeded save contains. */
export function describeSeed(save: SaveGame): string {
  const items = save.board.cells.filter((cell) => cell.item).length;
  const names = save.collection.map((entry) => `${entry.name} (${entry.archetypeName})`).join(', ');
  return `${items} items on the board, ${save.collection.length} watches (${names}), ${save.sessions.length} past sessions.`;
}

/** Exposed for the settings screen so the label matches the data. */
export const SEED_SUMMARY_ITEM_NAMES = SEED_LAYOUT.map(([definitionId]) =>
  getDefinition(definitionId).name,
);
