import type { Generator, RoomId, WorkshopDecoration, WorkshopRoom } from '@/types';

/**
 * Rooms in "My Life Workshop".
 *
 * Locked rooms are presented as calm previews. There is deliberately no
 * countdown, no waitlist and no "unlock now" path — they simply are not
 * finished yet.
 */
export const ROOMS: WorkshopRoom[] = [
  {
    id: 'watch-workshop',
    name: 'Watch Workshop',
    tagline: 'Gears, cases and dials',
    description:
      'A quiet bench with good light. Build movements, cases and dials, then bring them together into a watch worth keeping.',
    status: 'available',
    chainIds: ['watch-movement', 'watch-exterior', 'watch-design'],
    accent: 'brass',
  },
  {
    id: 'fitness-garage',
    name: 'Fitness Garage',
    tagline: 'Plates, bars and a bench',
    description:
      'A concrete floor, a rubber mat and everything you need for a short honest session. Build up from a single collar to a full home gym.',
    status: 'coming-soon',
    chainIds: ['fitness-strength'],
    accent: 'clay',
    comingSoonNote: 'Chains are designed. The room opens when it is genuinely good.',
  },
  {
    id: 'bike-workshop',
    name: 'Bike Workshop',
    tagline: 'Bolts, wheels and frames',
    description:
      'A repair stand, a tray of small parts and a wall of tools. Build wheels, groupsets and eventually a whole bike.',
    status: 'coming-soon',
    chainIds: ['bike-build'],
    accent: 'sage',
    comingSoonNote: 'Chains are designed. The room opens when it is genuinely good.',
  },
  {
    id: 'play-room',
    name: 'Play Room',
    tagline: 'Blocks, crayons and puzzles',
    description:
      'A low table covered in half-finished projects. Wooden models, drawings, puzzles and toys made to be handed down.',
    status: 'coming-soon',
    chainIds: ['play-blocks', 'play-art', 'play-puzzle', 'play-toys'],
    accent: 'slate',
    comingSoonNote: 'Chains are designed. The room opens when it is genuinely good.',
  },
];

export const ROOMS_BY_ID: Record<RoomId, WorkshopRoom> = ROOMS.reduce(
  (acc, room) => {
    acc[room.id] = room;
    return acc;
  },
  {} as Record<RoomId, WorkshopRoom>,
);

export const DEFAULT_GENERATOR_USES = 12;

/**
 * Watch Workshop generators. Uses are per session, refresh only when the player
 * deliberately starts a new session, and can never be topped up with money,
 * adverts or waiting.
 */
export const WATCH_GENERATOR_TEMPLATES: Omit<Generator, 'usesRemaining'>[] = [
  {
    id: 'movement-parts-tray',
    roomId: 'watch-workshop',
    chainId: 'watch-movement',
    name: 'Movement Parts Tray',
    description: 'A felt-lined tray of screws and gear blanks.',
    outputDefinitionIds: ['watch-movement-1', 'watch-movement-2'],
    outputWeights: [0.75, 0.25],
    usesPerSession: DEFAULT_GENERATOR_USES,
    art: 'tray',
    tone: 'brass',
  },
  {
    id: 'case-parts-bench',
    roomId: 'watch-workshop',
    chainId: 'watch-exterior',
    name: 'Case Parts Bench',
    description: 'Offcuts of steel and rough case blanks.',
    outputDefinitionIds: ['watch-exterior-1', 'watch-exterior-2'],
    outputWeights: [0.75, 0.25],
    usesPerSession: DEFAULT_GENERATOR_USES,
    art: 'bench',
    tone: 'slate',
  },
  {
    id: 'design-desk',
    roomId: 'watch-workshop',
    chainId: 'watch-design',
    name: 'Design Desk',
    description: 'Paint pots, markers and a very good lamp.',
    outputDefinitionIds: ['watch-design-1', 'watch-design-2'],
    outputWeights: [0.75, 0.25],
    usesPerSession: DEFAULT_GENERATOR_USES,
    art: 'desk',
    tone: 'sage',
  },
];

export function createGenerators(): Generator[] {
  return WATCH_GENERATOR_TEMPLATES.map((template) => ({
    ...template,
    outputDefinitionIds: [...template.outputDefinitionIds],
    outputWeights: [...template.outputWeights],
    usesRemaining: template.usesPerSession,
  }));
}

/**
 * Permanent workshop upgrades. Everything here is earned through workshop
 * progress, never bought, and nothing ever decays or expires.
 */
export const WORKSHOP_DECORATIONS: WorkshopDecoration[] = [
  {
    id: 'better-workbench',
    name: 'Better Workbench',
    description: 'A solid beech top that does not wobble when you lean on it.',
    category: 'furniture',
    cost: 40,
    art: 'workbench',
  },
  {
    id: 'desk-lamp',
    name: 'Desk Lamp',
    description: 'An articulated lamp with a warm, even beam.',
    category: 'lighting',
    cost: 80,
    art: 'lamp',
  },
  {
    id: 'tool-rack',
    name: 'Tool Rack',
    description: 'Screwdrivers in size order, which is its own quiet pleasure.',
    category: 'storage',
    cost: 140,
    art: 'tool-rack',
  },
  {
    id: 'workshop-wallpaper',
    name: 'Workshop Wallpaper',
    description: 'A soft clay-coloured wall that makes the brass look warmer.',
    category: 'surface',
    cost: 210,
    art: 'wallpaper',
  },
  {
    id: 'display-lighting',
    name: 'Display Lighting',
    description: 'Low strip lighting under the shelf, for looking rather than working.',
    category: 'lighting',
    cost: 290,
    art: 'display-light',
  },
  {
    id: 'storage-drawers',
    name: 'Storage Drawers',
    description: 'Twelve shallow drawers, each labelled in careful handwriting.',
    category: 'storage',
    cost: 380,
    art: 'drawers',
  },
  {
    id: 'bench-plants',
    name: 'Plants',
    description: 'A trailing plant on the shelf that somehow keeps surviving.',
    category: 'nature',
    cost: 480,
    art: 'plant',
  },
  {
    id: 'walnut-watch-box',
    name: 'Walnut Watch Box',
    description: 'A lined box with a soft-close lid for the finished watches.',
    category: 'storage',
    cost: 590,
    art: 'watch-box',
  },
  {
    id: 'oak-floor',
    name: 'Oak Floor Finish',
    description: 'Warm boards underfoot that take a knock without complaint.',
    category: 'surface',
    cost: 720,
    art: 'floor',
  },
  {
    id: 'window-view',
    name: 'Window View',
    description: 'A window onto a grey-green hillside and slow weather.',
    category: 'view',
    cost: 880,
    art: 'window',
  },
];

export const DECORATIONS_BY_ID: Record<string, WorkshopDecoration> = WORKSHOP_DECORATIONS.reduce(
  (acc, decoration) => {
    acc[decoration.id] = decoration;
    return acc;
  },
  {} as Record<string, WorkshopDecoration>,
);
