// Versioned save envelope and storage. A commit only lands if the stored
// revision is the one the caller last saw, so a double tap, a stale tab or a
// retry after a crash cannot apply the same handover twice. The previous
// snapshot is kept as a backup in the same transaction.

import type { Progress } from './progress.ts';
import { initialProgress } from './progress.ts';

export const SCHEMA_VERSION = 1;
export const DB_NAME = 'lowbridge';
const STORE = 'saves';
const CURRENT = 'current';
const PREVIOUS = 'previous';

export interface PoseData {
  x: number;
  y: number;
  heading: number;
}

/** Where things were at the last safe moment. Positions are checked on load. */
export interface Checkpoint {
  locomotion: 'foot' | 'van' | 'express';
  player: { x: number; y: number; facing: number };
  van: PoseData;
  express: PoseData & { borrowed: boolean };
  /** A chase was on: restart it from the lay-by rather than mid-street. */
  pursuit: boolean;
}

export interface SaveEnvelope {
  schemaVersion: number;
  revision: number;
  savedAt: string;
  progress: Progress;
  checkpoint: Checkpoint | null;
}

export type CommitResult =
  | { ok: true; envelope: SaveEnvelope }
  | { ok: false; reason: 'conflict'; current: SaveEnvelope | null }
  | { ok: false; reason: 'error'; message: string };

export interface SaveStore {
  load(): Promise<SaveEnvelope | null>;
  loadPrevious(): Promise<SaveEnvelope | null>;
  /** Write `next` (revision expected + 1) only if the stored revision is `expected`. */
  commit(expected: number, next: SaveEnvelope): Promise<CommitResult>;
  clear(): Promise<void>;
}

export function freshEnvelope(): SaveEnvelope {
  return { schemaVersion: SCHEMA_VERSION, revision: 0, savedAt: '', progress: initialProgress(), checkpoint: null };
}

export type Validation = { ok: true; envelope: SaveEnvelope } | { ok: false; reason: 'newer' | 'invalid'; detail: string };

