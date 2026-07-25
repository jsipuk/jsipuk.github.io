'use client';

import { WORKSHOP_DECORATIONS } from '@/data/rooms';
import { Button, Card, classNames, ProgressBar } from '@/components/ui';
import { useGameStore } from '@/state/gameStore';

/**
 * Permanent workshop upgrades.
 *
 * Everything here is earned with workshop progress from orders and finished
 * watches. Nothing decays, nothing expires, and nothing can be bought.
 */
export function WorkshopScene() {
  const progress = useGameStore((state) => state.save.stats.workshopProgress);
  const unlocked = useGameStore((state) => state.save.unlockedDecorationIds);
  const unlockDecoration = useGameStore((state) => state.unlockDecoration);

  const next = WORKSHOP_DECORATIONS.find((decoration) => !unlocked.includes(decoration.id));

  return (
    <Card className="space-y-4">
      <WorkshopIllustration unlockedIds={unlocked} />

      {next ? (
        <div>
          <ProgressBar
            label={`Next upgrade: ${next.name}`}
            value={Math.min(progress, next.cost)}
            max={next.cost}
            valueText={`${Math.min(progress, next.cost)} of ${next.cost}`}
          />
          <p className="mt-2 text-sm text-ink-soft">{next.description}</p>
          <Button
            variant="secondary"
            className="mt-3"
            disabled={progress < next.cost}
            onClick={() => unlockDecoration(next.id)}
          >
            {progress >= next.cost ? `Add the ${next.name.toLowerCase()}` : 'Not yet — it will keep'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          Every upgrade is in place. The workshop is finished, and it stays that way.
        </p>
      )}

      <ul className="flex flex-wrap gap-2" aria-label="Workshop upgrades">
        {WORKSHOP_DECORATIONS.map((decoration) => {
          const has = unlocked.includes(decoration.id);
          return (
            <li key={decoration.id}>
              <span
                className={classNames(
                  'ml-chip',
                  has ? 'border-sage/60 text-ink' : 'border-dashed text-ink-faint',
                )}
              >
                <span aria-hidden="true">{has ? '✓' : '·'}</span>
                {decoration.name}
                <span className="sr-only">{has ? ', added' : `, needs ${decoration.cost} progress`}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** A small, still scene of the bench that gains detail as upgrades are added. */
function WorkshopIllustration({ unlockedIds }: { unlockedIds: string[] }) {
  const has = (id: string) => unlockedIds.includes(id);

  return (
    <svg
      viewBox="0 0 320 160"
      className="w-full rounded-2xl bg-surface-sunken/50"
      role="img"
      aria-label={`Your workshop with ${unlockedIds.length} upgrades in place`}
    >
      {/* wall */}
      <rect
        x="0"
        y="0"
        width="320"
        height="120"
        fill={has('workshop-wallpaper') ? '#e7d8c6' : '#efe8dd'}
      />
      {/* window */}
      {has('window-view') ? (
        <g>
          <rect x="206" y="18" width="86" height="58" rx="4" fill="#cfe0e6" stroke="#8b7b66" strokeWidth="3" />
          <path d="M206 60 Q232 42 254 54 T292 48 L292 76 L206 76 Z" fill="#a8bda2" />
          <path d="M249 18 L249 76 M206 47 L292 47" stroke="#8b7b66" strokeWidth="3" />
        </g>
      ) : null}
      {/* shelf and tool rack */}
      {has('tool-rack') ? (
        <g>
          <rect x="20" y="26" width="120" height="7" rx="3" fill="#9a7c50" />
          {[0, 1, 2, 3, 4].map((index) => (
            <rect key={index} x={28 + index * 22} y={33} width="6" height="22" rx="3" fill="#6f6151" />
          ))}
        </g>
      ) : null}
      {/* display lighting */}
      {has('display-lighting') ? (
        <g>
          <rect x="20" y="22" width="120" height="4" rx="2" fill="#f2d9a0" />
          <path d="M20 26 L140 26 L128 44 L32 44 Z" fill="#f7e6bd" opacity="0.4" />
        </g>
      ) : null}
      {/* storage drawers */}
      {has('storage-drawers') ? (
        <g>
          <rect x="232" y="86" width="72" height="34" rx="4" fill="#b3936a" stroke="#7d6446" strokeWidth="2" />
          {[0, 1, 2].map((row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={238 + col * 34}
                y={90 + row * 10}
                width="28"
                height="8"
                rx="2"
                fill="#c9ab84"
                stroke="#7d6446"
                strokeWidth="1"
              />
            )),
          )}
        </g>
      ) : null}
      {/* bench */}
      <rect
        x="16"
        y="86"
        width={has('storage-drawers') ? 200 : 288}
        height="14"
        rx="4"
        fill={has('better-workbench') ? '#c69a63' : '#b8ab97'}
        stroke="#7d6446"
        strokeWidth="2"
      />
      <rect x="30" y="100" width="12" height="26" rx="3" fill="#8b7355" />
      <rect x={has('storage-drawers') ? 190 : 262} y="100" width="12" height="26" rx="3" fill="#8b7355" />
      {/* lamp */}
      {has('desk-lamp') ? (
        <g>
          <path d="M60 86 L60 58 L84 44" stroke="#5f5346" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M78 36 L98 46 L84 56 Z" fill="#c8a55f" stroke="#5f5346" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="88" cy="52" r="4" fill="#f7e6bd" />
        </g>
      ) : null}
      {/* watch box */}
      {has('walnut-watch-box') ? (
        <g>
          <rect x="120" y="70" width="64" height="16" rx="3" fill="#6b4a32" stroke="#4a3222" strokeWidth="2" />
          <rect x="126" y="74" width="16" height="8" rx="2" fill="#d8c9ae" />
          <rect x="146" y="74" width="16" height="8" rx="2" fill="#d8c9ae" />
          <rect x="166" y="74" width="12" height="8" rx="2" fill="#d8c9ae" />
        </g>
      ) : null}
      {/* plant */}
      {has('bench-plants') ? (
        <g>
          <rect x="196" y="72" width="18" height="14" rx="3" fill="#b5764f" />
          <path d="M205 72 Q198 60 190 58 Q200 56 205 66 Q210 54 220 54 Q212 62 205 72 Z" fill="#6f8f66" />
        </g>
      ) : null}
      {/* floor */}
      <rect x="0" y="120" width="320" height="40" fill={has('oak-floor') ? '#cba173' : '#ded4c4'} />
      {has('oak-floor')
        ? [0, 1, 2, 3, 4, 5].map((index) => (
            <rect key={index} x={index * 54} y="120" width="2" height="40" fill="#b28a5e" />
          ))
        : null}
    </svg>
  );
}
