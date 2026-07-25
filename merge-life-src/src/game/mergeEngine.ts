import {
  getChainMaxLevel,
  getDefinition,
  getNextDefinitionId,
  tryGetDefinition,
} from '@/data/itemChains';
import type {
  Board,
  BoardCell,
  BoardPosition,
  ChainId,
  MergeItem,
  MoveResult,
} from '@/types';
import { createId } from '@/utils/ids';

export const BOARD_COLUMNS = 6;
export const BOARD_ROWS = 8;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function createEmptyBoard(columns = BOARD_COLUMNS, rows = BOARD_ROWS): Board {
  const cells: BoardCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      cells.push({ index: row * columns + col, col, row, item: null });
    }
  }
  return { columns, rows, cells };
}

export function cloneBoard(board: Board): Board {
  return {
    columns: board.columns,
    rows: board.rows,
    cells: board.cells.map((cell) => ({
      ...cell,
      item: cell.item ? { ...cell.item, position: { ...cell.item.position } } : null,
    })),
  };
}

export function indexOf(board: Board, position: BoardPosition): number {
  return position.row * board.columns + position.col;
}

export function isInsideBoard(board: Board, position: BoardPosition): boolean {
  return (
    Number.isInteger(position.col) &&
    Number.isInteger(position.row) &&
    position.col >= 0 &&
    position.row >= 0 &&
    position.col < board.columns &&
    position.row < board.rows
  );
}

export function getCell(board: Board, position: BoardPosition): BoardCell | undefined {
  if (!isInsideBoard(board, position)) return undefined;
  return board.cells[indexOf(board, position)];
}

export function getItemAt(board: Board, position: BoardPosition): MergeItem | null {
  return getCell(board, position)?.item ?? null;
}

export function countItems(board: Board): number {
  return board.cells.reduce((total, cell) => total + (cell.item ? 1 : 0), 0);
}

export function isBoardFull(board: Board): boolean {
  return board.cells.every((cell) => cell.item !== null);
}

export function findFirstEmptyCell(board: Board): BoardCell | undefined {
  return board.cells.find((cell) => cell.item === null);
}

export function allItems(board: Board): MergeItem[] {
  return board.cells.flatMap((cell) => (cell.item ? [cell.item] : []));
}

/* ------------------------------------------------------------------ */
/* Item creation                                                       */
/* ------------------------------------------------------------------ */

export interface CreateItemOptions {
  variant?: string;
  sourceGeneratorId?: string;
  now?: number;
  id?: string;
}

export function createItem(
  definitionId: string,
  position: BoardPosition,
  options: CreateItemOptions = {},
): MergeItem {
  const definition = getDefinition(definitionId);
  return {
    id: options.id ?? createId('item'),
    definitionId: definition.id,
    chainId: definition.chainId,
    level: definition.level,
    createdAt: options.now ?? Date.now(),
    variant: options.variant,
    sourceGeneratorId: options.sourceGeneratorId,
    position: { ...position },
  };
}

/** Places an item on the board, returning a new board. Throws if occupied. */
export function placeItem(board: Board, item: MergeItem, position: BoardPosition): Board {
  const next = cloneBoard(board);
  const cell = getCell(next, position);
  if (!cell) throw new Error(`Position out of bounds: ${position.col},${position.row}`);
  if (cell.item) throw new Error(`Cell already occupied: ${position.col},${position.row}`);
  cell.item = { ...item, position: { ...position } };
  return next;
}

/** Places an item in the first free cell, or returns null when the board is full. */
export function placeItemInFirstFreeCell(board: Board, item: MergeItem): Board | null {
  const cell = findFirstEmptyCell(board);
  if (!cell) return null;
  return placeItem(board, item, { col: cell.col, row: cell.row });
}

export function removeItemAt(board: Board, position: BoardPosition): Board {
  const next = cloneBoard(board);
  const cell = getCell(next, position);
  if (cell) cell.item = null;
  return next;
}

/* ------------------------------------------------------------------ */
/* Merge rules                                                         */
/* ------------------------------------------------------------------ */

export function isAtMaxLevel(item: MergeItem): boolean {
  return item.level >= getChainMaxLevel(item.chainId);
}

