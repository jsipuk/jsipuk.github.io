'use client';

import { create } from 'zustand';
import { DECORATIONS_BY_ID, WORKSHOP_DECORATIONS } from '@/data/rooms';
import { getDefinition, tryGetDefinition } from '@/data/itemChains';
import { createDefaultSave } from '@/db/defaultSave';
import { loadSave, persistSave, resetProgress } from '@/db/repositories';
import { createSeededSave } from '@/db/seed';
import {
  allItems,
  cloneBoard,
  createItem,
  findItemById,
  getItemAt,
  isBoardFull,
  moveItem,
  placeItemInFirstFreeCell,
  removeItemsById,
} from '@/game/mergeEngine';
import { applyEventToOrders, generateOrders } from '@/game/orderEngine';
import {
  closeSession,
  createActiveSessionState,
  createSession,
  dailyLimitState,
  GRACE_PERIOD_MS,
  interactionsEnabled,
  recoverInterruptedSession,
} from '@/game/sessionEngine';
import { buildWatch, checkCraftEligibility, type CraftComponents } from '@/game/watchBuilder';
import type {
  Board,
  BoardPosition,
  CollectionEntry,
  GameEvent,
  GameSettings,
  MergeItem,
  Order,
  SaveGame,
  Session,
  SessionEndReason,
  SessionLengthMinutes,
} from '@/types';
import { createRng } from '@/utils/ids';
import { dayKey } from '@/utils/time';

/** Feedback shown as a calm inline toast. Never a modal, never blocking. */
export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'gentle';
}

interface UndoSnapshot {
  board: Board;
  label: string;
}

export interface SessionSummary {
  session: Session;
  discoveries: string[];
  ordersCompleted: number;
  watchesCompleted: number;
  workshopProgressGained: number;
}

export interface GameState {
  save: SaveGame;
  status: 'idle' | 'loading' | 'ready';
  loadSource: 'current' | 'backup' | 'new' | 'unavailable' | null;
  returningPlayer: boolean;
  toasts: Toast[];
  undoStack: UndoSnapshot[];
  selectedItemId: string | null;
  craftSelection: string[];
  lastSummary: SessionSummary | null;
  lastCreatedItemId: string | null;
  pendingSave: boolean;

  /* lifecycle */
  hydrate: () => Promise<void>;
  flush: () => Promise<void>;

  /* session */
  beginSession: (minutes?: SessionLengthMinutes) => void;
  endSession: (reason?: SessionEndReason) => void;
  markTwoMinuteNotice: () => void;
  clearSummary: () => void;

  /* board */
  takeGeneratorPart: (generatorId: string) => void;
  requestMove: (from: BoardPosition, to: BoardPosition) => void;
  selectItem: (itemId: string | null) => void;
  tapCell: (position: BoardPosition) => void;
  undo: () => void;

  /* crafting */
  toggleCraftComponent: (itemId: string) => void;
  clearCraftSelection: () => void;
  craftWatch: () => CollectionEntry | null;

  /* orders, decorations, settings */
  replaceOrders: () => void;
  unlockDecoration: (decorationId: string) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;

  /* saves */
  importSave: (save: SaveGame) => Promise<void>;
  resetAll: () => Promise<void>;
  loadSeed: () => Promise<void>;

  /* toasts */
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const MAX_UNDO = 1;
/** Workshop progress awarded for casing up a finished watch. */
const WATCH_PROGRESS_REWARD = 60;
let toastId = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced autosave: every meaningful action schedules a write. */
function scheduleSave(get: () => GameState, set: (partial: Partial<GameState>) => void) {
  set({ pendingSave: true });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistSave(get().save).finally(() => set({ pendingSave: false }));
  }, 400);
}

function withUpdatedSave(save: SaveGame): SaveGame {
  return { ...save, updatedAt: Date.now() };
}

function currentSession(save: SaveGame): Session | undefined {
  if (!save.activeSession) return undefined;
  return save.sessions.find((session) => session.id === save.activeSession?.sessionId);
}

