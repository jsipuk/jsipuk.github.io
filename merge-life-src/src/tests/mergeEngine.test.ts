import { describe, expect, it } from 'vitest';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  canMerge,
  createEmptyBoard,
  createItem,
  countItems,
  findFirstEmptyCell,
  getItemAt,
  isAtMaxLevel,
  isBoardFull,
  moveItem,
  normaliseBoard,
  placeItem,
  placeItemInFirstFreeCell,
  removeItemsById,
  validMergeTargets,
} from '@/game/mergeEngine';
import type { Board, BoardPosition } from '@/types';

function boardWith(entries: [string, number, number][]): Board {
  let board = createEmptyBoard();
  for (const [definitionId, col, row] of entries) {
    board = placeItem(board, createItem(definitionId, { col, row }), { col, row });
  }
  return board;
}

const at = (col: number, row: number): BoardPosition => ({ col, row });

describe('board construction', () => {
  it('creates a 6 by 8 board with addressable cells', () => {
    const board = createEmptyBoard();
    expect(board.columns).toBe(BOARD_COLUMNS);
    expect(board.rows).toBe(BOARD_ROWS);
    expect(board.cells).toHaveLength(48);
    expect(board.cells[7]).toMatchObject({ index: 7, col: 1, row: 1 });
    expect(countItems(board)).toBe(0);
  });

  it('reports the first empty cell and fullness', () => {
    let board = createEmptyBoard(2, 2);
    expect(findFirstEmptyCell(board)?.index).toBe(0);
    for (let i = 0; i < 4; i += 1) {
      const placed = placeItemInFirstFreeCell(board, createItem('watch-movement-1', at(0, 0)));
      expect(placed).not.toBeNull();
      board = placed as Board;
    }
    expect(isBoardFull(board)).toBe(true);
    expect(placeItemInFirstFreeCell(board, createItem('watch-movement-1', at(0, 0)))).toBeNull();
  });
});

describe('valid merges', () => {
  it('merges two identical items into the next level', () => {
    const board = boardWith([
      ['watch-movement-1', 0, 0],
      ['watch-movement-1', 1, 0],
    ]);
    const result = moveItem(board, at(0, 0), at(1, 0));

    expect(result.outcome).toBe('merged');
    expect(result.createdItem?.definitionId).toBe('watch-movement-2');
    expect(getItemAt(result.board, at(0, 0))).toBeNull();
    expect(getItemAt(result.board, at(1, 0))?.definitionId).toBe('watch-movement-2');
    expect(countItems(result.board)).toBe(1);
  });

  it('merges Watch Screws into a Watch Gear, as the design says', () => {
    const board = boardWith([
      ['watch-movement-1', 2, 3],
      ['watch-movement-1', 2, 4],
    ]);
    const result = moveItem(board, at(2, 3), at(2, 4));
    expect(result.createdItem?.level).toBe(2);
    expect(result.createdItem?.chainId).toBe('watch-movement');
  });

  it('does not mutate the original board', () => {
    const board = boardWith([
      ['watch-design-2', 0, 0],
      ['watch-design-2', 1, 0],
    ]);
    const before = JSON.stringify(board);
    moveItem(board, at(0, 0), at(1, 0));
    expect(JSON.stringify(board)).toBe(before);
  });

  it('lists valid merge targets for highlighting', () => {
    const board = boardWith([
      ['watch-exterior-2', 0, 0],
      ['watch-exterior-2', 3, 1],
      ['watch-exterior-3', 4, 1],
      ['watch-movement-2', 5, 1],
    ]);
    const source = getItemAt(board, at(0, 0));
    const targets = validMergeTargets(board, source!);
    expect(targets).toEqual([{ col: 3, row: 1 }]);
  });
});

describe('invalid merges', () => {
  it('refuses to merge different chains and swaps instead', () => {
    const board = boardWith([
      ['watch-movement-2', 0, 0],
      ['watch-design-2', 1, 0],
    ]);
    const result = moveItem(board, at(0, 0), at(1, 0));

    expect(result.outcome).toBe('swapped');
    expect(getItemAt(result.board, at(0, 0))?.chainId).toBe('watch-design');
    expect(getItemAt(result.board, at(1, 0))?.chainId).toBe('watch-movement');
    expect(countItems(result.board)).toBe(2);
  });

  it('refuses to merge different levels of the same chain', () => {
    const a = createItem('watch-movement-2', at(0, 0));
    const b = createItem('watch-movement-3', at(1, 0));
    expect(canMerge(a, b)).toBe(false);
  });

  it('rejects moves that start on an empty cell or leave the board', () => {
    const board = boardWith([['watch-movement-1', 0, 0]]);
    expect(moveItem(board, at(3, 3), at(0, 1)).outcome).toBe('invalid');
    expect(moveItem(board, at(0, 0), at(99, 0)).outcome).toBe('invalid');
    expect(moveItem(board, at(0, 0), at(0, 0)).outcome).toBe('invalid');
  });

  it('never deletes an item on an invalid move', () => {
    const board = boardWith([
      ['watch-movement-1', 0, 0],
      ['watch-design-1', 1, 0],
    ]);
    const result = moveItem(board, at(0, 0), at(1, 0));
    expect(countItems(result.board)).toBe(2);
  });
});

describe('highest-level items', () => {
  it('knows when an item is at the top of its chain', () => {
    expect(isAtMaxLevel(createItem('watch-movement-7', at(0, 0)))).toBe(true);
    expect(isAtMaxLevel(createItem('watch-movement-6', at(0, 0)))).toBe(false);
  });

  it('does not merge two top-level items and keeps both', () => {
    const board = boardWith([
      ['watch-movement-7', 0, 0],
      ['watch-movement-7', 1, 0],
    ]);
    const result = moveItem(board, at(0, 0), at(1, 0));

    expect(result.outcome).toBe('invalid');
    expect(result.message).toMatch(/top of their chain/i);
    expect(countItems(result.board)).toBe(2);
  });
});

describe('board movement', () => {
  it('moves an item into an empty cell and updates its position', () => {
    const board = boardWith([['watch-design-3', 0, 0]]);
    const result = moveItem(board, at(0, 0), at(4, 6));

    expect(result.outcome).toBe('moved');
    expect(getItemAt(result.board, at(0, 0))).toBeNull();
    expect(getItemAt(result.board, at(4, 6))?.position).toEqual({ col: 4, row: 6 });
  });

  it('removes only the items asked for when crafting', () => {
    const board = boardWith([
      ['watch-movement-4', 0, 0],
      ['watch-exterior-4', 1, 0],
      ['watch-design-4', 2, 0],
      ['watch-movement-1', 3, 0],
    ]);
    const ids = [getItemAt(board, at(0, 0))!.id, getItemAt(board, at(2, 0))!.id];
    const next = removeItemsById(board, ids);
    expect(countItems(next)).toBe(2);
    expect(getItemAt(next, at(1, 0))).not.toBeNull();
  });
});

describe('normaliseBoard', () => {
  it('repairs positions and drops unknown definitions', () => {
    const board = boardWith([['watch-movement-2', 0, 0]]);
    board.cells[0].item!.position = { col: 9, row: 9 };
    board.cells[1].item = {
      ...createItem('watch-movement-2', at(1, 0)),
      definitionId: 'ghost-item-99',
    };

    const repaired = normaliseBoard(board);
    expect(repaired.cells[0].item?.position).toEqual({ col: 0, row: 0 });
    expect(repaired.cells[1].item).toBeNull();
  });
});
