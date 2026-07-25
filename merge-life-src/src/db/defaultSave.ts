import { createGenerators } from '@/data/rooms';
import { createEmptyBoard } from '@/game/mergeEngine';
import {
  DEFAULT_MAX_SESSIONS_PER_DAY,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_WEEKLY_BASELINE_MINUTES,
} from '@/game/sessionEngine';
import type { GameSettings, PlayerStats, SaveGame } from '@/types';
import { createId } from '@/utils/ids';

/** Bump this whenever the persisted shape changes, and add a migration. */
export const CURRENT_SAVE_VERSION = 3;

export function createDefaultSettings(): GameSettings {
  return {
    preferredSessionMinutes: DEFAULT_SESSION_MINUTES,
    maxSessionsPerDay: DEFAULT_MAX_SESSIONS_PER_DAY,
    reducedMotion: false,
    highContrast: false,
    // Sound is off by default, as an accessibility and calm-by-default choice.
    soundEnabled: false,
    hapticsEnabled: true,
    weeklyBaselineMinutes: DEFAULT_WEEKLY_BASELINE_MINUTES,
    hasSeenIntro: false,
  };
}

export function createDefaultStats(): PlayerStats {
  return {
    totalPlayMs: 0,
    totalSessions: 0,
    totalMerges: 0,
    totalItemsCreated: 0,
    totalOrdersCompleted: 0,
    totalWatchesBuilt: 0,
    sessionsEndedOnTime: 0,
    daysPlayed: [],
    workshopProgress: 0,
    cosmeticTokens: 0,
  };
}

export interface CreateDefaultSaveOptions {
  now?: number;
  saveId?: string;
}

/** A clean save. Production always begins here. */
export function createDefaultSave(options: CreateDefaultSaveOptions = {}): SaveGame {
  const now = options.now ?? Date.now();
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: options.saveId ?? createId('save'),
    createdAt: now,
    updatedAt: now,
    board: createEmptyBoard(),
    generators: createGenerators(),
    activeOrders: [],
    completedOrders: [],
    discoveredDefinitionIds: [],
    collection: [],
    unlockedRoomIds: ['watch-workshop'],
    unlockedDecorationIds: [],
    sessions: [],
    activeSession: null,
    stats: createDefaultStats(),
    settings: createDefaultSettings(),
    serialCounters: {},
  };
}
