import { createGenerators } from '@/data/rooms';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  createEmptyBoard,
  normaliseBoard,
} from '@/game/mergeEngine';
import type {
  AnySave,
  Board,
  CollectionEntry,
  MergeItem,
  SaveGame,
  SaveMigration,
  Session,
} from '@/types';
import { createId } from '@/utils/ids';
import { dayKey } from '@/utils/time';
import {
  createDefaultSave,
  createDefaultSettings,
  createDefaultStats,
  CURRENT_SAVE_VERSION,
} from './defaultSave';

/**
 * Save migrations.
 *
 * Each migration takes the loose shape of the previous version and returns the
 * loose shape of the next one. They are applied in order, so a version 1 save
 * from the very first release still loads today.
 */
export const MIGRATIONS: SaveMigration[] = [
  {
    from: 1,
    to: 2,
    description: 'Adds workshop decorations and the wellbeing weekly baseline.',
    migrate: (save) => {
      const settings = (save.settings ?? {}) as Record<string, unknown>;
      return {
        ...save,
        version: 2,
        unlockedDecorationIds: Array.isArray(save.unlockedDecorationIds)
          ? save.unlockedDecorationIds
          : [],
        settings: {
          ...createDefaultSettings(),
          ...settings,
          weeklyBaselineMinutes:
            typeof settings.weeklyBaselineMinutes === 'number'
              ? settings.weeklyBaselineMinutes
              : createDefaultSettings().weeklyBaselineMinutes,
          hapticsEnabled:
            typeof settings.hapticsEnabled === 'boolean' ? settings.hapticsEnabled : true,
        },
      };
    },
  },
  {
    from: 2,
    to: 3,
    description:
      'Stores the board as an addressable 6x8 cell grid and adds deterministic watch serial counters.',
    migrate: (save) => {
      const legacyItems = Array.isArray(save.boardItems) ? (save.boardItems as MergeItem[]) : null;
      let board = (save.board as Board | undefined) ?? createEmptyBoard();

      if (legacyItems) {
        board = createEmptyBoard(BOARD_COLUMNS, BOARD_ROWS);
        for (const item of legacyItems) {
          const position = item?.position;
          if (!position) continue;
          const index = position.row * BOARD_COLUMNS + position.col;
          const cell = board.cells[index];
          if (cell && !cell.item) {
            cell.item = { ...item, position: { ...position } };
          }
        }
      }

      const collection = Array.isArray(save.collection) ? (save.collection as CollectionEntry[]) : [];
      const serialCounters =
        (save.serialCounters as Record<string, number> | undefined) ??
        collection.reduce<Record<string, number>>((acc, entry) => {
          acc[entry.archetypeId] = (acc[entry.archetypeId] ?? 0) + 1;
          return acc;
        }, {});

      const rest = { ...save };
      delete rest.boardItems;

      return {
        ...rest,
        version: 3,
        board,
        serialCounters,
        activeSession: save.activeSession ?? null,
      };
    },
  },
];

export function migrationPath(fromVersion: number): SaveMigration[] {
  return MIGRATIONS.filter((migration) => migration.from >= fromVersion).sort(
    (a, b) => a.from - b.from,
  );
}

export class SaveMigrationError extends Error {}

/** Runs every migration needed to bring `save` up to the current version. */
export function migrateSave(save: AnySave): AnySave {
  let current = { ...save };
  let version = typeof current.version === 'number' ? current.version : 1;

  if (version > CURRENT_SAVE_VERSION) {
    throw new SaveMigrationError(
      `Save version ${version} is newer than this build supports (${CURRENT_SAVE_VERSION}).`,
    );
  }

  let guard = 0;
  while (version < CURRENT_SAVE_VERSION) {
    guard += 1;
    if (guard > MIGRATIONS.length + 1) {
      throw new SaveMigrationError(`No migration path from version ${version}.`);
    }
    const migration = MIGRATIONS.find((candidate) => candidate.from === version);
    if (!migration) {
      throw new SaveMigrationError(`No migration registered from version ${version}.`);
    }
    current = migration.migrate(current);
    version = typeof current.version === 'number' ? current.version : migration.to;
  }

  return current;
}

/* ------------------------------------------------------------------ */
/* Validation and repair                                               */
/* ------------------------------------------------------------------ */

export class SaveCorruptError extends Error {}

