import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MergeLifeDatabase, setDatabase } from '@/db/database';
import { createDefaultSave } from '@/db/defaultSave';
import { loadSave, persistSave } from '@/db/repositories';
import { createItem, getItemAt, placeItem, countItems } from '@/game/mergeEngine';
import { createActiveSessionState, createSession, GRACE_PERIOD_MS } from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';
import type { SaveGame, SessionLengthMinutes } from '@/types';
import { MINUTE_MS } from '@/utils/time';

let counter = 0;

async function freshStore(save?: SaveGame) {
  counter += 1;
  const db = new MergeLifeDatabase(`merge-life-store-${counter}`);
  setDatabase(db);
  await db.open();

  useGameStore.setState({
    save: save ?? createDefaultSave(),
    status: 'ready',
    toasts: [],
    undoStack: [],
    selectedItemId: null,
    craftSelection: [],
    lastSummary: null,
    lastCreatedItemId: null,
  });
  return useGameStore.getState();
}

function withSession(
  save: SaveGame,
  minutes: SessionLengthMinutes = 10,
  startedAt = Date.now(),
): SaveGame {
  const session = createSession(minutes, startedAt);
  return {
    ...save,
    sessions: [...save.sessions, session],
    activeSession: createActiveSessionState(session),
  };
}

beforeEach(async () => {
  vi.useRealTimers();
  await freshStore();
});

describe('generator use limits', () => {
  it('spends one use per part and stops at zero', async () => {
    await freshStore(withSession(createDefaultSave()));
    const { takeGeneratorPart } = useGameStore.getState();

    for (let i = 0; i < 12; i += 1) takeGeneratorPart('movement-parts-tray');

    let state = useGameStore.getState();
    const tray = state.save.generators.find((generator) => generator.id === 'movement-parts-tray');
    expect(tray?.usesRemaining).toBe(0);
    expect(countItems(state.save.board)).toBe(12);

    takeGeneratorPart('movement-parts-tray');
    state = useGameStore.getState();
    expect(countItems(state.save.board)).toBe(12);
    expect(state.toasts.some((toast) => toast.message.includes('finished for this session'))).toBe(
      true,
    );
  });

  it('does nothing at all outside a session', async () => {
    await freshStore();
    useGameStore.getState().takeGeneratorPart('movement-parts-tray');
    const state = useGameStore.getState();
    expect(countItems(state.save.board)).toBe(0);
    expect(state.save.generators[0].usesRemaining).toBe(12);
  });

  it('refreshes uses only when a new session is started, leaving the board alone', async () => {
    const base = createDefaultSave();
    const board = placeItem(base.board, createItem('watch-movement-2', { col: 1, row: 1 }), {
      col: 1,
      row: 1,
    });
    await freshStore({
      ...base,
      board,
      generators: base.generators.map((generator) => ({ ...generator, usesRemaining: 0 })),
    });

    useGameStore.getState().beginSession(10);
    const state = useGameStore.getState();
    expect(state.save.generators.every((generator) => generator.usesRemaining === 12)).toBe(true);
    expect(getItemAt(state.save.board, { col: 1, row: 1 })?.definitionId).toBe('watch-movement-2');
  });
});

describe('session count limits', () => {
  it('refuses a third session on the same day and says so kindly', async () => {
    await freshStore();
    const { beginSession, endSession } = useGameStore.getState();

    beginSession(5);
    endSession('player');
    useGameStore.getState().clearSummary();
    useGameStore.getState().beginSession(5);
    useGameStore.getState().endSession('player');
    useGameStore.getState().clearSummary();

    useGameStore.getState().beginSession(5);
    const state = useGameStore.getState();
    expect(state.save.activeSession).toBeNull();
    expect(state.save.sessions).toHaveLength(2);
    expect(
      state.toasts.some((toast) => toast.message.includes('used your sessions for today')),
    ).toBe(true);
  });
});

