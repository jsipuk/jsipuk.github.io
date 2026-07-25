'use client';

import { motion } from 'framer-motion';
import { getDefinition } from '@/data/itemChains';
import type { BoardCell } from '@/types';
import { classNames } from '@/components/ui';
import { ItemArt } from './ItemArt';

export interface BoardCellViewProps {
  cell: BoardCell;
  selected: boolean;
  isMergeTarget: boolean;
  isDragOver: boolean;
  isCraftPick: boolean;
  justCreated: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * One board cell. Purely presentational: every rule lives in the merge engine.
 * State is signalled by shape, border weight and text, never by colour alone.
 */
export function BoardCellView({
  cell,
  selected,
  isMergeTarget,
  isDragOver,
  isCraftPick,
  justCreated,
  disabled,
  reducedMotion,
  onPointerDown,
  onClick,
  onKeyDown,
}: BoardCellViewProps) {
  const item = cell.item;
  const definition = item ? getDefinition(item.definitionId) : null;

  const label = definition
    ? `${definition.name}, level ${definition.level}, column ${cell.col + 1} row ${cell.row + 1}${
        selected ? ', selected' : ''
      }${isMergeTarget ? ', can merge here' : ''}`
    : `Empty space, column ${cell.col + 1} row ${cell.row + 1}`;

  return (
    <button
      type="button"
      data-cell-index={cell.index}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled && !item}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={classNames(
        'ml-board-cell relative flex aspect-square items-center justify-center rounded-2xl border transition-colors duration-200 ease-calm',
        item
          ? 'border-line bg-surface-raised shadow-card'
          : 'border-dashed border-line/70 bg-surface-sunken/45',
        selected && 'border-2 border-ink ring-2 ring-ink/25',
        isMergeTarget && !selected && 'border-2 border-brass',
        isDragOver && 'border-2 border-ink bg-surface-raised',
        isCraftPick && 'border-2 border-sage',
      )}
    >
      {definition && item ? (
        <motion.span
          key={item.id}
          initial={
            justCreated && !reducedMotion
              ? { scale: 0.55, opacity: 0, rotate: -6 }
              : { scale: 1, opacity: 1 }
          }
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={
            reducedMotion
              ? { duration: 0.01 }
              : { type: 'spring', stiffness: 340, damping: 22, mass: 0.7 }
          }
          className="flex h-full w-full items-center justify-center p-1.5"
        >
          <ItemArt definition={definition} className="h-full w-full" title={definition.name} />
        </motion.span>
      ) : null}

      {definition ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 right-1 text-[10px] font-semibold tabular-nums text-ink-faint"
        >
          {definition.level}
        </span>
      ) : null}

      {isMergeTarget ? (
        <span
          aria-hidden="true"
          className="absolute left-1 top-0.5 text-[10px] font-bold text-brass"
        >
          +
        </span>
      ) : null}

      {isCraftPick ? (
        <span
          aria-hidden="true"
          className="absolute left-1 top-0.5 text-[10px] font-bold text-sage"
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}
