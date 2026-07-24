import { describe, expect, it } from 'vitest';
import { WATCH_ARCHETYPES } from '@/data/watchArchetypes';
import { createItem } from '@/game/mergeEngine';
import {
  buildWatch,
  checkCraftEligibility,
  resolveArchetype,
  undiscoveredArchetypes,
  type CraftComponents,
} from '@/game/watchBuilder';
import type { CollectionEntry } from '@/types';

const at = { col: 0, row: 0 };
const part = (definitionId: string) => createItem(definitionId, at);

function parts(movement: number, exterior: number, design: number): CraftComponents {
  return {
    movement: part(`watch-movement-${movement}`),
    exterior: part(`watch-exterior-${exterior}`),
    design: part(`watch-design-${design}`),
  };
}

describe('finished-watch creation', () => {
  it('needs one part from each of the three watch chains', () => {
    const twoMovements = {
      movement: part('watch-movement-4'),
      exterior: part('watch-movement-4'),
      design: part('watch-design-4'),
    } as unknown as CraftComponents;
    expect(checkCraftEligibility(twoMovements).ok).toBe(false);
    expect(checkCraftEligibility({ movement: part('watch-movement-4') }).ok).toBe(false);
  });

  it('refuses parts below level 4', () => {
    const result = checkCraftEligibility(parts(3, 4, 4));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/level 4/);
  });

  it('makes a Field Watch from three level-4 parts', () => {
    const result = checkCraftEligibility(parts(4, 4, 4));
    expect(result.ok).toBe(true);
    expect(result.archetype?.id).toBe('field');
  });

  it('picks the archetype the components actually qualify for', () => {
    expect(resolveArchetype(parts(4, 5, 4))?.id).toBe('diver');
    expect(resolveArchetype(parts(5, 4, 4))?.id).toBe('gmt');
    expect(resolveArchetype(parts(4, 4, 5))?.id).toBe('pilot');
    expect(resolveArchetype(parts(5, 5, 5))?.id).toBe('racing');
    expect(resolveArchetype(parts(6, 6, 6))?.id).toBe('dress');
    expect(resolveArchetype(parts(3, 3, 3))).toBeUndefined();
  });

  it('is deterministic: the same parts always give the same archetype', () => {
    expect(resolveArchetype(parts(5, 5, 4))?.id).toBe(resolveArchetype(parts(5, 5, 4))?.id);
  });

  it('records everything the collection needs', () => {
    const components = parts(5, 5, 5);
    const { entry, consumedItemIds } = buildWatch(components, {
      now: Date.UTC(2026, 6, 24, 12),
    });

    expect(entry.archetypeId).toBe('racing');
    expect(entry.archetypeName).toBe('Racing Watch');
    expect(entry.serial).toBe('RCG-2026-0001');
    expect(entry.completedAt).toBe(Date.UTC(2026, 6, 24, 12));
    expect(entry.description.length).toBeGreaterThan(20);
    expect(entry.caseStyle).toBeTruthy();
    expect(entry.dialStyle).toBeTruthy();
    expect(entry.accentStyle).toBeTruthy();
    expect(entry.components.map((component) => component.level)).toEqual([5, 5, 5]);
    expect(consumedItemIds).toEqual([
      components.movement.id,
      components.exterior.id,
      components.design.id,
    ]);
  });

  it('numbers serials sequentially per archetype', () => {
    const first = buildWatch(parts(4, 4, 4), { now: Date.UTC(2026, 0, 1) });
    const second = buildWatch(parts(4, 4, 4), {
      now: Date.UTC(2026, 0, 2),
      serialCounters: first.serialCounters,
    });
    const diver = buildWatch(parts(4, 5, 4), {
      now: Date.UTC(2026, 0, 3),
      serialCounters: second.serialCounters,
    });

    expect(first.entry.serial).toBe('FLD-2026-0001');
    expect(second.entry.serial).toBe('FLD-2026-0002');
    expect(diver.entry.serial).toBe('DVR-2026-0001');
    expect(first.entry.name).not.toBe(second.entry.name);
  });

  it('throws rather than quietly consuming parts that do not qualify', () => {
    expect(() => buildWatch(parts(2, 2, 2))).toThrow();
  });

  it('lists archetypes not yet built for the empty silhouettes', () => {
    const built: CollectionEntry[] = [buildWatch(parts(4, 4, 4)).entry];
    const missing = undiscoveredArchetypes(built);
    expect(missing).toHaveLength(WATCH_ARCHETYPES.length - 1);
    expect(missing.some((archetype) => archetype.id === 'field')).toBe(false);
  });
});
