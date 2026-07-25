import { describe, expect, it } from 'vitest';
import {
  applyEventToOrders,
  generateOrders,
  isOrderComplete,
  orderProgressFraction,
  ORDERS_PER_SESSION,
} from '@/game/orderEngine';
import type { Order } from '@/types';

function orderWith(requirements: Order['requirements']): Order {
  return {
    id: 'order-1',
    title: 'Test order',
    description: 'For tests',
    requirements,
    createdAt: 0,
    completedAt: null,
    rewardTokens: 1,
    rewardProgress: 10,
  };
}

describe('order generation', () => {
  it('creates three distinct orders per session', () => {
    const orders = generateOrders({ seed: 7, reach: 5, now: 1000 });
    expect(orders).toHaveLength(ORDERS_PER_SESSION);
    expect(new Set(orders.map((order) => order.title)).size).toBe(3);
    expect(orders.every((order) => order.completedAt === null)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = generateOrders({ seed: 42, reach: 4, now: 0 });
    const b = generateOrders({ seed: 42, reach: 4, now: 0 });
    expect(a.map((order) => order.title)).toEqual(b.map((order) => order.title));
  });

  it('only offers orders the player can actually reach', () => {
    const early = generateOrders({ seed: 3, reach: 1, now: 0, count: 6 });
    expect(early.some((order) => order.title === 'Build one finished watch')).toBe(false);
    expect(early.some((order) => order.title === 'One Mechanical Movement')).toBe(false);
  });

  it('does not repeat orders the player already has', () => {
    const existing = generateOrders({ seed: 11, reach: 5, now: 0 });
    const fresh = generateOrders({ seed: 12, reach: 5, now: 0, count: 2, existing });
    const existingTitles = new Set(existing.map((order) => order.title));
    expect(fresh.every((order) => !existingTitles.has(order.title))).toBe(true);
  });
});

describe('order completion', () => {
  it('advances a create-item requirement and completes the order', () => {
    const order = orderWith([
      {
        kind: 'create-item',
        definitionId: 'watch-movement-2',
        target: 2,
        progress: 0,
        label: 'Create 2 Watch Gears',
      },
    ]);

    const first = applyEventToOrders([order], {
      type: 'merge',
      definitionId: 'watch-movement-2',
      chainId: 'watch-movement',
      level: 2,
    });
    expect(first.completed).toHaveLength(0);
    expect(first.orders[0].requirements[0].progress).toBe(1);

    const second = applyEventToOrders(first.orders, {
      type: 'merge',
      definitionId: 'watch-movement-2',
      chainId: 'watch-movement',
      level: 2,
    }, 5_000);
    expect(second.completed).toHaveLength(1);
    expect(second.orders[0].completedAt).toBe(5_000);
  });

  it('ignores events that do not match the requirement', () => {
    const order = orderWith([
      {
        kind: 'create-item',
        definitionId: 'watch-design-4',
        target: 1,
        progress: 0,
        label: 'Create one Watch Dial',
      },
    ]);
    const result = applyEventToOrders([order], {
      type: 'merge',
      definitionId: 'watch-movement-2',
      chainId: 'watch-movement',
      level: 2,
    });
    expect(result.orders[0].requirements[0].progress).toBe(0);
    expect(result.completed).toHaveLength(0);
  });

  it('counts merges within a chain', () => {
    let orders = [
      orderWith([
        {
          kind: 'merge-in-chain',
          chainId: 'watch-exterior',
          target: 3,
          progress: 0,
          label: 'Merge 3 Watch Exterior items',
        },
      ]),
    ];
    for (let i = 0; i < 3; i += 1) {
      orders = applyEventToOrders(orders, {
        type: 'merge',
        chainId: 'watch-exterior',
        definitionId: 'watch-exterior-2',
        level: 2,
      }).orders;
    }
    expect(isOrderComplete(orders[0])).toBe(true);
  });

  it('completes a build-watch order only when a watch is built', () => {
    const order = orderWith([
      { kind: 'build-watch', target: 1, progress: 0, label: 'Build one finished watch' },
    ]);
    const merged = applyEventToOrders([order], { type: 'merge', chainId: 'watch-design' });
    expect(merged.completed).toHaveLength(0);
    const built = applyEventToOrders([order], { type: 'watch-built' });
    expect(built.completed).toHaveLength(1);
  });

  it('never advances an order that is already complete', () => {
    const order: Order = {
      ...orderWith([
        {
          kind: 'create-item',
          definitionId: 'watch-movement-2',
          target: 1,
          progress: 1,
          label: 'Create one Watch Gear',
        },
      ]),
      completedAt: 100,
    };
    const result = applyEventToOrders([order], {
      type: 'merge',
      definitionId: 'watch-movement-2',
      chainId: 'watch-movement',
    });
    expect(result.orders[0]).toBe(order);
    expect(result.completed).toHaveLength(0);
  });

  it('reports progress as a fraction across all requirements', () => {
    const order = orderWith([
      { kind: 'merge-any', target: 4, progress: 1, label: 'Merge 4 items' },
      { kind: 'build-watch', target: 1, progress: 0, label: 'Build one watch' },
    ]);
    expect(orderProgressFraction(order)).toBeCloseTo(0.2);
  });
});
