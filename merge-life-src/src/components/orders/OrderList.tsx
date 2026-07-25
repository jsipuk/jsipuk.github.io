'use client';

import { Badge, Card, EmptyState, ProgressBar } from '@/components/ui';
import { useGameStore } from '@/state/gameStore';
import type { Order } from '@/types';

/**
 * Orders are short and never expire. They persist between sessions and are
 * never swapped out mid-session, so nothing is ever snatched away.
 */
export function OrderList({ compact = false }: { compact?: boolean }) {
  const orders = useGameStore((state) => state.save.activeOrders);

  if (orders.length === 0) {
    return (
      <EmptyState title="No orders on the bench">
        Three short orders are set out when you begin a session.
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

function OrderCard({ order, compact }: { order: Order; compact: boolean }) {
  return (
    <Card as="div" className="flex h-full flex-col gap-3">
      <div>
        <h3 className="font-semibold leading-tight text-ink">{order.title}</h3>
        {!compact ? <p className="mt-1 text-sm text-ink-soft">{order.description}</p> : null}
      </div>

      <div className="space-y-2.5">
        {order.requirements.map((requirement, index) => (
          <ProgressBar
            key={`${order.id}-${index}`}
            label={requirement.label}
            value={Math.min(requirement.progress, requirement.target)}
            max={requirement.target}
            valueText={`${Math.min(requirement.progress, requirement.target)} of ${requirement.target}`}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Badge tone="brass">+{order.rewardProgress} workshop progress</Badge>
        <Badge tone="sage">
          {order.rewardTokens} cosmetic token{order.rewardTokens === 1 ? '' : 's'}
        </Badge>
      </div>
    </Card>
  );
}