describe('merging through the store', () => {
  it('merges, records the discovery and advances orders', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-movement-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-movement-1', { col: 1, row: 0 }), { col: 1, row: 0 });

    await freshStore({
      ...base,
      board,
      activeOrders: [
        {
          id: 'order-gears',
          title: 'Two Watch Gears',
          description: 'test',
          requirements: [
            {
              kind: 'create-item',
              definitionId: 'watch-movement-2',
              target: 1,
              progress: 0,
              label: 'Create one Watch Gear',
            },
          ],
          createdAt: 0,
          completedAt: null,
          rewardTokens: 1,
          rewardProgress: 12,
        },
      ],
    });

    useGameStore.getState().requestMove({ col: 0, row: 0 }, { col: 1, row: 0 });
    const state = useGameStore.getState();

    expect(getItemAt(state.save.board, { col: 1, row: 0 })?.definitionId).toBe('watch-movement-2');
    expect(state.save.discoveredDefinitionIds).toContain('watch-movement-2');
    expect(state.save.stats.totalMerges).toBe(1);
    expect(state.save.activeOrders).toHaveLength(0);
    expect(state.save.completedOrders).toHaveLength(1);
    expect(state.save.stats.workshopProgress).toBe(12);
    expect(state.save.stats.cosmeticTokens).toBe(1);
    expect(state.save.sessions[0].merges).toBe(1);
  });

  it('records workshop progress against the session it was earned in', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-movement-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-movement-1', { col: 1, row: 0 }), { col: 1, row: 0 });

    await freshStore({
      ...base,
      board,
      activeOrders: [
        {
          id: 'order-gears',
          title: 'One Watch Gear',
          description: 'test',
          requirements: [
            {
              kind: 'create-item',
              definitionId: 'watch-movement-2',
              target: 1,
              progress: 0,
              label: 'Create one Watch Gear',
            },
          ],
          createdAt: 0,
          completedAt: null,
          rewardTokens: 1,
          rewardProgress: 12,
        },
      ],
    });

    useGameStore.getState().requestMove({ col: 0, row: 0 }, { col: 1, row: 0 });
    useGameStore.getState().endSession('player');

    const summary = useGameStore.getState().lastSummary;
    expect(summary?.workshopProgressGained).toBe(12);
    expect(summary?.session.progressEarned).toBe(12);
  });

  it('undoes the most recent move and nothing more', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-design-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-design-1', { col: 1, row: 0 }), { col: 1, row: 0 });
    await freshStore({ ...base, board });

    useGameStore.getState().requestMove({ col: 0, row: 0 }, { col: 1, row: 0 });
    expect(getItemAt(useGameStore.getState().save.board, { col: 1, row: 0 })?.level).toBe(2);

    useGameStore.getState().undo();
    const state = useGameStore.getState();
    expect(getItemAt(state.save.board, { col: 0, row: 0 })?.definitionId).toBe('watch-design-1');
    expect(getItemAt(state.save.board, { col: 1, row: 0 })?.definitionId).toBe('watch-design-1');
    expect(state.undoStack).toHaveLength(0);

    useGameStore.getState().undo();
    expect(useGameStore.getState().toasts.some((toast) => toast.message.includes('nothing to undo'))).toBe(
      true,
    );
  });

  it('refuses moves when no session is running', async () => {
    const base = createDefaultSave();
    const board = placeItem(base.board, createItem('watch-design-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    await freshStore({ ...base, board });

    useGameStore.getState().requestMove({ col: 0, row: 0 }, { col: 3, row: 3 });
    expect(getItemAt(useGameStore.getState().save.board, { col: 0, row: 0 })).not.toBeNull();
  });
});

