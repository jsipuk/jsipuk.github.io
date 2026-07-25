import { getDefinition } from '@/data/itemChains';
import {
  ARCHETYPES_BY_ID,
  MIN_CRAFT_LEVEL,
  WATCH_ARCHETYPES,
  WATCH_NAME_PREFIXES,
  WATCH_NAME_SUFFIXES,
} from '@/data/watchArchetypes';
import type {
  CollectionEntry,
  MergeItem,
  WatchArchetype,
  WatchArchetypeId,
} from '@/types';
import { createId, padSerial } from '@/utils/ids';

export interface CraftComponents {
  movement: MergeItem;
  exterior: MergeItem;
  design: MergeItem;
}

export interface CraftEligibility {
  ok: boolean;
  reason?: string;
  archetype?: WatchArchetype;
}

function isFromChain(item: MergeItem | undefined, chainId: string): boolean {
  return Boolean(item && item.chainId === chainId);
}

/**
 * Picks the highest-tier archetype whose minimum component levels are all met.
 * Deterministic: the same three components always produce the same archetype.
 */
export function resolveArchetype(components: CraftComponents): WatchArchetype | undefined {
  const levels = {
    movement: components.movement.level,
    exterior: components.exterior.level,
    design: components.design.level,
  };

  const eligible = WATCH_ARCHETYPES.filter(
    (archetype) =>
      levels.movement >= archetype.requires.movement &&
      levels.exterior >= archetype.requires.exterior &&
      levels.design >= archetype.requires.design,
  );

  if (eligible.length === 0) return undefined;
  return eligible.reduce((best, candidate) => (candidate.tier > best.tier ? candidate : best));
}

export function checkCraftEligibility(
  components: Partial<CraftComponents>,
): CraftEligibility {
  const { movement, exterior, design } = components;

  if (!movement || !exterior || !design) {
    return { ok: false, reason: 'Choose one movement, one case and one dial.' };
  }
  if (
    !isFromChain(movement, 'watch-movement') ||
    !isFromChain(exterior, 'watch-exterior') ||
    !isFromChain(design, 'watch-design')
  ) {
    return { ok: false, reason: 'Each part must come from a different watch chain.' };
  }
  if (
    movement.level < MIN_CRAFT_LEVEL ||
    exterior.level < MIN_CRAFT_LEVEL ||
    design.level < MIN_CRAFT_LEVEL
  ) {
    return {
      ok: false,
      reason: `Every part needs to reach level ${MIN_CRAFT_LEVEL} before it can be cased up.`,
    };
  }

  const archetype = resolveArchetype({ movement, exterior, design });
  if (!archetype) {
    return { ok: false, reason: 'These parts do not fit together yet.' };
  }
  return { ok: true, archetype };
}

export interface BuildWatchOptions {
  now?: number;
  /** Existing per-archetype counts; used for deterministic serial numbers. */
  serialCounters?: Record<string, number>;
  id?: string;
}

export interface BuildWatchResult {
  entry: CollectionEntry;
  serialCounters: Record<string, number>;
  consumedItemIds: string[];
}

function watchName(archetypeId: WatchArchetypeId, sequence: number): string {
  const prefixes = WATCH_NAME_PREFIXES[archetypeId];
  const prefix = prefixes[(sequence - 1) % prefixes.length];
  const suffix = WATCH_NAME_SUFFIXES[Math.floor((sequence - 1) / prefixes.length) % WATCH_NAME_SUFFIXES.length];
  return `${prefix} ${suffix}`;
}

function componentSummary(item: MergeItem) {
  const definition = getDefinition(item.definitionId);
  return {
    definitionId: definition.id,
    name: definition.name,
    chainId: definition.chainId,
    level: definition.level,
  };
}

/**
 * Builds a finished watch. The caller is responsible for removing the consumed
 * items from the board — the returned `consumedItemIds` says which ones.
 */
export function buildWatch(
  components: CraftComponents,
  options: BuildWatchOptions = {},
): BuildWatchResult {
  const eligibility = checkCraftEligibility(components);
  if (!eligibility.ok || !eligibility.archetype) {
    throw new Error(eligibility.reason ?? 'These parts cannot be built into a watch.');
  }

  const archetype = eligibility.archetype;
  const counters = { ...(options.serialCounters ?? {}) };
  const sequence = (counters[archetype.id] ?? 0) + 1;
  counters[archetype.id] = sequence;

  const now = options.now ?? Date.now();
  const year = new Date(now).getFullYear();

  const entry: CollectionEntry = {
    id: options.id ?? createId('watch'),
    archetypeId: archetype.id,
    name: watchName(archetype.id, sequence),
    archetypeName: archetype.name,
    caseStyle: archetype.caseStyle,
    dialStyle: archetype.dialStyle,
    accentStyle: archetype.accentStyle,
    completedAt: now,
    serial: `${archetype.serialPrefix}-${year}-${padSerial(sequence)}`,
    description: archetype.description,
    components: [
      componentSummary(components.movement),
      componentSummary(components.exterior),
      componentSummary(components.design),
    ],
  };

  return {
    entry,
    serialCounters: counters,
    consumedItemIds: [components.movement.id, components.exterior.id, components.design.id],
  };
}

export function archetypeOf(entry: CollectionEntry): WatchArchetype {
  return ARCHETYPES_BY_ID[entry.archetypeId];
}

/** Archetypes not yet built, for the empty silhouettes in the watch box. */
export function undiscoveredArchetypes(collection: CollectionEntry[]): WatchArchetype[] {
  const built = new Set(collection.map((entry) => entry.archetypeId));
  return WATCH_ARCHETYPES.filter((archetype) => !built.has(archetype.id));
}
