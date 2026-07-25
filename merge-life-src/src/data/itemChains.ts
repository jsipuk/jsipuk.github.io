import type { ChainId, ItemChain, ItemDefinition, RoomId, ChainRole } from '@/types';

/**
 * Every merge chain in Merge Life.
 *
 * Chains are declared as plain level descriptors and expanded into
 * `ItemDefinition`s with deterministic ids of the form `<chainId>-<level>`.
 * Only the Watch Workshop chains are playable in this MVP; the rest are fully
 * defined so a future room only needs a board and generators.
 */

interface LevelSeed {
  name: string;
  description: string;
  art: string;
}

interface ChainSeed {
  id: ChainId;
  roomId: RoomId;
  name: string;
  role: ChainRole;
  description: string;
  tone: string;
  levels: LevelSeed[];
}

const chainSeeds: ChainSeed[] = [
  {
    id: 'watch-movement',
    roomId: 'watch-workshop',
    name: 'Watch Movement',
    role: 'movement',
    description: 'The beating heart of a watch: screws, gears and the parts that keep time.',
    tone: 'brass',
    levels: [
      {
        name: 'Watch Screw',
        description: 'A tiny blued screw, barely wider than a grain of rice.',
        art: 'screw',
      },
      {
        name: 'Watch Gear',
        description: 'A toothed brass wheel, cut clean and ready to turn.',
        art: 'gear',
      },
      {
        name: 'Gear Train',
        description: 'Three wheels meshed together so motion can travel across the movement.',
        art: 'gear-train',
      },
      {
        name: 'Escapement',
        description: 'The clever little gatekeeper that releases energy one tick at a time.',
        art: 'escapement',
      },
      {
        name: 'Mechanical Movement',
        description: 'A complete running movement, ticking steadily on the bench.',
        art: 'movement',
      },
      {
        name: 'Finished Movement',
        description: 'Regulated, oiled and quietly accurate. Ready to be cased.',
        art: 'finished-movement',
      },
      {
        name: 'Complication Module',
        description: 'An extra layer of cleverness stacked on top of a fine movement.',
        art: 'complication',
      },
    ],
  },
  {
    id: 'watch-exterior',
    roomId: 'watch-workshop',
    name: 'Watch Exterior',
    role: 'exterior',
    description: 'Metal, shape and shine: everything the outside world touches.',
    tone: 'slate',
    levels: [
      {
        name: 'Metal Fragment',
        description: 'An offcut of steel with rough edges and honest potential.',
        art: 'fragment',
      },
      {
        name: 'Case Blank',
        description: 'A round blank turned on the lathe, still matte and unfinished.',
        art: 'case-blank',
      },
      {
        name: 'Polished Case',
        description: 'Hours of careful work have given this case a soft, even shine.',
        art: 'polished-case',
      },
      {
        name: 'Crystal and Bezel',
        description: 'A clear crystal seated in a bezel, snapped home with a satisfying click.',
        art: 'crystal-bezel',
      },
      {
        name: 'Watch Case Assembly',
        description: 'Case, bezel and gaskets fitted together and checked for a clean seal.',
        art: 'case-assembly',
      },
      {
        name: 'Finished Watch Housing',
        description: 'A complete housing, brushed and ready to protect a movement for decades.',
        art: 'housing',
      },
      {
        name: 'Premium Watch Case',
        description: 'The best case on the bench: crisp lines, deep shine, perfect tolerances.',
        art: 'premium-case',
      },
    ],
  },
  {
    id: 'watch-design',
    roomId: 'watch-workshop',
    name: 'Watch Design',
    role: 'design',
    description: 'The face of the watch, where legibility becomes character.',
    tone: 'sage',
    levels: [
      {
        name: 'Paint Mark',
        description: 'A single dot of luminous paint, waiting to become a marker.',
        art: 'paint-mark',
      },
      {
        name: 'Hour Marker',
        description: 'A crisp applied marker, aligned by eye and by loupe.',
        art: 'hour-marker',
      },
      {
        name: 'Watch Hands',
        description: 'A slim pair of hands, counterweighted so they sweep smoothly.',
        art: 'hands',
      },
      {
        name: 'Watch Dial',
        description: 'A finished dial with even printing and a calm, readable layout.',
        art: 'dial',
      },
      {
        name: 'Dial and Hands Set',
        description: 'Dial and hands matched together so the contrast reads at a glance.',
        art: 'dial-hands',
      },
      {
        name: 'Finished Watch Face',
        description: 'A complete face: balanced, legible and quietly beautiful.',
        art: 'watch-face',
      },
      {
        name: 'Collector Dial',
        description: 'A dial with real depth and texture. The kind people notice slowly.',
        art: 'collector-dial',
      },
    ],
  },

  /* ---------------- Future rooms: data ready, rooms not yet open ---------- */

  {
    id: 'fitness-strength',
    roomId: 'fitness-garage',
    name: 'Strength Kit',
    role: 'general',
    description: 'From a single clip to a garage gym you actually want to use.',
    tone: 'clay',
    levels: [
      { name: 'Weight Clip', description: 'A spring collar that keeps everything where it should be.', art: 'clip' },
      { name: 'Weight Plate', description: 'Cast iron with a rubber edge, kind to the floor.', art: 'plate' },
      { name: 'Dumbbell', description: 'A dependable dumbbell with a knurled handle.', art: 'dumbbell' },
      { name: 'Barbell', description: 'A straight bar with a smooth spin and honest weight.', art: 'barbell' },
      { name: 'Weight Bench', description: 'A padded bench, adjustable and steady underfoot.', art: 'bench' },
      { name: 'Power Rack', description: 'A tall rack with safety arms so you can train alone.', art: 'rack' },
      { name: 'Home Gym', description: 'A corner of the garage that quietly makes the week better.', art: 'home-gym' },
    ],
  },
  {
    id: 'bike-build',
    roomId: 'bike-workshop',
    name: 'Bike Build',
    role: 'general',
    description: 'Small parts, patient hands, and eventually a bike that fits you.',
    tone: 'sage',
    levels: [
      { name: 'Bolt', description: 'A stainless bolt, torqued to the number on the frame.', art: 'bolt' },
      { name: 'Chain Link', description: 'One link, cleaned and lightly oiled.', art: 'chain-link' },
      { name: 'Tyre', description: 'A folding tyre with a supple casing.', art: 'tyre' },
      { name: 'Wheel', description: 'A hand-built wheel, trued until the gap stops moving.', art: 'wheel' },
      { name: 'Groupset', description: 'Shifters, brakes and gears that all agree with each other.', art: 'groupset' },
      { name: 'Bike Frame', description: 'A frame with clean welds and a paint job worth keeping.', art: 'frame' },
      { name: 'Finished Bike', description: 'Built, tuned and pointed at a road you have not ridden yet.', art: 'bike' },
    ],
  },
  {
    id: 'play-blocks',
    roomId: 'play-room',
    name: 'Model Making',
    role: 'general',
    description: 'Loose wooden blocks becoming something worth putting on a shelf.',
    tone: 'brass',
    levels: [
      { name: 'Wooden Block', description: 'A smooth offcut of beech, sanded on every edge.', art: 'block' },
      { name: 'Block Pair', description: 'Two blocks glued square and left to set.', art: 'block-pair' },
      { name: 'Block Frame', description: 'A simple frame that suddenly suggests a shape.', art: 'block-frame' },
      { name: 'Model Base', description: 'A base with enough weight to stand up on its own.', art: 'model-base' },
      { name: 'Model Body', description: 'The main body assembled, joints checked twice.', art: 'model-body' },
      { name: 'Painted Model', description: 'Two thin coats, dried properly between each one.', art: 'painted-model' },
      { name: 'Finished Model', description: 'Done. It sits on the shelf and makes the room friendlier.', art: 'finished-model' },
    ],
  },
  {
    id: 'play-art',
    roomId: 'play-room',
    name: 'Making Art',
    role: 'general',
    description: 'A stub of crayon and an afternoon with nothing else booked.',
    tone: 'clay',
    levels: [
      { name: 'Crayon', description: 'Worn to a comfortable angle from use.', art: 'crayon' },
      { name: 'Colour Set', description: 'Enough colours to stop worrying about which one to pick.', art: 'colour-set' },
      { name: 'Sketch', description: 'Loose lines, no rubbing out yet.', art: 'sketch' },
      { name: 'Line Drawing', description: 'The shapes have settled and the drawing knows what it is.', art: 'line-drawing' },
      { name: 'Coloured Piece', description: 'Colour laid in patiently, layer over layer.', art: 'coloured-piece' },
      { name: 'Framed Picture', description: 'Trimmed, mounted and framed with a wide border.', art: 'framed-picture' },
      { name: 'Finished Artwork', description: 'Hung on the wall where the morning light reaches it.', art: 'finished-artwork' },
    ],
  },
  {
    id: 'play-puzzle',
    roomId: 'play-room',
    name: 'Puzzling',
    role: 'general',
    description: 'One piece at a time, with a cup of tea going cold beside you.',
    tone: 'slate',
    levels: [
      { name: 'Puzzle Piece', description: 'A single piece with two tabs and two blanks.', art: 'puzzle-piece' },
      { name: 'Joined Pair', description: 'Two pieces that clicked together first time.', art: 'joined-pair' },
      { name: 'Edge Section', description: 'A straight run of border, the easy part done.', art: 'edge-section' },
      { name: 'Sky Section', description: 'The hard bit, finished by stubbornness alone.', art: 'sky-section' },
      { name: 'Half Puzzle', description: 'Half the picture, and the shape of the rest is obvious now.', art: 'half-puzzle' },
      { name: 'Almost Complete', description: 'One piece missing, and it is under the sofa.', art: 'almost-complete' },
      { name: 'Completed Puzzle', description: 'Whole. Admired for a day, then boxed up again.', art: 'completed-puzzle' },
    ],
  },
  {
    id: 'play-toys',
    roomId: 'play-room',
    name: 'Toy Workshop',
    role: 'general',
    description: 'Simple wooden toys made to be handed down, not thrown away.',
    tone: 'sage',
    levels: [
      { name: 'Toy Part', description: 'A turned wooden part, still smelling of sawdust.', art: 'toy-part' },
      { name: 'Wheel Set', description: 'Four wheels and two axles that spin freely.', art: 'wheel-set' },
      { name: 'Toy Body', description: 'A rounded body with no sharp corners anywhere.', art: 'toy-body' },
      { name: 'Assembled Toy', description: 'Parts joined, everything moving as it should.', art: 'assembled-toy' },
      { name: 'Sanded Toy', description: 'Sanded to 240 grit, soft in the hand.', art: 'sanded-toy' },
      { name: 'Oiled Toy', description: 'Finished with a food-safe oil and buffed by hand.', art: 'oiled-toy' },
      { name: 'Completed Toy', description: 'Handed over, and immediately taken somewhere muddy.', art: 'completed-toy' },
    ],
  },
];

