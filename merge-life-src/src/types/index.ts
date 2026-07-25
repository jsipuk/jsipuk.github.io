/**
 * Merge Life domain types.
 *
 * Everything the game knows how to persist is described here. Game rules live
 * in `src/game/*` and never inside React components; these types are the shared
 * contract between the two.
 */

/* ------------------------------------------------------------------ */
/* Rooms and chains                                                    */
/* ------------------------------------------------------------------ */

export type RoomId = 'watch-workshop' | 'fitness-garage' | 'bike-workshop' | 'play-room';

export type RoomStatus = 'available' | 'coming-soon';

export type ChainId =
  | 'watch-movement'
  | 'watch-exterior'
  | 'watch-design'
  | 'fitness-strength'
  | 'bike-build'
  | 'play-blocks'
  | 'play-art'
  | 'play-puzzle'
  | 'play-toys';

/** Broad role a chain plays when crafting a finished object. */
export type ChainRole = 'movement' | 'exterior' | 'design' | 'general';

export interface ItemDefinition {
  /** Deterministic id, e.g. "watch-movement-3". */
  id: string;
  chainId: ChainId;
  /** 1-based position within its chain. */
  level: number;
  name: string;
  /** One short, original sentence shown on the item detail sheet. */
  description: string;
  /** Accessible label used by screen readers and icon alt text. */
  ariaLabel: string;
  /** Icon key resolved by `components/board/ItemArt.tsx`. */
  art: string;
  /** Base hue used by the CSS/SVG artwork. */
  tone: string;
}

export interface ItemChain {
  id: ChainId;
  roomId: RoomId;
  name: string;
  role: ChainRole;
  description: string;
  tone: string;
  levels: ItemDefinition[];
}

export interface WorkshopRoom {
  id: RoomId;
  name: string;
  tagline: string;
  description: string;
  status: RoomStatus;
  chainIds: ChainId[];
  accent: string;
  /** Short note shown on locked rooms. Never a countdown, never a tease. */
  comingSoonNote?: string;
}

/* ------------------------------------------------------------------ */
/* Board and items                                                     */
/* ------------------------------------------------------------------ */

export interface BoardPosition {
  col: number;
  row: number;
}

export interface MergeItem {
  id: string;
  definitionId: string;
  chainId: ChainId;
  level: number;
  createdAt: number;
  /** Cosmetic variant, e.g. a polished finish earned from an order. */
  variant?: string;
  /** Generator this item originally came from, when applicable. */
  sourceGeneratorId?: string;
  position: BoardPosition;
}

export interface BoardCell {
  /** Row-major index: row * columns + col. */
  index: number;
  col: number;
  row: number;
  item: MergeItem | null;
}