function updateSession(save: SaveGame, patch: Partial<Session>): SaveGame {
  if (!save.activeSession) return save;
  return {
    ...save,
    sessions: save.sessions.map((session) =>
      session.id === save.activeSession?.sessionId ? { ...session, ...patch } : session,
    ),
  };
}

function highestWatchLevelReached(save: SaveGame): number {
  return save.discoveredDefinitionIds.reduce((max, id) => {
    const definition = tryGetDefinition(id);
    if (!definition || !definition.chainId.startsWith('watch-')) return max;
    return Math.max(max, definition.level);
  }, 1);
}

/** Records a discovery and returns the updated save plus whether it was new. */
function recordDiscovery(save: SaveGame, definitionId: string): { save: SaveGame; isNew: boolean } {
  if (save.discoveredDefinitionIds.includes(definitionId)) return { save, isNew: false };
  const next: SaveGame = {
    ...save,
    discoveredDefinitionIds: [...save.discoveredDefinitionIds, definitionId],
  };
  const session = currentSession(next);
  if (!session) return { save: next, isNew: true };
  return {
    save: updateSession(next, { discoveries: [...session.discoveries, definitionId] }),
    isNew: true,
  };
}

interface EventOutcome {
  save: SaveGame;
  completedOrders: Order[];
}

/** Applies a game event to orders and stats in one place. */
function applyEvent(save: SaveGame, event: GameEvent, now = Date.now()): EventOutcome {
  const { orders, completed } = applyEventToOrders(save.activeOrders, event, now);

  let next: SaveGame = { ...save, activeOrders: orders };

  if (completed.length > 0) {
    const progress = completed.reduce((sum, order) => sum + order.rewardProgress, 0);
    const tokens = completed.reduce((sum, order) => sum + order.rewardTokens, 0);
    const completedIds = new Set(completed.map((order) => order.id));

    next = {
      ...next,
      activeOrders: orders.filter((order) => !completedIds.has(order.id)),
      completedOrders: [...next.completedOrders, ...completed],
      stats: {
        ...next.stats,
        workshopProgress: next.stats.workshopProgress + progress,
        cosmeticTokens: next.stats.cosmeticTokens + tokens,
        totalOrdersCompleted: next.stats.totalOrdersCompleted + completed.length,
      },
    };

    const session = currentSession(next);
    if (session) {
      next = updateSession(next, {
        ordersCompleted: session.ordersCompleted + completed.length,
        progressEarned: session.progressEarned + progress,
      });
    }
  }

  return { save: next, completedOrders: completed };
}

