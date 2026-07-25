import type { SaveGame } from '@/types';
import {
  BACKUP_SAVE_KEY,
  CURRENT_SAVE_KEY,
  getDatabase,
  isIndexedDbAvailable,
  type SaveRecord,
} from './database';
import { createDefaultSave, CURRENT_SAVE_VERSION } from './defaultSave';
import { loadSaveObject, SaveCorruptError } from './migrations';

export type LoadSource = 'current' | 'backup' | 'new' | 'unavailable';

export interface LoadResult {
  save: SaveGame;
  source: LoadSource;
  /** True when the primary save could not be read and the backup was used. */
  recovered: boolean;
  /** Version the save was stored at, before migration. */
  loadedVersion?: number;
  migrated: boolean;
  error?: string;
}

/**
 * Loads the player's save.
 *
 * Order of attempts: current save -> backup save -> a fresh default save. The
 * board is never silently reset while any readable data remains.
 */
export async function loadSave(now = Date.now()): Promise<LoadResult> {
  if (!isIndexedDbAvailable()) {
    return { save: createDefaultSave({ now }), source: 'unavailable', recovered: false, migrated: false };
  }

  const db = getDatabase();

  const attempt = async (key: string): Promise<{ save: SaveGame; version: number } | null> => {
    const record = await db.saves.get(key);
    if (!record) return null;
    const save = loadSaveObject(record.save, now);
    return { save, version: record.version ?? record.save?.version ?? 1 };
  };

  try {
    const current = await attempt(CURRENT_SAVE_KEY);
    if (current) {
      return {
        save: current.save,
        source: 'current',
        recovered: false,
        loadedVersion: current.version,
        migrated: current.version !== CURRENT_SAVE_VERSION,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const backup = await attempt(BACKUP_SAVE_KEY);
      if (backup) {
        return {
          save: backup.save,
          source: 'backup',
          recovered: true,
          loadedVersion: backup.version,
          migrated: backup.version !== CURRENT_SAVE_VERSION,
          error: message,
        };
      }
    } catch {
      // fall through to a fresh save
    }
    return {
      save: createDefaultSave({ now }),
      source: 'new',
      recovered: false,
      migrated: false,
      error: message,
    };
  }

  return { save: createDefaultSave({ now }), source: 'new', recovered: false, migrated: false };
}

/**
 * Writes the save, first copying the previous good save to the backup slot.
 * Both writes happen in one transaction so a crash cannot lose both.
 */
export async function persistSave(save: SaveGame, now = Date.now()): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = getDatabase();
  const record: SaveRecord = {
    key: CURRENT_SAVE_KEY,
    save: { ...save, updatedAt: now },
    savedAt: now,
    version: save.version,
  };

  await db.transaction('rw', db.saves, async () => {
    const previous = await db.saves.get(CURRENT_SAVE_KEY);
    if (previous) {
      await db.saves.put({ ...previous, key: BACKUP_SAVE_KEY });
    }
    await db.saves.put(record);
  });
}

export async function readBackup(): Promise<SaveGame | null> {
  if (!isIndexedDbAvailable()) return null;
  const record = await getDatabase().saves.get(BACKUP_SAVE_KEY);
  if (!record) return null;
  try {
    return loadSaveObject(record.save);
  } catch {
    return null;
  }
}

export async function resetProgress(now = Date.now()): Promise<SaveGame> {
  const fresh = createDefaultSave({ now });
  if (!isIndexedDbAvailable()) return fresh;
  const db = getDatabase();
  await db.transaction('rw', db.saves, async () => {
    await db.saves.clear();
    await db.saves.put({ key: CURRENT_SAVE_KEY, save: fresh, savedAt: now, version: fresh.version });
  });
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

export interface SaveExport {
  format: 'merge-life-save';
  exportedAt: number;
  version: number;
  save: SaveGame;
}

export function exportSaveToJson(save: SaveGame, now = Date.now()): string {
  const payload: SaveExport = {
    format: 'merge-life-save',
    exportedAt: now,
    version: save.version,
    save,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportFileName(now = Date.now()): string {
  const date = new Date(now);
  const stamp = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  return `merge-life-save-${stamp}.json`;
}

/** Parses an exported save. Accepts both the wrapper and a bare save object. */
export function parseSaveJson(json: string, now = Date.now()): SaveGame {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SaveCorruptError('That file is not valid JSON.');
  }

  const candidate =
    parsed && typeof parsed === 'object' && 'save' in (parsed as Record<string, unknown>)
      ? (parsed as SaveExport).save
      : parsed;

  return loadSaveObject(candidate, now);
}

export async function importSaveFromJson(json: string, now = Date.now()): Promise<SaveGame> {
  const save = parseSaveJson(json, now);
  await persistSave(save, now);
  return save;
}
