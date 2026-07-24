import { CHAINS_BY_ID, getDefinition, WATCH_CHAIN_IDS } from '@/data/itemChains';
import type { ChainId, GameEvent, Order, OrderRequirement } from '@/types';
import { createId, createRng } from '@/utils/ids';

export const ORDERS_PER_SESSION = 3;

interface OrderTemplate {
  id: string;
  /** Highest chain level the player has reached; gates which orders can appear. */
  minReach: number;
  build: (rng: () => number) => Omit<Order, 'id' | 'createdAt' | 'completedAt'>;
}

function createItemRequirement(definitionId: string, target: number): OrderRequirement {
  const definition = getDefinition(definitionId);
  return {
    kind: 'create-item',
    definitionId,
    target,
    progress: 0,
    label: target === 1 ? `Create one ${definition.name}` : `Create ${target} ${definition.name}s`,
  };
}

function mergeChainRequirement(chainId: ChainId, target: number): OrderRequirement {
  const chain = CHAINS_BY_ID[chainId];
  return {
    kind: 'merge-in-chain',
    chainId,
    target,
    progress: 0,
    label: `Merge ${target} ${chain.name} items`,
  };
}

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length) % values.length];
}

const TEMPLATES: OrderTemplate[] = [
  {
    id: 'two-gears',
    minReach: 1,
    build: () => ({
      title: 'Two Watch Gears',
      description: 'The bench needs a spare pair of gears cut and ready.',
      requirements: [createItemRequirement('watch-movement-2', 2)],
      rewardTokens: 1,
      rewardProgress: 12,
    }),
  },
  {
    id: 'case-blanks',
    minReach: 1,
    build: () => ({
      title: 'Two Case Blanks',
      description: 'Turn a couple of blanks so the polishing can start tomorrow.',
      requirements: [createItemRequirement('watch-exterior-2', 2)],
      rewardTokens: 1,
      rewardProgress: 12,
    }),
  },
  {
    id: 'hour-markers',
    minReach: 1,
    build: () => ({
      title: 'Three Hour Markers',
      description: 'Apply a few markers while the light is good.',
      requirements: [createItemRequirement('watch-design-2', 3)],
      rewardTokens: 1,
      rewardProgress: 14,
    }),
  },
  {
    id: 'merge-six',
    minReach: 1,
    build: (rng) => {
      const chainId = pick(rng, WATCH_CHAIN_IDS);
      return {
        title: `Work through the ${CHAINS_BY_ID[chainId].name} chain`,
        description: 'Steady progress, nothing fancy.',
        requirements: [mergeChainRequirement(chainId, 6)],
        rewardTokens: 1,
        rewardProgress: 14,
      };
    },
  },
  {
    id: 'one-dial',
    minReach: 3,
    build: () => ({
      title: 'One Watch Dial',
      description: 'A finished dial, printed evenly and set aside to dry.',
      requirements: [createItemRequirement('watch-design-4', 1)],
      rewardTokens: 2,
      rewardProgress: 22,
    }),
  },
  {
    id: 'one-gear-train',
    minReach: 2,
    build: () => ({
      title: 'One Gear Train',
      description: 'Mesh three wheels so power can travel across the plate.',
      requirements: [createItemRequirement('watch-movement-3', 1)],
      rewardTokens: 1,
      rewardProgress: 18,
    }),
  },
  {
    id: 'polished-case',
    minReach: 2,
    build: () => ({
      title: 'One Polished Case',
      description: 'Take a blank all the way through to a soft, even shine.',
      requirements: [createItemRequirement('watch-exterior-3', 1)],
      rewardTokens: 1,
      rewardProgress: 18,
    }),
  },
  {
    id: 'mechanical-movement',
    minReach: 4,
    build: () => ({
      title: 'One Mechanical Movement',
      description: 'A complete movement, ticking away on the bench.',
      requirements: [createItemRequirement('watch-movement-5', 1)],
      rewardTokens: 3,
      rewardProgress: 34,
    }),
  },
  {
    id: 'build-a-watch',
    minReach: 4,
    build: () => ({
      title: 'Build one finished watch',
      description: 'Bring a movement, a case and a dial together.',
      requirements: [
        {
          kind: 'build-watch',
          target: 1,
          progress: 0,
          label: 'Build one finished watch',
        },
      ],
      rewardTokens: 4,
      rewardProgress: 45,
    }),
  },
];

