import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MergeLifeDatabase, setDatabase } from '@/db/database';
import { createDefaultSave } from '@/db/defaultSave';
import { createItem, placeItem } from '@/game/mergeEngine';
import { createActiveSessionState, createSession } from '@/game/sessionEngine';
import { MergeBoard } from '@/components/board/MergeBoard';
import { GeneratorTray } from '@/components/generators/GeneratorTray';
import { OrderList } from '@/components/orders/OrderList';
import { WatchBox } from '@/components/collection/WatchBox';
import { useGameStore } from '@/state/gameStore';
import { buildWatch } from '@/game/watchBuilder';
import type { SaveGame } from '@/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/workshop',
}));

let counter = 0;

async function setupStore(save: SaveGame) {
  counter += 1;
  const db = new MergeLifeDatabase(`merge-life-components-${counter}`);
  setDatabase(db);
  await db.open();
  useGameStore.setState({
    save,
    status: 'ready',
    toasts: [],
    undoStack: [],
    selectedItemId: null,
    craftSelection: [],
    lastSummary: null,
    lastCreatedItemId: null,
  });
}

function saveInSession(): SaveGame {
  const base = createDefaultSave();
  const session = createSession(10, Date.now());
  return {
    ...base,
    sessions: [session],
    activeSession: createActiveSessionState(session),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MergeBoard', () => {
  it('renders 48 cells with descriptive labels', async () => {
    await setupStore(saveInSession());
    render(<MergeBoard interactive />);

    const grid = screen.getByRole('grid', { name: /merge board/i });
    const cells = within(grid).getAllByRole('button');
    expect(cells).toHaveLength(48);
    expect(cells[0]).toHaveAccessibleName('Empty space, column 1 row 1');
  });

  it('merges with tap-select then tap-destination', async () => {
    const base = saveInSession();
    let board = placeItem(base.board, createItem('watch-movement-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-movement-1', { col: 1, row: 0 }), { col: 1, row: 0 });
    await setupStore({ ...base, board });

    const user = userEvent.setup();
    render(<MergeBoard interactive />);

    await user.click(screen.getByRole('button', { name: /Watch Screw, level 1, column 1 row 1/ }));
    expect(
      screen.getByRole('button', { name: /Watch Screw, level 1, column 1 row 1, selected/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Watch Screw, level 1, column 2 row 1/ }));

    expect(
      screen.getByRole('button', { name: /Watch Gear, level 2, column 2 row 1/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empty space, column 1 row 1' })).toBeInTheDocument();
  });

  it('marks valid merge targets for the selected item', async () => {
    const base = saveInSession();
    let board = placeItem(base.board, createItem('watch-design-2', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-design-2', { col: 5, row: 3 }), { col: 5, row: 3 });
    board = placeItem(board, createItem('watch-design-3', { col: 2, row: 2 }), { col: 2, row: 2 });
    await setupStore({ ...base, board });

    const user = userEvent.setup();
    render(<MergeBoard interactive />);
    await user.click(screen.getByRole('button', { name: /Hour Marker, level 2, column 1 row 1/ }));

    expect(
      screen.getByRole('button', { name: /Hour Marker, level 2, column 6 row 4, can merge here/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Watch Hands.*can merge here/ }),
    ).not.toBeInTheDocument();
  });

  it('swaps rather than deleting when two different items meet', async () => {
    const base = saveInSession();
    let board = placeItem(base.board, createItem('watch-movement-2', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    board = placeItem(board, createItem('watch-design-1', { col: 1, row: 0 }), { col: 1, row: 0 });
    await setupStore({ ...base, board });

    const user = userEvent.setup();
    render(<MergeBoard interactive />);
    await user.click(screen.getByRole('button', { name: /Watch Gear, level 2, column 1 row 1/ }));
    await user.click(screen.getByRole('button', { name: /Paint Mark, level 1, column 2 row 1/ }));

    expect(
      screen.getByRole('button', { name: /Paint Mark, level 1, column 1 row 1/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Watch Gear, level 2, column 2 row 1/ }),
    ).toBeInTheDocument();
  });

  it('is read-only outside a session', async () => {
    const base = createDefaultSave();
    const board = placeItem(base.board, createItem('watch-movement-1', { col: 0, row: 0 }), {
      col: 0,
      row: 0,
    });
    await setupStore({ ...base, board });

    const user = userEvent.setup();
    render(<MergeBoard interactive={false} />);
    await user.click(screen.getByRole('button', { name: /Watch Screw, level 1, column 1 row 1/ }));

    expect(
      screen.getByRole('button', { name: /Watch Screw, level 1, column 1 row 1/ }),
    ).toBeInTheDocument();
    expect(useGameStore.getState().selectedItemId).toBeNull();
  });

  it('supports keyboard navigation across the grid', async () => {
    await setupStore(saveInSession());
    const user = userEvent.setup();
    render(<MergeBoard interactive />);

    const first = screen.getByRole('button', { name: 'Empty space, column 1 row 1' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Empty space, column 2 row 1' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Empty space, column 2 row 2' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Empty space, column 1 row 2' })).toHaveFocus();
  });
});

describe('GeneratorTray', () => {
  it('shows remaining uses and the finished message, without any refill option', async () => {
    const base = saveInSession();
    await setupStore({
      ...base,
      generators: base.generators.map((generator, index) =>
        index === 0 ? { ...generator, usesRemaining: 0 } : generator,
      ),
    });

    render(<GeneratorTray enabled />);

    expect(screen.getByText('That tray is finished for this session.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Movement Parts Tray is finished for this session/ }),
    ).toBeDisabled();
    expect(screen.getAllByText(/12 uses left this session/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/refill/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/advert|ad\b|watch an ad/i)).not.toBeInTheDocument();
  });

  it('adds an item to the board when used', async () => {
    await setupStore(saveInSession());
    const user = userEvent.setup();
    render(<GeneratorTray enabled />);

    await user.click(screen.getByRole('button', { name: /Take a part from the Design Desk/ }));

    const state = useGameStore.getState();
    expect(state.save.board.cells.filter((cell) => cell.item)).toHaveLength(1);
    expect(state.save.generators.find((g) => g.id === 'design-desk')?.usesRemaining).toBe(11);
  });
});

describe('OrderList', () => {
  it('shows progress as text as well as a bar', async () => {
    const base = saveInSession();
    await setupStore({
      ...base,
      activeOrders: [
        {
          id: 'o1',
          title: 'Two Watch Gears',
          description: 'The bench needs a spare pair.',
          requirements: [
            {
              kind: 'create-item',
              definitionId: 'watch-movement-2',
              target: 2,
              progress: 1,
              label: 'Create 2 Watch Gears',
            },
          ],
          createdAt: 0,
          completedAt: null,
          rewardTokens: 1,
          rewardProgress: 12,
        },
      ],
    });

    render(<OrderList />);
    expect(screen.getByText('Two Watch Gears')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Create 2 Watch Gears' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  });

  it('explains the empty state without urgency', async () => {
    await setupStore(saveInSession());
    render(<OrderList />);
    expect(screen.getByText('No orders on the bench')).toBeInTheDocument();
  });
});

describe('WatchBox', () => {
  it('shows built watches and silhouettes for the rest', async () => {
    const built = buildWatch(
      {
        movement: createItem('watch-movement-4', { col: 0, row: 0 }),
        exterior: createItem('watch-exterior-4', { col: 1, row: 0 }),
        design: createItem('watch-design-4', { col: 2, row: 0 }),
      },
      { now: Date.UTC(2026, 5, 1, 12) },
    );

    await setupStore({ ...createDefaultSave(), collection: [built.entry] });
    render(<WatchBox />);

    expect(screen.getByText(built.entry.name)).toBeInTheDocument();
    expect(screen.getByText('Archetypes discovered')).toBeInTheDocument();
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    expect(screen.getAllByText('Not built yet')).toHaveLength(5);
  });

  it('opens a detail view with components and serial number', async () => {
    const built = buildWatch(
      {
        movement: createItem('watch-movement-5', { col: 0, row: 0 }),
        exterior: createItem('watch-exterior-5', { col: 1, row: 0 }),
        design: createItem('watch-design-5', { col: 2, row: 0 }),
      },
      { now: Date.UTC(2026, 5, 1, 12) },
    );
    await setupStore({ ...createDefaultSave(), collection: [built.entry] });

    const user = userEvent.setup();
    render(<WatchBox />);
    await user.click(screen.getByRole('button', { name: new RegExp(built.entry.name) }));

    expect(screen.getByText(built.entry.serial)).toBeInTheDocument();
    expect(screen.getByText(/Mechanical Movement · level 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to the watch box/ })).toBeInTheDocument();
  });
});