function isBoardShape(value: unknown): value is Board {
  if (!value || typeof value !== 'object') return false;
  const board = value as Board;
  return (
    typeof board.columns === 'number' &&
    typeof board.rows === 'number' &&
    Array.isArray(board.cells) &&
    board.cells.length === board.columns * board.rows
  );
}

/** Cheap structural check used before a save is trusted. */
export function isPlausibleSave(value: unknown): value is SaveGame {
  if (!value || typeof value !== 'object') return false;
  const save = value as SaveGame;
  return (
    typeof save.version === 'number' &&
    isBoardShape(save.board) &&
    Array.isArray(save.generators) &&
    Array.isArray(save.sessions) &&
    Array.isArray(save.collection) &&
    typeof save.settings === 'object' &&
    save.settings !== null
  );
}

function repairSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((session): session is Session => Boolean(session) && typeof session === 'object')
    .map((session) => ({
      ...session,
      dayKey: session.dayKey ?? dayKey(session.startedAt ?? Date.now()),
      actualDurationMs: Number.isFinite(session.actualDurationMs) ? session.actualDurationMs : 0,
      discoveries: Array.isArray(session.discoveries) ? session.discoveries : [],
      progressEarned: Number.isFinite(session.progressEarned) ? session.progressEarned : 0,
    }));
}

/**
 * Fills in anything missing and drops anything nonsensical, so a partially
 * damaged save still restores the player's board rather than throwing it away.
 */
export function normaliseSave(candidate: AnySave, now = Date.now()): SaveGame {
  const fallback = createDefaultSave({ now });
  const save = candidate as Partial<SaveGame>;

  const board = isBoardShape(save.board) ? normaliseBoard(save.board) : fallback.board;

  const generators = Array.isArray(save.generators) && save.generators.length > 0
    ? createGenerators().map((generator) => {
        const stored = (save.generators as SaveGame['generators']).find(
          (candidateGenerator) => candidateGenerator.id === generator.id,
        );
        if (!stored) return generator;
        const remaining = Number.isFinite(stored.usesRemaining)
          ? Math.max(0, Math.min(generator.usesPerSession, stored.usesRemaining))
          : generator.usesPerSession;
        return { ...generator, usesRemaining: remaining };
      })
    : fallback.generators;

  return {
    version: CURRENT_SAVE_VERSION,
    saveId: typeof save.saveId === 'string' ? save.saveId : createId('save'),
    createdAt: Number.isFinite(save.createdAt) ? (save.createdAt as number) : now,
    updatedAt: now,
    board,
    generators,
    activeOrders: Array.isArray(save.activeOrders) ? save.activeOrders : [],
    completedOrders: Array.isArray(save.completedOrders) ? save.completedOrders : [],
    discoveredDefinitionIds: Array.isArray(save.discoveredDefinitionIds)
      ? Array.from(new Set(save.discoveredDefinitionIds))
      : [],
    collection: Array.isArray(save.collection) ? save.collection : [],
    unlockedRoomIds:
      Array.isArray(save.unlockedRoomIds) && save.unlockedRoomIds.length > 0
        ? save.unlockedRoomIds
        : fallback.unlockedRoomIds,
    unlockedDecorationIds: Array.isArray(save.unlockedDecorationIds)
      ? save.unlockedDecorationIds
      : [],
    sessions: repairSessions(save.sessions),
    activeSession: save.activeSession ?? null,
    stats: { ...createDefaultStats(), ...(save.stats ?? {}) },
    settings: { ...createDefaultSettings(), ...(save.settings ?? {}) },
    serialCounters:
      save.serialCounters && typeof save.serialCounters === 'object' ? save.serialCounters : {},
  };
}

/**
 * Minimum a stored record must have before we are willing to migrate it. This
 * is checked *before* migration, because migrations happily fill in defaults
 * and would otherwise turn arbitrary junk into a plausible-looking empty save.
 */
function hasSaveFingerprint(candidate: AnySave): boolean {
  const hasBoard = isBoardShape(candidate.board) || Array.isArray(candidate.boardItems);
  const hasVersion = typeof candidate.version === 'number';
  return hasBoard && hasVersion;
}

/** Migrate + validate + repair. Throws `SaveCorruptError` if unusable. */
export function loadSaveObject(candidate: unknown, now = Date.now()): SaveGame {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new SaveCorruptError('Save is not an object.');
  }
  if (!hasSaveFingerprint(candidate as AnySave)) {
    throw new SaveCorruptError('Save does not contain a recognisable board.');
  }
  return normaliseSave(migrateSave(candidate as AnySave), now);
}