const isInt = (v: unknown) => Number.isInteger(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Check shape, IDs and ranges. A newer schema is reported, never altered. */
export function validateEnvelope(raw: unknown): Validation {
  const bad = (detail: string): Validation => ({ ok: false, reason: 'invalid', detail });
  if (!raw || typeof raw !== 'object') return bad('not an object');
  const e = raw as Partial<SaveEnvelope>;
  if (!isInt(e.schemaVersion)) return bad('schemaVersion');
  if ((e.schemaVersion as number) > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer', detail: `schema ${e.schemaVersion} is newer than ${SCHEMA_VERSION}` };
  }
  if (!isInt(e.revision) || (e.revision as number) < 0) return bad('revision');
  const p = e.progress as Progress | undefined;
  if (!p || typeof p !== 'object') return bad('progress');
  if (!['offered', 'carrying', 'delivered'].includes(p.story?.stage)) return bad('story.stage');
  if (!Array.isArray(p.cargo) || !Array.isArray(p.flags) || !Array.isArray(p.completed)) return bad('lists');
  for (const c of ['ferry', 'market'] as const) {
    if (!isInt(p.crews?.[c]) || p.crews[c] < -2 || p.crews[c] > 3) return bad(`crews.${c}`);
  }
  const creatures = ['wickwing', 'clatterjack'];
  if (!Array.isArray(p.roster) || !p.roster.every((c) => creatures.includes(c))) return bad('roster');
  if (!Array.isArray(p.team) || p.team.length > 2 || !p.team.every((c) => p.roster.includes(c))) return bad('team');
  if (p.recipient !== null && !['mo_vale', 'nell_price'].includes(p.recipient)) return bad('recipient');
  const cp = e.checkpoint;
  if (cp) {
    const poses = [cp.player, cp.van, cp.express];
    if (!poses.every((q) => q && isNum(q.x) && isNum(q.y))) return bad('checkpoint positions');
    if (!['foot', 'van', 'express'].includes(cp.locomotion)) return bad('checkpoint locomotion');
  }
  return { ok: true, envelope: e as SaveEnvelope };
}

// ------------------------------------------------------------------ memory

/** In-memory store for tests. `failWrites` simulates a storage failure. */
export function createMemoryStore(opts: { failWrites?: boolean } = {}): SaveStore & { failWrites: boolean } {
  let current: SaveEnvelope | null = null;
  let previous: SaveEnvelope | null = null;
  const store = {
    failWrites: opts.failWrites ?? false,
    async load() {
      return current ? structuredClone(current) : null;
    },
    async loadPrevious() {
      return previous ? structuredClone(previous) : null;
    },
    async commit(expected: number, next: SaveEnvelope): Promise<CommitResult> {
      if (store.failWrites) return { ok: false, reason: 'error', message: 'Simulated storage failure' };
      const stored = current?.revision ?? 0;
      if (stored !== expected) return { ok: false, reason: 'conflict', current: current ? structuredClone(current) : null };
      previous = current;
      current = structuredClone(next);
      return { ok: true, envelope: structuredClone(next) };
    },
    async clear() {
      current = null;
      previous = null;
    },
  };
  return store;
}

// --------------------------------------------------------------- IndexedDB

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** IndexedDB store in a Lowbridge-only database. */
export function createIdbStore(idb: IDBFactory, name = DB_NAME): SaveStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = idb.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
    return dbPromise;
  };
  const read = async (key: string) => {
    const db = await open();
    const value = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
    return (value as SaveEnvelope | undefined) ?? null;
  };
  return {
    load: () => read(CURRENT),
    loadPrevious: () => read(PREVIOUS),
    async commit(expected, next) {
      try {
        const db = await open();
        return await new Promise<CommitResult>((resolve) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          let result: CommitResult = { ok: true, envelope: next };
          const get = store.get(CURRENT);
          get.onsuccess = () => {
            const current = (get.result as SaveEnvelope | undefined) ?? null;
            if ((current?.revision ?? 0) !== expected) {
              result = { ok: false, reason: 'conflict', current };
              return;
            }
            if (current) store.put(current, PREVIOUS);
            store.put(next, CURRENT);
          };
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => resolve({ ok: false, reason: 'error', message: String(tx.error ?? 'transaction failed') });
          tx.onabort = () => resolve({ ok: false, reason: 'error', message: String(tx.error ?? 'transaction aborted') });
        });
      } catch (err) {
        return { ok: false, reason: 'error', message: String(err) };
      }
    },
    async clear() {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

// --------------------------------------------------------------- controller

export type SaveStatus = 'saved' | 'saving' | 'failed' | 'unsaved';

/**
 * Serialises writes from one tab. Each write carries the progress and a
 * checkpoint; on conflict it adopts the newer stored save and reports it.
 */
export class SaveController {
  revision = 0;
  /** The last progress known to be stored. Checkpoint-only writes reuse it, so they never roll progress back. */
  committed: Progress | null = null;
  status: SaveStatus = 'unsaved';
  lastError = '';
  private queue: Promise<unknown> = Promise.resolve();
  private store: SaveStore;
  /** Called when another tab's newer save replaced ours. */
  onAdopt: (envelope: SaveEnvelope) => void = () => {};

  constructor(store: SaveStore) {
    this.store = store;
  }

  async load(): Promise<Validation | null> {
    const raw = await this.store.load();
    if (!raw) return null;
    const v = validateEnvelope(raw);
    if (v.ok) {
      this.revision = v.envelope.revision;
      this.committed = v.envelope.progress;
    } else if (Number.isInteger((raw as SaveEnvelope).revision)) {
      // Keep the stored revision so a recovered save can be written over it.
      this.revision = (raw as SaveEnvelope).revision;
    }
    return v;
  }

  /** Save where things are, with the last committed progress. Skipped until something has been committed. */
  writeCheckpoint(checkpoint: () => Checkpoint): Promise<boolean> {
    return this.enqueue(() => (this.committed ? { progress: this.committed, checkpoint: checkpoint() } : null));
  }

  /** Commit progress (and where things are). Resolves true once it is durably stored. */
  write(progress: Progress, checkpoint: Checkpoint | null): Promise<boolean> {
    return this.enqueue(() => ({ progress, checkpoint }));
  }

  /** Previous good snapshot, for recovery when the current one is damaged. */
  async loadPrevious(): Promise<SaveEnvelope | null> {
    const prev = await this.store.loadPrevious();
    const v = prev ? validateEnvelope(prev) : null;
    return v && v.ok ? v.envelope : null;
  }

  private enqueue(make: () => { progress: Progress; checkpoint: Checkpoint | null } | null): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      const item = make();
      if (!item) return false;
      const { progress, checkpoint } = item;
      this.status = 'saving';
      const next: SaveEnvelope = {
        schemaVersion: SCHEMA_VERSION,
        revision: this.revision + 1,
        savedAt: new Date().toISOString(),
        progress,
        checkpoint,
      };
      const r = await this.store.commit(this.revision, next);
      if (r.ok) {
        this.revision = next.revision;
        this.committed = progress;
        this.status = 'saved';
        return true;
      }
      if (r.reason === 'conflict') {
        if (r.current) {
          this.revision = r.current.revision;
          this.committed = r.current.progress;
          this.status = 'saved';
          this.onAdopt(r.current);
        }
        return false;
      }
      this.status = 'failed';
      this.lastError = r.message;
      return false;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  clear(): Promise<void> {
    this.revision = 0;
    this.committed = null;
    this.status = 'unsaved';
    return this.store.clear();
  }
}