/** Two items merge when they share a chain and level and are not maxed out. */
export function canMerge(a: MergeItem | null, b: MergeItem | null): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return false;
  if (a.chainId !== b.chainId) return false;
  if (a.level !== b.level) return false;
  if (a.definitionId !== b.definitionId) return false;
  return !isAtMaxLevel(a);
}

/** Positions the given item could legally merge into. Used for highlighting. */
export function validMergeTargets(board: Board, source: MergeItem): BoardPosition[] {
  return board.cells
    .filter((cell) => cell.item && canMerge(source, cell.item))
    .map((cell) => ({ col: cell.col, row: cell.row }));
}

export function mergeResultDefinitionId(item: MergeItem): string | undefined {
  return getNextDefinitionId(item.chainId, item.level);
}

/**
 * The single entry point for moving an item.
 *
 * Nothing is ever destroyed here: a move onto an occupied, non-mergeable cell
 * swaps the two items rather than overwriting one of them.
 */
export function moveItem(board: Board, from: BoardPosition, to: BoardPosition): MoveResult {
  const sourceCell = getCell(board, from);
  const targetCell = getCell(board, to);

  if (!sourceCell || !targetCell) {
    return { outcome: 'invalid', board, message: 'That spot is off the board.' };
  }
  if (!sourceCell.item) {
    return { outcome: 'invalid', board, message: 'There is nothing to move there.' };
  }
  if (sourceCell.index === targetCell.index) {
    return { outcome: 'invalid', board, message: 'That item is already there.' };
  }

  const next = cloneBoard(board);
  const nextSource = next.cells[sourceCell.index];
  const nextTarget = next.cells[targetCell.index];
  const moving = nextSource.item as MergeItem;

  if (!nextTarget.item) {
    nextSource.item = null;
    nextTarget.item = { ...moving, position: { col: nextTarget.col, row: nextTarget.row } };
    return { outcome: 'moved', board: next };
  }

  if (canMerge(moving, nextTarget.item)) {
    const nextDefinitionId = mergeResultDefinitionId(moving);
    if (!nextDefinitionId) {
      return {
        outcome: 'invalid',
        board,
        message: 'This is the top of its chain. Nothing higher to make.',
      };
    }
    const created = createItem(
      nextDefinitionId,
      { col: nextTarget.col, row: nextTarget.row },
      { variant: moving.variant ?? nextTarget.item.variant },
    );
    nextSource.item = null;
    nextTarget.item = created;
    return { outcome: 'merged', board: next, createdItem: created };
  }

  if (moving.definitionId === nextTarget.item.definitionId && isAtMaxLevel(moving)) {
    return {
      outcome: 'invalid',
      board,
      message: 'These are already at the top of their chain.',
    };
  }

  // Different items: swap places. Never delete.
  const displaced = nextTarget.item;
  nextTarget.item = { ...moving, position: { col: nextTarget.col, row: nextTarget.row } };
  nextSource.item = { ...displaced, position: { col: nextSource.col, row: nextSource.row } };
  return { outcome: 'swapped', board: next };
}

/* ------------------------------------------------------------------ */
/* Queries used by orders, crafting and the collection                 */
/* ------------------------------------------------------------------ */

export function itemsInChain(board: Board, chainId: ChainId): MergeItem[] {
  return allItems(board).filter((item) => item.chainId === chainId);
}

export function highestLevelInChain(board: Board, chainId: ChainId): number {
  return itemsInChain(board, chainId).reduce((max, item) => Math.max(max, item.level), 0);
}

export function findItemById(board: Board, itemId: string): MergeItem | undefined {
  return allItems(board).find((item) => item.id === itemId);
}

export function removeItemsById(board: Board, itemIds: string[]): Board {
  const next = cloneBoard(board);
  const ids = new Set(itemIds);
  for (const cell of next.cells) {
    if (cell.item && ids.has(cell.item.id)) cell.item = null;
  }
  return next;
}

/** Repairs positions and drops items whose definitions no longer exist. */
export function normaliseBoard(board: Board): Board {
  const next = cloneBoard(board);
  for (const cell of next.cells) {
    if (!cell.item) continue;
    const definition = tryGetDefinition(cell.item.definitionId);
    if (!definition) {
      cell.item = null;
      continue;
    }
    cell.item.chainId = definition.chainId;
    cell.item.level = definition.level;
    cell.item.position = { col: cell.col, row: cell.row };
  }
  return next;
}
