import { beforeEach, describe, expect, it } from 'vitest';
import { MergeLifeDatabase, setDatabase, getDatabase, CURRENT_SAVE_KEY, BACKUP_SAVE_KEY } from '@/db/database';
import { createDefaultSave, CURRENT_SAVE_VERSION } from '@/db/defaultSave';
import {
  loadSaveObject,
  migrateSave,
  MIGRATIONS,
  normaliseSave,
  SaveMigrationError,
  isPlausibleSave,
} from '@/db/migrations';
import {
  exportSaveToJson,
  importSaveFromJson,
  loadSave,
  parseSaveJson,
  persistSave,
  readBackup,
  resetProgress,
} from '@/db/repositories';
import { createSeededSave } from '@/db/seed';
import { createItem, getItemAt, placeItem } from '@/game/mergeEngine';
import type { AnySave } from '@/types';

let databaseCounter = 0;

async function freshDatabase() {
  databaseCounter += 1;
  const db = new MergeLifeDatabase(`merge-life-test-${databaseCounter}`);
  setDatabase(db);
  await db.open();
  return db;
}

beforeEach(async () => {
  await freshDatabase();
});

/* ------------------------------------------------------------------ */

describe('save and restore', () => {
  it('restores the exact board layout, including item positions', async () => {
    const save = createDefaultSave();
    const item = createItem('watch-movement-3', { col: 4, row: 6 });
    save.board = placeItem(save.board, item, { col: 4, row: 6 });
    save.board = placeItem(
      save.board,
      createItem('watch-design-2', { col: 0, row: 7 }),
      { col: 0, row: 7 },
    );

    await persistSave(save);
    const result = await loadSave();

    expect(result.source).toBe('current');
    expect(result.save.board.cells).toHaveLength(48);
    expect(getItemAt(result.save.board, { col: 4, row: 6 })?.definitionId).toBe('watch-movement-3');
    expect(getItemAt(result.save.board, { col: 4, row: 6 })?.id).toBe(item.id);
    expect(getItemAt(result.save.board, { col: 0, row: 7 })?.definitionId).toBe('watch-design-2');
    expect(getItemAt(result.save.board, { col: 1, row: 1 })).toBeNull();
  });

  it('restores generators, orders, collection and settings unchanged', async () => {
    const seeded = createSeededSave({ now: Date.UTC(2026, 6, 24, 9, 0, 0) });
    seeded.generators[0].usesRemaining = 4;
    await persistSave(seeded);

    const { save } = await loadSave();
    expect(save.generators[0].usesRemaining).toBe(4);
    expect(save.collection).toHaveLength(2);
    expect(save.collection[0].serial).toMatch(/^[A-Z]{3}-\d{4}-\d{4}$/);
    expect(save.activeOrders).toHaveLength(3);
    expect(save.sessions).toHaveLength(5);
    expect(save.settings.weeklyBaselineMinutes).toBe(550);
  });

  it('creates a clean default save when nothing is stored', async () => {
    const result = await loadSave();
    expect(result.source).toBe('new');
    expect(result.save.collection).toHaveLength(0);
    expect(result.save.board.cells.every((cell) => cell.item === null)).toBe(true);
    expect(result.save.unlockedRoomIds).toEqual(['watch-workshop']);
  });

  it('keeps a backup of the previous save on every write', async () => {
    const first = createDefaultSave();
    first.stats.totalMerges = 5;
    await persistSave(first);

    const second = { ...first, stats: { ...first.stats, totalMerges: 9 } };
    await persistSave(second);

    const backup = await readBackup();
    expect(backup?.stats.totalMerges).toBe(5);
    const current = await loadSave();
    expect(current.save.stats.totalMerges).toBe(9);
  });

  it('recovers from a corrupt primary save by using the backup', async () => {
    const good = createDefaultSave();
    good.stats.totalWatchesBuilt = 3;
    await persistSave(good);
    await persistSave({ ...good, stats: { ...good.stats, totalWatchesBuilt: 4 } });

    // Corrupt the live record only.
    const db = getDatabase();
    await db.saves.put({
      key: CURRENT_SAVE_KEY,
      save: { nonsense: true } as never,
      savedAt: Date.now(),
      version: CURRENT_SAVE_VERSION,
    });

    const result = await loadSave();
    expect(result.recovered).toBe(true);
    expect(result.source).toBe('backup');
    expect(result.save.stats.totalWatchesBuilt).toBe(3);
  });

  it('falls back to a fresh save when both records are unusable', async () => {
    const db = getDatabase();
    const broken = { key: CURRENT_SAVE_KEY, save: 42 as never, savedAt: 1, version: 1 };
    await db.saves.put(broken);
    await db.saves.put({ ...broken, key: BACKUP_SAVE_KEY });

    const result = await loadSave();
    expect(result.source).toBe('new');
    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('resets progress only when explicitly asked', async () => {
    await persistSave(createSeededSave());
    const fresh = await resetProgress();
    expect(fresh.collection).toHaveLength(0);
    const result = await loadSave();
    expect(result.save.collection).toHaveLength(0);
    expect(result.save.sessions).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */

describe('export and import', () => {
  it('round-trips a save through JSON', async () => {
    const seeded = createSeededSave();
    const json = exportSaveToJson(seeded);
    const imported = await importSaveFromJson(json);

    expect(imported.collection.map((entry) => entry.serial)).toEqual(
      seeded.collection.map((entry) => entry.serial),
    );
    expect(imported.board.cells.filter((cell) => cell.item)).toHaveLength(
      seeded.board.cells.filter((cell) => cell.item).length,
    );

    const reloaded = await loadSave();
    expect(reloaded.save.collection).toHaveLength(2);
  });

  it('accepts a bare save object as well as the export wrapper', () => {
    const save = createDefaultSave();
    const bare = JSON.stringify(save);
    expect(parseSaveJson(bare).version).toBe(CURRENT_SAVE_VERSION);
  });

  it('rejects files that are not saves', () => {
    expect(() => parseSaveJson('not json at all')).toThrow(/valid JSON/i);
    expect(() => parseSaveJson('"a string"')).toThrow();
  });
});

/* ------------------------------------------------------------------ */

describe('migrations', () => {
  /** A version 1 save, as written by the very first release. */
  function legacyV1Save(): AnySave {
    return {
      version: 1,
      saveId: 'legacy-1',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      boardItems: [
        {
          id: 'item-a',
          definitionId: 'watch-movement-2',
          chainId: 'watch-movement',
          level: 2,
          createdAt: 1_700_000_000_000,
          position: { col: 2, row: 3 },
        },
        {
          id: 'item-b',
          definitionId: 'watch-design-1',
          chainId: 'watch-design',
          level: 1,
          createdAt: 1_700_000_000_000,
          position: { col: 5, row: 7 },
        },
      ],
      generators: [
        { id: 'movement-parts-tray', usesRemaining: 3 },
        { id: 'case-parts-bench', usesRemaining: 12 },
        { id: 'design-desk', usesRemaining: 0 },
      ],
      activeOrders: [],
      completedOrders: [],
      discoveredDefinitionIds: ['watch-movement-1', 'watch-movement-2'],
      collection: [
        { id: 'w1', archetypeId: 'field', completedAt: 1_700_000_000_000 },
        { id: 'w2', archetypeId: 'field', completedAt: 1_700_000_100_000 },
        { id: 'w3', archetypeId: 'diver', completedAt: 1_700_000_200_000 },
      ],
      unlockedRoomIds: ['watch-workshop'],
      sessions: [
        {
          id: 's1',
          startedAt: 1_700_000_000_000,
          endedAt: 1_700_000_600_000,
          plannedDurationMs: 600_000,
          actualDurationMs: 600_000,
          endedOnTime: true,
          itemsCreated: 10,
          merges: 6,
          ordersCompleted: 1,
          watchesCompleted: 0,
        },
      ],
      stats: { totalMerges: 6 },
      settings: { preferredSessionMinutes: 5, maxSessionsPerDay: 2 },
    };
  }

  it('declares a continuous migration path to the current version', () => {
    const sorted = [...MIGRATIONS].sort((a, b) => a.from - b.from);
    expect(sorted[0].from).toBe(1);
    sorted.forEach((migration, index) => {
      if (index > 0) expect(migration.from).toBe(sorted[index - 1].to);
    });
    expect(sorted[sorted.length - 1].to).toBe(CURRENT_SAVE_VERSION);
  });

  it('migrates a version 1 save and keeps the board layout', () => {
    const migrated = migrateSave(legacyV1Save());
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);

    const save = normaliseSave(migrated);
    expect(getItemAt(save.board, { col: 2, row: 3 })?.id).toBe('item-a');
    expect(getItemAt(save.board, { col: 5, row: 7 })?.definitionId).toBe('watch-design-1');
    expect(save.board.cells).toHaveLength(48);
  });

  it('fills in fields added after version 1', () => {
    const save = loadSaveObject(legacyV1Save());
    expect(save.settings.weeklyBaselineMinutes).toBe(550);
    expect(save.settings.hapticsEnabled).toBe(true);
    expect(save.settings.soundEnabled).toBe(false);
    expect(save.unlockedDecorationIds).toEqual([]);
    expect(save.serialCounters).toEqual({ field: 2, diver: 1 });
    expect(save.activeSession).toBeNull();
  });

  it('preserves generator uses through migration', () => {
    const save = loadSaveObject(legacyV1Save());
    expect(save.generators.find((g) => g.id === 'movement-parts-tray')?.usesRemaining).toBe(3);
    expect(save.generators.find((g) => g.id === 'design-desk')?.usesRemaining).toBe(0);
    expect(save.generators.find((g) => g.id === 'case-parts-bench')?.name).toBe('Case Parts Bench');
  });

  it('loads a migrated legacy save from the database', async () => {
    const db = getDatabase();
    await db.saves.put({
      key: CURRENT_SAVE_KEY,
      save: legacyV1Save() as never,
      savedAt: Date.now(),
      version: 1,
    });

    const result = await loadSave();
    expect(result.source).toBe('current');
    expect(result.migrated).toBe(true);
    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(getItemAt(result.save.board, { col: 2, row: 3 })?.id).toBe('item-a');
  });

  it('refuses a save from a newer build rather than mangling it', () => {
    expect(() => migrateSave({ version: CURRENT_SAVE_VERSION + 5 })).toThrow(SaveMigrationError);
  });

  it('repairs a partially damaged save instead of discarding it', () => {
    const damaged = {
      ...createDefaultSave(),
      settings: undefined,
      stats: undefined,
      sessions: 'not an array',
      discoveredDefinitionIds: ['watch-movement-1', 'watch-movement-1'],
    } as unknown as AnySave;

    const save = normaliseSave(damaged);
    expect(save.settings.preferredSessionMinutes).toBe(10);
    expect(save.stats.totalMerges).toBe(0);
    expect(save.sessions).toEqual([]);
    expect(save.discoveredDefinitionIds).toEqual(['watch-movement-1']);
  });

  it('recognises a plausible save', () => {
    expect(isPlausibleSave(createDefaultSave())).toBe(true);
    expect(isPlausibleSave({ version: 3 })).toBe(false);
    expect(isPlausibleSave(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('seeded development save', () => {
  it('is deterministic for a given seed', () => {
    const now = Date.UTC(2026, 6, 24, 12, 0, 0);
    const a = createSeededSave({ now, seed: 42 });
    const b = createSeededSave({ now, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('contains a partial board, discoveries, two watches, upgrades and history', () => {
    const save = createSeededSave({ now: Date.UTC(2026, 6, 24, 12, 0, 0) });
    const occupied = save.board.cells.filter((cell) => cell.item).length;
    expect(occupied).toBeGreaterThan(10);
    expect(occupied).toBeLessThan(48);
    expect(save.discoveredDefinitionIds.length).toBeGreaterThan(10);
    expect(save.collection).toHaveLength(2);
    expect(save.unlockedDecorationIds.length).toBeGreaterThan(0);
    expect(save.sessions.length).toBeGreaterThan(0);
  });
});
