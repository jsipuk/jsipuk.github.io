import Dexie, { type Table } from 'dexie';
import type { SaveGame } from '@/types';

/**
 * IndexedDB schema.
 *
 * `saves` holds exactly two rows: the live save ("current") and the previous
 * known-good save ("backup"). `meta` holds small key/value entries such as the
 * last successful load time.
 */
export const CURRENT_SAVE_KEY = 'current';
export const BACKUP_SAVE_KEY = 'backup';

export interface SaveRecord {
  key: string;
  save: SaveGame;
  savedAt: number;
  version: number;
}

export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class MergeLifeDatabase extends Dexie {
  saves!: Table<SaveRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'merge-life') {
    super(name);
    this.version(1).stores({
      saves: 'key, savedAt, version',
      meta: 'key, updatedAt',
    });
  }
}

let instance: MergeLifeDatabase | null = null;

export function getDatabase(): MergeLifeDatabase {
  if (!instance) instance = new MergeLifeDatabase();
  return instance;
}

/** Test helper: swap in a fresh database instance. */
export function setDatabase(database: MergeLifeDatabase | null): void {
  instance = database;
}

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