export interface Board {
  columns: number;
  rows: number;
  cells: BoardCell[];
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

export interface Generator {
  id: string;
  roomId: RoomId;
  chainId: ChainId;
  name: string;
  description: string;
  /** Definition ids this generator can produce, weighted by `outputWeights`. */
  outputDefinitionIds: string[];
  outputWeights: number[];
  usesPerSession: number;
  usesRemaining: number;
  art: string;
  tone: string;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export type OrderRequirementKind =
  | 'create-item'
  | 'merge-in-chain'
  | 'merge-any'
  | 'build-watch';

export interface OrderRequirement {
  kind: OrderRequirementKind;
  /** Required for `create-item`. */
  definitionId?: string;
  /** Required for `merge-in-chain`. */
  chainId?: ChainId;
  target: number;
  progress: number;
  label: string;
}

export interface Order {
  id: string;
  title: string;
  description: string;
  requirements: OrderRequirement[];
  createdAt: number;
  completedAt: number | null;
  /** Cosmetic tokens awarded on completion. Never purchasable. */
  rewardTokens: number;
  /** Workshop progress points awarded on completion. */
  rewardProgress: number;
}

/* ------------------------------------------------------------------ */
/* Sessions and stats                                                  */
/* ------------------------------------------------------------------ */

export type SessionEndReason = 'timer' | 'player' | 'interrupted';

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  plannedDurationMs: number;
  /** Wall-clock duration, filled in when the session closes. */
  actualDurationMs: number;
  endedOnTime: boolean;
  endReason: SessionEndReason | null;
  itemsCreated: number;
  merges: number;
  ordersCompleted: number;
  discoveries: string[];
  watchesCompleted: number;
  /** Workshop progress earned during this session. */
  progressEarned: number;
  /** Local calendar day (YYYY-MM-DD) the session started in. */
  dayKey: string;
}

export interface PlayerStats {
  totalPlayMs: number;
  totalSessions: number;
  totalMerges: number;
  totalItemsCreated: number;
  totalOrdersCompleted: number;
  totalWatchesBuilt: number;
  sessionsEndedOnTime: number;
  /** Sorted list of local day keys on which at least one session happened. */
  daysPlayed: string[];
  workshopProgress: number;
  cosmeticTokens: number;
}

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

export type WatchArchetypeId =
  | 'field'
  | 'diver'
  | 'gmt'
  | 'dress'
  | 'pilot'
  | 'racing';

export interface WatchArchetype {
  id: WatchArchetypeId;
  name: string;
  /** Deterministic serial prefix, e.g. "FLD". */
  serialPrefix: string;
  caseStyle: string;
  dialStyle: string;
  accentStyle: string;
  description: string;
  /** Minimum chain levels needed, keyed by chain role. */
  requires: { movement: number; exterior: number; design: number };
  /** Higher tiers are preferred when several archetypes are satisfied. */
  tier: number;
  palette: {
    case: string;
    dial: string;
    accent: string;
    strap: string;
  };
}

export interface CollectionComponent {
  definitionId: string;
  name: string;
  chainId: ChainId;
  level: number;
}

export interface CollectionEntry {
  id: string;
  archetypeId: WatchArchetypeId;
  name: string;
  archetypeName: string;
  caseStyle: string;
  dialStyle: string;
  accentStyle: string;
  completedAt: number;
  serial: string;
  description: string;
  components: CollectionComponent[];
}

export interface WorkshopDecoration {
  id: string;
  name: string;
  description: string;
  category: 'furniture' | 'lighting' | 'surface' | 'storage' | 'nature' | 'view';
  /** Workshop progress points required. Nothing here can be bought with money. */
  cost: number;
  art: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type SessionLengthMinutes = 5 | 10 | 15;

export interface GameSettings {
  preferredSessionMinutes: SessionLengthMinutes;
  maxSessionsPerDay: number;
  reducedMotion: boolean;
  highContrast: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** Player's previous weekly gaming baseline, in minutes. */
  weeklyBaselineMinutes: number;
  /** Whether the player has seen the "welcome back" line this visit. */
  hasSeenIntro: boolean;
}

/* ------------------------------------------------------------------ */
/* Save game                                                           */
/* ------------------------------------------------------------------ */

export interface ActiveSessionState {
  sessionId: string;
  startedAt: number;
  plannedDurationMs: number;
  /** Set when the timer expires; play continues for a short grace window. */
  graceStartedAt: number | null;
  twoMinuteNoticeShown: boolean;
}

export interface SaveGame {
  version: number;
  /** Stable id so exports can be recognised on import. */
  saveId: string;
  createdAt: number;
  updatedAt: number;
  board: Board;
  generators: Generator[];
  activeOrders: Order[];
  completedOrders: Order[];
  discoveredDefinitionIds: string[];
  collection: CollectionEntry[];
  unlockedRoomIds: RoomId[];
  unlockedDecorationIds: string[];
  sessions: Session[];
  activeSession: ActiveSessionState | null;
  stats: PlayerStats;
  settings: GameSettings;
  /** Serial counter per archetype, so serial numbers stay deterministic. */
  serialCounters: Record<string, number>;
}

export interface SaveMigration {
  from: number;
  to: number;
  description: string;
  migrate: (save: AnySave) => AnySave;
}

/** Loose shape used while a save is being migrated between versions. */
export type AnySave = Record<string, unknown> & { version?: number };

/* ------------------------------------------------------------------ */
/* Engine results                                                      */
/* ------------------------------------------------------------------ */

export type MoveOutcome = 'moved' | 'merged' | 'swapped' | 'invalid';

export interface MoveResult {
  outcome: MoveOutcome;
  board: Board;
  /** Populated when `outcome === 'merged'`. */
  createdItem?: MergeItem;
  /** Human-readable reason, shown as calm feedback for invalid moves. */
  message?: string;
}

export interface GameEvent {
  type: 'item-created' | 'merge' | 'watch-built';
  definitionId?: string;
  chainId?: ChainId;
  level?: number;
}
