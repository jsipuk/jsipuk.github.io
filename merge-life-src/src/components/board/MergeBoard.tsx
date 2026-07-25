'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefinition } from '@/data/itemChains';
import { findItemById, validMergeTargets } from '@/game/mergeEngine';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useGameStore } from '@/state/gameStore';
import type { BoardPosition } from '@/types';
import { BoardCellView } from './BoardCellView';
import { ItemArt } from './ItemArt';

const DRAG_THRESHOLD_PX = 6;

interface DragState {
  pointerId: number;
  fromIndex: number;
  itemId: string;
  /** Where the gesture began. The threshold is measured from here, not from
   * the previous move, so a slow drag still counts as a drag. */
  originX: number;
  originY: number;
  x: number;
  y: number;
  active: boolean;
}

/**
 * The merge board.
 *
 * Three input methods, all equal: pointer drag (mouse, touch and pen),
 * tap-to-select then tap-to-place, and full keyboard control. Nothing is
 * removed from the board except by a merge or a confirmed craft.
 */
export function MergeBoard({ interactive }: { interactive: boolean }) {
  const board = useGameStore((state) => state.save.board);
  const selectedItemId = useGameStore((state) => state.selectedItemId);
  const craftSelection = useGameStore((state) => state.craftSelection);
  const lastCreatedItemId = useGameStore((state) => state.lastCreatedItemId);
  const requestMove = useGameStore((state) => state.requestMove);
  const tapCell = useGameStore((state) => state.tapCell);
  const selectItem = useGameStore((state) => state.selectItem);
  const reducedMotion = useReducedMotion();
  const playFeedback = useFeedback();

  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedItem = selectedItemId ? findItemById(board, selectedItemId) : undefined;
  const draggingItem = drag ? findItemById(board, drag.itemId) : undefined;

  const highlightSource = draggingItem ?? selectedItem;
  const mergeTargets = useMemo(() => {
    if (!highlightSource) return new Set<number>();
    return new Set(
      validMergeTargets(board, highlightSource).map(
        (position: BoardPosition) => position.row * board.columns + position.col,
      ),
    );
  }, [board, highlightSource]);

  const positionOf = useCallback(
    (index: number): BoardPosition => ({
      col: index % board.columns,
      row: Math.floor(index / board.columns),
    }),
    [board.columns],
  );

  const cellIndexAtPoint = useCallback((x: number, y: number): number | null => {
    // elementFromPoint is missing in some test environments; drags simply do
    // nothing there, and tap-to-place still works.
    if (typeof document.elementFromPoint !== 'function') return null;
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest('[data-cell-index]') as HTMLElement | null;
    if (!cell) return null;
    const value = Number(cell.dataset.cellIndex);
    return Number.isInteger(value) ? value : null;
  }, []);

  /* -------------------- pointer dragging -------------------- */

  const handlePointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!interactive) return;
      const item = board.cells[index]?.item;
      if (!item) return;
      // Left button / touch / pen only.
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      setDrag({
        pointerId: event.pointerId,
        fromIndex: index,
        itemId: item.id,
        originX: event.clientX,
        originY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        active: false,
      });
    },
    [board.cells, interactive],
  );

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const movedEnough =
        Math.abs(event.clientX - drag.originX) > DRAG_THRESHOLD_PX ||
        Math.abs(event.clientY - drag.originY) > DRAG_THRESHOLD_PX;

      setDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              active: current.active || movedEnough,
            }
          : current,
      );

      if (drag.active || movedEnough) {
        event.preventDefault();
        setDragOverIndex(cellIndexAtPoint(event.clientX, event.clientY));
      }
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const wasActive = drag.active;
      const target = cellIndexAtPoint(event.clientX, event.clientY);

      setDrag(null);
      setDragOverIndex(null);

      if (!wasActive) return; // a tap: the button's onClick handles it
      if (target === null || target === drag.fromIndex) return;

      const willMerge = mergeTargets.has(target);
      requestMove(positionOf(drag.fromIndex), positionOf(target));
      playFeedback(willMerge ? 'merge' : 'gentle');
    };

    const handleCancel = () => {
      setDrag(null);
      setDragOverIndex(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [drag, cellIndexAtPoint, mergeTargets, positionOf, requestMove, playFeedback]);

  /* -------------------- tap and keyboard -------------------- */

  const handleClick = useCallback(
    (index: number) => () => {
      if (!interactive) return;
      const before = useGameStore.getState().save.board;
      const willMerge = mergeTargets.has(index);
      tapCell(positionOf(index));
      const after = useGameStore.getState().save.board;
      if (willMerge && before !== after) playFeedback('merge');
    },
    [interactive, mergeTargets, positionOf, tapCell, playFeedback],
  );

  const handleKeyDown = useCallback(
    (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const { key } = event;
      const arrowDelta: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -board.columns,
        ArrowDown: board.columns,
      };

      if (key in arrowDelta) {
        event.preventDefault();
        const next = index + arrowDelta[key];
        if (next < 0 || next >= board.cells.length) return;
        // Keep left/right movement inside the same row.
        if ((key === 'ArrowLeft' || key === 'ArrowRight') && Math.floor(next / board.columns) !== Math.floor(index / board.columns)) {
          return;
        }
        const target = containerRef.current?.querySelector<HTMLButtonElement>(
          `[data-cell-index="${next}"]`,
        );
        target?.focus();
        return;
      }

      if (key === 'Escape') {
        selectItem(null);
      }
    },
    [board.cells.length, board.columns, selectItem],
  );

  const dragDefinition = draggingItem ? getDefinition(draggingItem.definitionId) : null;

  return (
    <div ref={containerRef}>
      <div
        role="grid"
        aria-label="Merge board, 6 columns by 8 rows"
        aria-readonly={!interactive}
        className="grid grid-cols-6 gap-1.5 rounded-card border border-line/70 bg-surface-sunken/40 p-2 sm:gap-2 sm:p-3"
      >
        {board.cells.map((cell) => (
          <BoardCellView
            key={cell.index}
            cell={cell}
            selected={Boolean(cell.item && cell.item.id === selectedItemId)}
            isMergeTarget={mergeTargets.has(cell.index)}
            isDragOver={dragOverIndex === cell.index && Boolean(drag?.active)}
            isCraftPick={Boolean(cell.item && craftSelection.includes(cell.item.id))}
            justCreated={Boolean(cell.item && cell.item.id === lastCreatedItemId)}
            disabled={!interactive}
            reducedMotion={reducedMotion}
            onPointerDown={handlePointerDown(cell.index)}
            onClick={handleClick(cell.index)}
            onKeyDown={handleKeyDown(cell.index)}
          />
        ))}
      </div>

      {drag?.active && dragDefinition ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 h-16 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          <ItemArt definition={dragDefinition} className="h-full w-full" />
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {selectedItem
          ? `${getDefinition(selectedItem.definitionId).name} selected. Choose a destination cell.`
          : 'No item selected.'}
      </p>
    </div>
  );
}