function expandChain(seed: ChainSeed): ItemChain {
  const levels: ItemDefinition[] = seed.levels.map((level, index) => ({
    id: `${seed.id}-${index + 1}`,
    chainId: seed.id,
    level: index + 1,
    name: level.name,
    description: level.description,
    ariaLabel: `${level.name}, level ${index + 1} of ${seed.levels.length} in the ${seed.name} chain`,
    art: level.art,
    tone: seed.tone,
  }));

  return {
    id: seed.id,
    roomId: seed.roomId,
    name: seed.name,
    role: seed.role,
    description: seed.description,
    tone: seed.tone,
    levels,
  };
}

export const ITEM_CHAINS: ItemChain[] = chainSeeds.map(expandChain);

export const CHAINS_BY_ID: Record<ChainId, ItemChain> = ITEM_CHAINS.reduce(
  (acc, chain) => {
    acc[chain.id] = chain;
    return acc;
  },
  {} as Record<ChainId, ItemChain>,
);

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = ITEM_CHAINS.reduce(
  (acc, chain) => {
    for (const definition of chain.levels) {
      acc[definition.id] = definition;
    }
    return acc;
  },
  {} as Record<string, ItemDefinition>,
);

export const WATCH_CHAIN_IDS: ChainId[] = ['watch-movement', 'watch-exterior', 'watch-design'];

export function getChain(chainId: ChainId): ItemChain {
  const chain = CHAINS_BY_ID[chainId];
  if (!chain) throw new Error(`Unknown chain: ${chainId}`);
  return chain;
}

export function getDefinition(definitionId: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[definitionId];
  if (!definition) throw new Error(`Unknown item definition: ${definitionId}`);
  return definition;
}

export function tryGetDefinition(definitionId: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS[definitionId];
}

/** Definition id for the next level up, or undefined at the top of a chain. */
export function getNextDefinitionId(chainId: ChainId, level: number): string | undefined {
  const chain = getChain(chainId);
  if (level >= chain.levels.length) return undefined;
  return chain.levels[level].id;
}

export function getChainMaxLevel(chainId: ChainId): number {
  return getChain(chainId).levels.length;
}

export function getDefinitionsForRoom(roomId: RoomId): ItemDefinition[] {
  return ITEM_CHAINS.filter((chain) => chain.roomId === roomId).flatMap((chain) => chain.levels);
}