export const useGameStore = create<GameState>((set, get) => ({
  save: createDefaultSave(),
  status: 'idle',
  loadSource: null,
  returningPlayer: false,
  toasts: [],
  undoStack: [],
  selectedItemId: null,
  craftSelection: [],
  lastSummary: null,
  lastCreatedItemId: null,
  pendingSave: false,

  /* ---------------------------------------------------------------- */

  hydrate: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    const result = await loadSave();
    let save = result.save;

    // A session that is still within its planned time (plus grace) is resumed
    // exactly where it was — a refresh or a locked phone should not cost the
    // player a session. One that ran out while they were away is closed
    // honestly, with its duration capped at the length they chose.
    if (save.activeSession) {
      const session = currentSession(save);
      const stillRunning =
        save.activeSession.startedAt + save.activeSession.plannedDurationMs + GRACE_PERIOD_MS >
        Date.now();

      if (session && stillRunning) {
        // Nothing to do: the timer is derived from `startedAt`, so it simply
        // continues from wherever real time has reached.
      } else if (session) {
        const recovered = recoverInterruptedSession(session, save.activeSession);
        const days = new Set(save.stats.daysPlayed);
        days.add(recovered.dayKey);
        save = {
          ...save,
          sessions: save.sessions.map((entry) => (entry.id === recovered.id ? recovered : entry)),
          activeSession: null,
          stats: {
            ...save.stats,
            totalPlayMs: save.stats.totalPlayMs + recovered.actualDurationMs,
            totalSessions: save.stats.totalSessions + 1,
            sessionsEndedOnTime: save.stats.sessionsEndedOnTime + (recovered.endedOnTime ? 1 : 0),
            daysPlayed: Array.from(days).sort(),
          },
        };
      } else {
        save = { ...save, activeSession: null };
      }
    }

    const hasHistory = save.sessions.length > 0 || save.board.cells.some((cell) => cell.item);

    set({
      save,
      status: 'ready',
      loadSource: result.source,
      returningPlayer: hasHistory,
    });

    if (result.recovered) {
      get().pushToast('Recovered your previous save. Nothing was lost.', 'gentle');
    }
    if (result.source !== 'unavailable') {
      void persistSave(save);
    }
  },

  flush: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await persistSave(get().save);
    set({ pendingSave: false });
  },

  /* ---------------------------------------------------------------- */
  /* Sessions                                                          */

  beginSession: (minutes) => {
    const state = get();
    const save = state.save;
    const limit = dailyLimitState(save);
    if (!limit.canStart) {
      state.pushToast('You have used your sessions for today. The workshop is open to look around.', 'gentle');
      return;
    }
    if (save.activeSession) return;

    const length = minutes ?? save.settings.preferredSessionMinutes;
    const now = Date.now();
    const session = createSession(length, now);

    // Generators refresh only here — never on a timer, never for money.
    const generators = save.generators.map((generator) => ({
      ...generator,
      usesRemaining: generator.usesPerSession,
    }));

    // Existing orders are kept. Only top up to three so nothing is snatched away.
    const keptOrders = save.activeOrders.filter((order) => order.completedAt === null);
    const needed = Math.max(0, 3 - keptOrders.length);
    const freshOrders =
      needed > 0
        ? generateOrders({
            reach: highestWatchLevelReached(save),
            count: needed,
            now,
            existing: keptOrders,
            seed: Math.floor(createRng(now)() * 1_000_000),
          })
        : [];

    set({
      save: withUpdatedSave({
        ...save,
        generators,
        sessions: [...save.sessions, session],
        activeSession: createActiveSessionState(session),
        activeOrders: [...keptOrders, ...freshOrders],
        settings: { ...save.settings, preferredSessionMinutes: length, hasSeenIntro: true },
      }),
      undoStack: [],
      selectedItemId: null,
      craftSelection: [],
      lastSummary: null,
    });
    scheduleSave(get, set);
  },

  endSession: (reason = 'player') => {
    const state = get();
    const save = state.save;
    const active = save.activeSession;
    const session = currentSession(save);
    if (!active || !session) return;

    const closed = closeSession(session, { reason });
    const days = new Set(save.stats.daysPlayed);
    days.add(closed.dayKey);

    const next: SaveGame = withUpdatedSave({
      ...save,
      sessions: save.sessions.map((entry) => (entry.id === closed.id ? closed : entry)),
      activeSession: null,
      stats: {
        ...save.stats,
        totalPlayMs: save.stats.totalPlayMs + closed.actualDurationMs,
        totalSessions: save.stats.totalSessions + 1,
        sessionsEndedOnTime: save.stats.sessionsEndedOnTime + (closed.endedOnTime ? 1 : 0),
        daysPlayed: Array.from(days).sort(),
      },
    });

    set({
      save: next,
      selectedItemId: null,
      craftSelection: [],
      undoStack: [],
      lastSummary: {
        session: closed,
        discoveries: closed.discoveries,
        ordersCompleted: closed.ordersCompleted,
        watchesCompleted: closed.watchesCompleted,
        workshopProgressGained: closed.progressEarned,
      },
    });
    void get().flush();
  },

  markTwoMinuteNotice: () => {
    const save = get().save;
    if (!save.activeSession || save.activeSession.twoMinuteNoticeShown) return;
    set({
      save: {
        ...save,
        activeSession: { ...save.activeSession, twoMinuteNoticeShown: true },
      },
    });
    get().pushToast('Two minutes left. Finish what you are working on.', 'gentle');
    scheduleSave(get, set);
  },

  clearSummary: () => set({ lastSummary: null }),

  /* ---------------------------------------------------------------- */
  /* Board                                                             */

  takeGeneratorPart: (generatorId) => {
    const state = get();
    const save = state.save;
    const generator = save.generators.find((entry) => entry.id === generatorId);
    if (!generator) return;

    if (!interactionsEnabled(save.activeSession)) {
      state.pushToast('Start a session when you are ready to work.', 'gentle');
      return;
    }
    if (generator.usesRemaining <= 0) {
      state.pushToast('That tray is finished for this session.', 'gentle');
      return;
    }
    if (isBoardFull(save.board)) {
      state.pushToast('The bench is full. Merge a few things to make room.', 'gentle');
      return;
    }

    const rng = createRng(Date.now() + generator.usesRemaining);
    const roll = rng();
    let cumulative = 0;
    let definitionId = generator.outputDefinitionIds[0];
    for (let i = 0; i < generator.outputDefinitionIds.length; i += 1) {
      cumulative += generator.outputWeights[i] ?? 0;
      if (roll <= cumulative) {
        definitionId = generator.outputDefinitionIds[i];
        break;
      }
    }

    const item = createItem(
      definitionId,
      { col: 0, row: 0 },
      { sourceGeneratorId: generator.id },
    );
    const board = placeItemInFirstFreeCell(save.board, item);
    if (!board) {
      state.pushToast('The bench is full. Merge a few things to make room.', 'gentle');
      return;
    }

    let next: SaveGame = {
      ...save,
      board,
      generators: save.generators.map((entry) =>
        entry.id === generator.id ? { ...entry, usesRemaining: entry.usesRemaining - 1 } : entry,
      ),
      stats: { ...save.stats, totalItemsCreated: save.stats.totalItemsCreated + 1 },
    };

    const session = currentSession(next);
    if (session) next = updateSession(next, { itemsCreated: session.itemsCreated + 1 });

    const discovery = recordDiscovery(next, definitionId);
    next = discovery.save;

    const outcome = applyEvent(next, {
      type: 'item-created',
      definitionId,
      chainId: item.chainId,
      level: item.level,
    });
    next = outcome.save;

    set({
      save: withUpdatedSave(next),
      undoStack: [{ board: cloneBoard(save.board), label: 'generator' }],
      lastCreatedItemId: item.id,
    });

    if (discovery.isNew) {
      state.pushToast(`New discovery: ${getDefinition(definitionId).name}`, 'success');
    }
    for (const order of outcome.completedOrders) {
      state.pushToast(`Order complete: ${order.title}`, 'success');
    }
    if (next.generators.find((entry) => entry.id === generator.id)?.usesRemaining === 0) {
      state.pushToast('That tray is finished for this session.', 'gentle');
    }
    scheduleSave(get, set);
  },

  requestMove: (from, to) => {
    const state = get();
    const save = state.save;

    if (!interactionsEnabled(save.activeSession)) {
      state.pushToast('Start a session when you are ready to work.', 'gentle');
      return;
    }

    const previousBoard = cloneBoard(save.board);
    const result = moveItem(save.board, from, to);

    if (result.outcome === 'invalid') {
      if (result.message) state.pushToast(result.message, 'gentle');
      set({ selectedItemId: null });
      return;
    }

    let next: SaveGame = { ...save, board: result.board };
    let createdName: string | null = null;
    let isNewDiscovery = false;
    const completed: Order[] = [];

    if (result.outcome === 'merged' && result.createdItem) {
      const created = result.createdItem;
      next = {
        ...next,
        stats: {
          ...next.stats,
          totalMerges: next.stats.totalMerges + 1,
          totalItemsCreated: next.stats.totalItemsCreated + 1,
        },
      };
      const session = currentSession(next);
      if (session) {
        next = updateSession(next, {
          merges: session.merges + 1,
          itemsCreated: session.itemsCreated + 1,
        });
      }

      const discovery = recordDiscovery(next, created.definitionId);
      next = discovery.save;
      isNewDiscovery = discovery.isNew;
      createdName = getDefinition(created.definitionId).name;

      const outcome = applyEvent(next, {
        type: 'merge',
        definitionId: created.definitionId,
        chainId: created.chainId,
        level: created.level,
      });
      next = outcome.save;
      completed.push(...outcome.completedOrders);
    }

    set({
      save: withUpdatedSave(next),
      undoStack: [{ board: previousBoard, label: result.outcome }].slice(0, MAX_UNDO),
      selectedItemId: null,
      lastCreatedItemId: result.createdItem?.id ?? null,
    });

    if (isNewDiscovery && createdName) {
      state.pushToast(`New discovery: ${createdName}`, 'success');
    }
    for (const order of completed) {
      state.pushToast(`Order complete: ${order.title}`, 'success');
    }

    if (save.settings.hapticsEnabled && result.outcome === 'merged' && typeof navigator !== 'undefined') {
      navigator.vibrate?.(12);
    }

    scheduleSave(get, set);
  },

  selectItem: (itemId) => set({ selectedItemId: itemId }),

  tapCell: (position) => {
    const state = get();
    const { save, selectedItemId } = state;
    const item = getItemAt(save.board, position);

    if (!selectedItemId) {
      if (item) set({ selectedItemId: item.id });
      return;
    }

    const selected = findItemById(save.board, selectedItemId);
    if (!selected) {
      set({ selectedItemId: item ? item.id : null });
      return;
    }
    if (item && item.id === selected.id) {
      set({ selectedItemId: null });
      return;
    }
    state.requestMove(selected.position, position);
  },

  undo: () => {
    const state = get();
    const snapshot = state.undoStack[0];
    if (!snapshot) {
      state.pushToast('There is nothing to undo.', 'gentle');
      return;
    }
    set({
      save: withUpdatedSave({ ...state.save, board: snapshot.board }),
      undoStack: [],
      selectedItemId: null,
      lastCreatedItemId: null,
    });
    state.pushToast('Move undone.', 'info');
    scheduleSave(get, set);
  },

  /* ---------------------------------------------------------------- */
  /* Crafting                                                          */

  toggleCraftComponent: (itemId) => {
    const state = get();
    const selection = state.craftSelection.includes(itemId)
      ? state.craftSelection.filter((id) => id !== itemId)
      : [...state.craftSelection, itemId].slice(-3);
    set({ craftSelection: selection });
  },

  clearCraftSelection: () => set({ craftSelection: [] }),

  craftWatch: () => {
    const state = get();
    const save = state.save;
    const items = state.craftSelection
      .map((id) => findItemById(save.board, id))
      .filter((item): item is MergeItem => Boolean(item));

    const components: Partial<CraftComponents> = {
      movement: items.find((item) => item.chainId === 'watch-movement'),
      exterior: items.find((item) => item.chainId === 'watch-exterior'),
      design: items.find((item) => item.chainId === 'watch-design'),
    };

    const eligibility = checkCraftEligibility(components);
    if (!eligibility.ok) {
      state.pushToast(eligibility.reason ?? 'Those parts do not fit together yet.', 'gentle');
      return null;
    }

    const result = buildWatch(components as CraftComponents, {
      serialCounters: save.serialCounters,
    });

    let next: SaveGame = {
      ...save,
      board: removeItemsById(save.board, result.consumedItemIds),
      collection: [...save.collection, result.entry],
      serialCounters: result.serialCounters,
      stats: {
        ...save.stats,
        totalWatchesBuilt: save.stats.totalWatchesBuilt + 1,
        workshopProgress: save.stats.workshopProgress + WATCH_PROGRESS_REWARD,
      },
    };

    const session = currentSession(next);
    if (session) {
      next = updateSession(next, {
        watchesCompleted: session.watchesCompleted + 1,
        progressEarned: session.progressEarned + WATCH_PROGRESS_REWARD,
      });
    }

    const outcome = applyEvent(next, { type: 'watch-built' });
    next = outcome.save;

    set({
      save: withUpdatedSave(next),
      craftSelection: [],
      selectedItemId: null,
      undoStack: [],
    });

    state.pushToast(`${result.entry.name} added to your collection.`, 'success');
    for (const order of outcome.completedOrders) {
      state.pushToast(`Order complete: ${order.title}`, 'success');
    }
    void get().flush();
    return result.entry;
  },

  /* ---------------------------------------------------------------- */

  replaceOrders: () => {
    const state = get();
    const save = state.save;
    if (save.activeSession) {
      state.pushToast('Orders stay put during a session. You can swap them before the next one.', 'gentle');
      return;
    }
    const orders = generateOrders({
      reach: highestWatchLevelReached(save),
      count: 3,
      seed: Math.floor(Math.random() * 1_000_000),
    });
    set({ save: withUpdatedSave({ ...save, activeOrders: orders }) });
    state.pushToast('New orders ready for your next session.', 'info');
    scheduleSave(get, set);
  },

  unlockDecoration: (decorationId) => {
    const state = get();
    const save = state.save;
    const decoration = DECORATIONS_BY_ID[decorationId];
    if (!decoration) return;
    if (save.unlockedDecorationIds.includes(decorationId)) return;
    if (save.stats.workshopProgress < decoration.cost) {
      state.pushToast('Not enough workshop progress yet. It will keep for as long as you need.', 'gentle');
      return;
    }
    set({
      save: withUpdatedSave({
        ...save,
        unlockedDecorationIds: [...save.unlockedDecorationIds, decorationId],
      }),
    });
    state.pushToast(`${decoration.name} added to the workshop.`, 'success');
    scheduleSave(get, set);
  },

  updateSettings: (patch) => {
    const state = get();
    set({
      save: withUpdatedSave({ ...state.save, settings: { ...state.save.settings, ...patch } }),
    });
    scheduleSave(get, set);
  },

  /* ---------------------------------------------------------------- */

  importSave: async (save) => {
    await persistSave(save);
    set({
      save,
      undoStack: [],
      selectedItemId: null,
      craftSelection: [],
      lastSummary: null,
      returningPlayer: true,
    });
    get().pushToast('Save imported. Everything is where it was.', 'success');
  },

  resetAll: async () => {
    const fresh = await resetProgress();
    set({
      save: fresh,
      undoStack: [],
      selectedItemId: null,
      craftSelection: [],
      lastSummary: null,
      returningPlayer: false,
    });
    get().pushToast('Progress reset. A clean bench.', 'info');
  },

  loadSeed: async () => {
    const seeded = createSeededSave();
    await persistSave(seeded);
    set({
      save: seeded,
      undoStack: [],
      selectedItemId: null,
      craftSelection: [],
      lastSummary: null,
      returningPlayer: true,
    });
    get().pushToast('Demo save loaded.', 'info');
  },

  /* ---------------------------------------------------------------- */

  pushToast: (message, tone = 'info') => {
    toastId += 1;
    const toast: Toast = { id: toastId, message, tone };
    set({ toasts: [...get().toasts.slice(-2), toast] });
    setTimeout(() => get().dismissToast(toast.id), 4200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

/* ------------------------------------------------------------------ */
/* Selectors                                                           */

export const selectBoardItems = (state: GameState): MergeItem[] => allItems(state.save.board);

export const selectAvailableDecorations = (state: GameState) =>
  WORKSHOP_DECORATIONS.map((decoration) => ({
    decoration,
    unlocked: state.save.unlockedDecorationIds.includes(decoration.id),
    affordable: state.save.stats.workshopProgress >= decoration.cost,
  }));

export const selectTodayKey = () => dayKey(Date.now());

export const selectGraceMs = () => GRACE_PERIOD_MS;