describe('crafting through the store', () => {
  it('builds a watch, consumes the parts and keeps the entry permanently', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-movement-5', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-exterior-5', { col: 1, row: 0 }), { col: 1, row: 0 });
    board = placeItem(board, createItem('watch-design-5', { col: 2, row: 0 }), { col: 2, row: 0 });
    await freshStore({ ...base, board });

    const ids = [
      getItemAt(board, { col: 0, row: 0 })!.id,
      getItemAt(board, { col: 1, row: 0 })!.id,
      getItemAt(board, { col: 2, row: 0 })!.id,
    ];
    ids.forEach((id) => useGameStore.getState().toggleCraftComponent(id));

    const entry = useGameStore.getState().craftWatch();
    const state = useGameStore.getState();

    expect(entry?.archetypeId).toBe('racing');
    expect(state.save.collection).toHaveLength(1);
    expect(countItems(state.save.board)).toBe(0);
    expect(state.save.stats.totalWatchesBuilt).toBe(1);
    expect(state.save.sessions[0].watchesCompleted).toBe(1);

    // Clearing the board later must not touch the collection.
    useGameStore.setState({ save: { ...state.save, board: createDefaultSave().board } });
    expect(useGameStore.getState().save.collection).toHaveLength(1);
  });

  it('will not build from parts that do not qualify', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-movement-2', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-exterior-2', { col: 1, row: 0 }), { col: 1, row: 0 });
    await freshStore({ ...base, board });

    const ids = [getItemAt(board, { col: 0, row: 0 })!.id, getItemAt(board, { col: 1, row: 0 })!.id];
    ids.forEach((id) => useGameStore.getState().toggleCraftComponent(id));

    expect(useGameStore.getState().craftWatch()).toBeNull();
    expect(countItems(useGameStore.getState().save.board)).toBe(2);
  });
});

describe('hydration and persistence', () => {
  it('restores the exact board and reports a returning player', async () => {
    counter += 1;
    const db = new MergeLifeDatabase(`merge-life-store-${counter}`);
    setDatabase(db);
    await db.open();

    const stored = createDefaultSave();
    stored.board = placeItem(stored.board, createItem('watch-exterior-3', { col: 4, row: 5 }), {
      col: 4,
      row: 5,
    });
    await persistSave(stored);

    useGameStore.setState({ status: 'idle', save: createDefaultSave() });
    await useGameStore.getState().hydrate();

    const state = useGameStore.getState();
    expect(state.status).toBe('ready');
    expect(state.returningPlayer).toBe(true);
    expect(getItemAt(state.save.board, { col: 4, row: 5 })?.definitionId).toBe('watch-exterior-3');
  });

  it('resumes a session that is still within its time after a reload', async () => {
    counter += 1;
    const db = new MergeLifeDatabase(`merge-life-store-${counter}`);
    setDatabase(db);
    await db.open();

    const stored = withSession(createDefaultSave(), 10, Date.now() - 2 * MINUTE_MS);
    await persistSave(stored);

    useGameStore.setState({ status: 'idle', save: createDefaultSave() });
    await useGameStore.getState().hydrate();

    const state = useGameStore.getState();
    expect(state.save.activeSession).not.toBeNull();
    expect(state.save.sessions[0].endedAt).toBeNull();
  });

  it('closes a session that expired while the tab was away', async () => {
    counter += 1;
    const db = new MergeLifeDatabase(`merge-life-store-${counter}`);
    setDatabase(db);
    await db.open();

    const startedAt = Date.now() - 3 * 60 * MINUTE_MS;
    await persistSave(withSession(createDefaultSave(), 10, startedAt));

    useGameStore.setState({ status: 'idle', save: createDefaultSave() });
    await useGameStore.getState().hydrate();

    const state = useGameStore.getState();
    expect(state.save.activeSession).toBeNull();
    expect(state.save.sessions[0].endReason).toBe('interrupted');
    expect(state.save.sessions[0].actualDurationMs).toBe(10 * MINUTE_MS + GRACE_PERIOD_MS);
    expect(state.save.stats.totalSessions).toBe(1);
  });

  it('autosaves after a merge', async () => {
    const base = withSession(createDefaultSave());
    let board = placeItem(base.board, createItem('watch-movement-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-movement-1', { col: 1, row: 0 }), { col: 1, row: 0 });
    await freshStore({ ...base, board });

    useGameStore.getState().requestMove({ col: 0, row: 0 }, { col: 1, row: 0 });
    await useGameStore.getState().flush();

    const reloaded = await loadSave();
    expect(getItemAt(reloaded.save.board, { col: 1, row: 0 })?.definitionId).toBe(
      'watch-movement-2',
    );
  });
});