export interface GenerateOrdersOptions {
  /** Highest level reached in any watch chain — keeps early orders achievable. */
  reach?: number;
  count?: number;
  seed?: number;
  now?: number;
  /** Orders already active; their templates will not be repeated. */
  existing?: Order[];
}

/**
 * Generates a small set of short orders. Orders are only ever created when a
 * session begins, never mid-session, and never on a timer.
 */
export function generateOrders(options: GenerateOrdersOptions = {}): Order[] {
  const { reach = 1, count = ORDERS_PER_SESSION, now = Date.now() } = options;
  const rng = createRng(options.seed ?? Math.floor(Math.random() * 1_000_000));

  const usedTitles = new Set((options.existing ?? []).map((order) => order.title));
  const available = TEMPLATES.filter((template) => template.minReach <= reach);
  const pool = available.length > 0 ? [...available] : [...TEMPLATES];

  const orders: Order[] = [];
  let guard = 0;
  while (orders.length < count && guard < 200) {
    guard += 1;
    const index = Math.floor(rng() * pool.length) % pool.length;
    const template = pool[index];
    const draft = template.build(rng);
    if (usedTitles.has(draft.title)) {
      if (pool.length <= count) {
        // Not enough distinct templates; allow a repeat rather than looping.
        usedTitles.clear();
      }
      continue;
    }
    usedTitles.add(draft.title);
    orders.push({
      ...draft,
      id: createId('order'),
      createdAt: now,
      completedAt: null,
    });
  }

  return orders;
}

function requirementMatches(requirement: OrderRequirement, event: GameEvent): boolean {
  switch (requirement.kind) {
    case 'create-item':
      return (
        (event.type === 'item-created' || event.type === 'merge') &&
        event.definitionId === requirement.definitionId
      );
    case 'merge-in-chain':
      return event.type === 'merge' && event.chainId === requirement.chainId;
    case 'merge-any':
      return event.type === 'merge';
    case 'build-watch':
      return event.type === 'watch-built';
    default:
      return false;
  }
}

export interface ApplyEventResult {
  orders: Order[];
  completed: Order[];
}

/**
 * Applies a game event to the active orders. Orders are never replaced or
 * expired here — they only ever move forward.
 */
export function applyEventToOrders(
  orders: Order[],
  event: GameEvent,
  now = Date.now(),
): ApplyEventResult {
  const completed: Order[] = [];

  const next = orders.map((order) => {
    if (order.completedAt !== null) return order;

    let changed = false;
    const requirements = order.requirements.map((requirement) => {
      if (requirement.progress >= requirement.target) return requirement;
      if (!requirementMatches(requirement, event)) return requirement;
      changed = true;
      return { ...requirement, progress: Math.min(requirement.target, requirement.progress + 1) };
    });

    if (!changed) return order;

    const isComplete = requirements.every((requirement) => requirement.progress >= requirement.target);
    const updated: Order = {
      ...order,
      requirements,
      completedAt: isComplete ? now : null,
    };
    if (isComplete) completed.push(updated);
    return updated;
  });

  return { orders: next, completed };
}

export function orderProgressFraction(order: Order): number {
  const total = order.requirements.reduce((sum, requirement) => sum + requirement.target, 0);
  const done = order.requirements.reduce(
    (sum, requirement) => sum + Math.min(requirement.progress, requirement.target),
    0,
  );
  return total === 0 ? 0 : done / total;
}

export function isOrderComplete(order: Order): boolean {
  return order.requirements.every((requirement) => requirement.progress >= requirement.target);
}
