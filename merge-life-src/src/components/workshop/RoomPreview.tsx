'use client';

import Link from 'next/link';
import { CHAINS_BY_ID } from '@/data/itemChains';
import { ItemArt } from '@/components/board/ItemArt';
import { Badge, classNames } from '@/components/ui';
import type { WorkshopRoom } from '@/types';

/**
 * Room cards on the hub. Locked rooms are honest about being unfinished: no
 * countdown, no price, no "unlock now".
 */
export function RoomPreview({ room }: { room: WorkshopRoom }) {
  const chain = CHAINS_BY_ID[room.chainIds[0]];
  const previewLevels = [chain.levels[0], chain.levels[3], chain.levels[6]];
  const available = room.status === 'available';

  const inner = (
    <div
      className={classNames(
        'ml-card flex h-full flex-col gap-3 p-5 transition-colors duration-200 ease-calm',
        available ? 'hover:bg-surface' : 'bg-surface/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-tight text-ink">{room.name}</h3>
          <p className="text-sm text-ink-soft">{room.tagline}</p>
        </div>
        <Badge tone={available ? 'sage' : 'neutral'}>{available ? 'Open' : 'Coming soon'}</Badge>
      </div>

      <p className="text-sm text-ink-soft">{room.description}</p>

      <ul className="mt-auto flex items-center gap-2 pt-1" aria-label={`${room.name} item chain preview`}>
        {previewLevels.map((definition, index) => (
          <li key={definition.id} className="flex items-center gap-2">
            <span
              className={classNames(
                'flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-raised p-1.5',
                !available && 'opacity-70',
              )}
            >
              <ItemArt definition={definition} className="h-full w-full" title={definition.name} />
            </span>
            {index < previewLevels.length - 1 ? (
              <span aria-hidden="true" className="text-ink-faint">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {!available && room.comingSoonNote ? (
        <p className="text-xs text-ink-faint">{room.comingSoonNote}</p>
      ) : null}
    </div>
  );

  if (!available) {
    return (
      <div aria-label={`${room.name}, coming soon`} className="h-full">
        {inner}
      </div>
    );
  }

  return (
    <Link href="/workshop" className="block h-full rounded-card">
      {inner}
    </Link>
  );
}
