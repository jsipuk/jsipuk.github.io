// Authored content for Riverside Q01, as plain data. IDs and branch meanings
// match fixtures/riverside-first-job.json; tests/content.test.ts checks that.

export type CrewId = 'ferry' | 'market';
export type PersonId = 'mo_vale' | 'nell_price';
export type CreatureId = 'wickwing' | 'clatterjack';
export type NextJobId = 'Q02F' | 'Q02M';

export interface Line {
  speaker: string;
  role: string;
  text: string;
}

export const TRUST_MIN = -2;
export const TRUST_MAX = 3;

export const CREWS: Record<CrewId, { name: string; person: PersonId }> = {
  ferry: { name: 'Ferry Crew', person: 'mo_vale' },
  market: { name: 'Night Market', person: 'nell_price' },
};

export const PEOPLE: Record<PersonId, { name: string; short: string; crew: CrewId; place: string }> = {
  mo_vale: { name: 'Mo Vale', short: 'Mo', crew: 'ferry', place: 'the ferry quay' },
  nell_price: { name: 'Nell Price', short: 'Nell', crew: 'market', place: 'the night market' },
};

export const Q01 = {
  id: 'Q01',
  name: 'One good battery',
  exclusiveOutcomeGroup: 'Q01_battery_handover',
  item: 'spare_battery',
  branches: {
    mo_vale: { location: 'quay', trustDelta: { ferry: 1, market: -1 }, addsFlag: 'ferry_running', nextJob: 'Q02F' },
    nell_price: { location: 'market', trustDelta: { ferry: -1, market: 1 }, addsFlag: 'market_lit', nextJob: 'Q02M' },
  },
} as const;

export const NEXT_JOBS: Record<NextJobId, { name: string; lead: string; minutes: number }> = {
  Q02F: { name: 'Low water', lead: 'Inspect the slipway', minutes: 5 },
  Q02M: { name: 'Under the stalls', lead: 'Trace the bell under Nell’s stall', minutes: 5 },
};

export const LINES = {
  moAccept: {
    speaker: 'Mo Vale',
    role: 'Ferry Crew, on the payphone',
    text: 'Starter’s dead. Last ferry’s full. Tell me you’ve still got that battery.',
  },
  nellCounter: {
    speaker: 'Nell Price',
    role: 'Night Market, on the radio',
    text: 'If that’s the spare, have a look up the high street. Every stall’s dark.',
  },
  moNext: {
    speaker: 'Mo Vale',
    role: 'Ferry Crew, on the radio',
    text: 'That phone on the slipway’s ringing again. They pulled its cable out in ’98.',
  },
  nellNext: {
    speaker: 'Nell Price',
    role: 'Night Market, on the radio',
    text: 'Hear that under the floor? There hasn’t been a phone down there in years.',
  },
  moWaiting: { speaker: 'Mo Vale', role: 'Ferry Crew', text: 'Phone’s ringing at your depot. That’ll be me.' },
  nellWaiting: { speaker: 'Nell Price', role: 'Night Market', text: 'Dark as a cellar up here. Busy night for you?' },
  moThanked: { speaker: 'Mo Vale', role: 'Ferry Crew', text: 'Listen to her go. I owe you one.' },
  nellThanked: { speaker: 'Nell Price', role: 'Night Market', text: 'Look at it. Like the old days. I won’t forget this.' },
  moCold: { speaker: 'Mo Vale', role: 'Ferry Crew', text: 'Market’s bright tonight. Ferry’s still stuck, mind.' },
  nellCold: { speaker: 'Nell Price', role: 'Night Market', text: 'Mo’s boat’s running, then. Good for Mo.' },
} satisfies Record<string, Line>;

/** What the street does when each recipient gets the battery, before their next call. */
export const RESULT_TEXT: Record<PersonId, string> = {
  mo_vale: 'The ferry’s starter catches. Passengers file aboard and the deck lights come on. The market stays dark tonight.',
  nell_price: 'The stalls light up one at a time down the high street. The ferry stays moored tonight.',
};

export const NOTICE_MACHINE =
  'Coins are crawling uphill into the ticket machine’s return slot. A bottle cap scuttles out of sight.';

export const CREATURES: Record<CreatureId, { name: string; kind: string; habitat: string; field: string; guide: string }> = {
  wickwing: {
    name: 'Wickwing',
    kind: 'lantern moth',
    habitat: 'Rides on the van’s wing mirror',
    field: 'Dim: lowers its glow so wary creatures settle',
    guide: 'Found you on your first night and never left. Its glow brightens near anything that rings.',
  },
  clatterjack: {
    name: 'Clatterjack',
    kind: 'bottle-cap crab',
    habitat: 'The old ticket machine’s coin return',
    field: 'Lift: raises a jammed shutter',
    guide: 'Wears a bottle cap for a shell and hoards washers. Its claws can lift far more than it looks.',
  },
};

/** The wild Clatterjack at the ticket office: raised claws mean "give it space". */
export const TICKET_CRAB = {
  id: 'ticket_crab',
  creature: 'clatterjack' as CreatureId,
  cues: {
    raised_claws: 'Raised claws. It wants space.',
    claws_lowered: 'Claws lowered. It’s watching your hands.',
  },
  reactions: {
    dim: 'Wickwing dims its glow. The crab’s claws sink and unclench.',
    dimAgain: 'Wickwing stays dim. The crab is already calm.',
    offerEarly: 'The washer pings off its shell and rolls back to you. Too soon.',
    recruit: 'It takes the washer, taps it twice and climbs into your pocket. Clatterjack joins you.',
  },
};

export const ITEMS = { washer: 'A spare washer from the van’s toolbox' };

// ------------------------------------------------------------------ shift one
// The rest of shift one, "The third ring". Beat IDs and order follow the
// fixture's shiftOneNext. Each beat is a list of steps at authored places;
// small named handlers in session.ts do the special parts.

export type BeatId = 'Q02F' | 'Q02M' | 'Q03' | 'Q04' | 'SHIFT_01_CLOSE';
export type SymbolId = 'waves' | 'bell' | 'three_rings' | 'anchor' | 'key' | 'crown';

export const SYMBOLS: Record<SymbolId, { glyph: string; name: string }> = {
  waves: { glyph: '≈', name: 'Waves' },
  bell: { glyph: 'Ω', name: 'Bell' },
  three_rings: { glyph: '◎', name: 'Three rings' },
  anchor: { glyph: '⚓', name: 'Anchor' },
  key: { glyph: '⚿', name: 'Key' },
  crown: { glyph: '♛', name: 'Crown' },
};

export type StepKind = 'talk' | 'act' | 'reveal' | 'pickup' | 'puzzle' | 'watch';

export interface Step {
  id: string;
  objective: string;
  /** Authored place in px. */
  at: { x: number; y: number };
  reach: number;
  verb: string;
  kind: StepKind;
  line?: Line;
  caption?: string;
  journal?: string[];
  cargoAdd?: string;
  cargoRemove?: string;
  requiresCargo?: string;
  flag?: string;
  /** Caption when the courier first comes within 120 px: a sound or sight that draws them in. */
  near?: string;
}

export interface Beat {
  id: BeatId;
  name: string;
  minutes: number;
  /** Who calls it in. */
  caller: Line;
  steps: Step[];
  done: { title: string; text: string; flags?: string[]; next: BeatId | 'SHIFT_02' };
}

export const PLACES = {
  slipway: { x: 112, y: 30 },
  oldPost: { x: 476, y: 38 },
  nellHatch: { x: 984, y: 44 },
  counter: { x: 378, y: 553 },
  switchboard: { x: 100, y: 592 },
  cabinet: { x: 432, y: 326 },
  viewpoint: { x: 640, y: 44 },
  postBox: { x: 258, y: 40 },
} as const;

/** Footprints from the slipway along the quay to the old warning post. */
export const FOOTPRINTS = Array.from({ length: 9 }, (_, i) => ({
  x: PLACES.slipway.x + 30 + i * ((PLACES.oldPost.x - PLACES.slipway.x - 40) / 8),
  y: 36 + (i % 2 ? 4 : -2),
}));

export const JOURNAL: Record<string, string> = {
  rubbing_left: 'Rubbing from the quay post: “RIVERSIDE FLOOD WARN— · TEST LINE —”, stamped ≈ Waves.',
  rubbing_right: 'Rubbing from under the stalls: “—ING CIRCUIT · TEST LINE 3”, stamped Ω Bell.',
  address_ticket_office: 'Address on the plate: Old Ticket Office, Station Road.',
  label_matched: 'The matching half is under the ticket-office counter: RIVERSIDE FLOOD WARNING CIRCUIT · TEST LINE 3.',
  switchboard_line3: 'Wickwing’s glow shows the painted-over number: Depot switchboard, line 3, stamped ◎ Three rings.',
  maintenance_route: 'A maintenance route runs to the yard cabinet. Carry a relay there.',
  line_restored: 'The dead line rings again. A warning lamp by the river came on.',
  reedling_sighted: 'Pocket-sized creatures on the mud, ringing the old test alarm in turn. Reedlings.',
  close_mo: 'Mo heard the recording first: “That’s the old test alarm. The river’s learned it.”',
  close_nell: 'Nell heard the recording first: “Little voices, ringing like the market bell. They’re answering something.”',
};

const recipientLine = (text: string): Line => ({ speaker: 'Dispatch', role: 'Depot radio', text });

export const BEATS: Record<BeatId, Beat> = {
  Q02F: {
    id: 'Q02F',
    name: 'Low water',
    minutes: 5,
    caller: { speaker: 'Mo Vale', role: 'Ferry Crew, on the radio', text: 'Meet me at the slipway. Something came up out of the water.' },
    steps: [
      {
        id: 'meet_mo',
        objective: 'Meet Mo on the quay',
        at: { x: 208, y: 42 },
        reach: 28,
        verb: 'Talk to Mo',
        kind: 'talk',
        line: { speaker: 'Mo Vale', role: 'Ferry Crew', text: 'Wet footprints. Small ones. Up the slipway and along the quay. Follow them, will you?' },
        flag: 'footprints_seen',
      },
      {
        id: 'rubbing',
        objective: 'Follow the wet footprints along the quay',
        at: PLACES.oldPost,
        reach: 26,
        verb: 'Take a rubbing',
        kind: 'act',
        near: 'The footprints stop at an old council post, crusted with river mud.',
        caption: 'Under the grime, half a council plate and an address: Old Ticket Office, Station Road.',
        journal: ['rubbing_left', 'address_ticket_office'],
      },
    ],
    done: { title: 'Half a warning label', text: 'A rubbing of half a council plate and the old ticket-office address are in your journal.', next: 'Q03' },
  },
  Q02M: {
    id: 'Q02M',
    name: 'Under the stalls',
    minutes: 5,
    caller: { speaker: 'Nell Price', role: 'Night Market, on the radio', text: 'There’s a bell going under my stall. Come and find it before it drives me mad.' },
    steps: [
      {
        id: 'meet_nell',
        objective: 'Meet Nell at her stall',
        at: { x: 920, y: 43 },
        reach: 28,
        verb: 'Talk to Nell',
        kind: 'talk',
        line: { speaker: 'Nell Price', role: 'Night Market', text: 'Hear it? Under the boards. Further along than mine, I reckon.' },
      },
      {
        id: 'hatch',
        objective: 'Listen along the stalls for the bell',
        at: PLACES.nellHatch,
        reach: 24,
        verb: 'Open the floor hatch',
        kind: 'act',
        near: 'The ringing’s louder here, under the end stall.',
        caption: 'An old bell box under the boards, with half a council plate and a label: return to the Old Ticket Office.',
        journal: ['rubbing_right', 'address_ticket_office'],
      },
    ],
    done: { title: 'Half a warning label', text: 'A rubbing of half a council plate and the old ticket-office address are in your journal.', next: 'Q03' },
  },
  Q03: {
    id: 'Q03',
    name: 'Return to sender',
    minutes: 5,
    caller: recipientLine('That address on your plate is the old ticket office. Have a look inside.'),
    steps: [
      {
        id: 'counter',
        objective: 'Find the matching label at the ticket office',
        at: PLACES.counter,
        reach: 26,
        verb: 'Look under the counter',
        kind: 'act',
        caption: 'The other half of the plate is screwed under the counter. A number has been painted over.',
        journal: ['label_matched'],
      },
      {
        id: 'reveal',
        objective: 'Use Wickwing to read the painted-over number',
        at: PLACES.counter,
        reach: 26,
        verb: 'Dim · Wickwing',
        kind: 'reveal',
        caption: 'Wickwing angles its glow. Under the paint: DEPOT SWITCHBOARD · LINE 3.',
        journal: ['switchboard_line3'],
      },
    ],
    done: {
      title: 'Return to sender',
      text: 'A maintenance route and the depot switchboard are marked.',
      flags: ['maintenance_route'],
      next: 'Q04',
    },
  },
  Q04: {
    id: 'Q04',
    name: 'Crossed lines',
    minutes: 7,
    caller: recipientLine('Switchboard says line 3 has a dead relay. There’s a spare at the depot.'),
    steps: [
      {
        id: 'relay',
        objective: 'Collect a replacement relay from the depot switchboard',
        at: PLACES.switchboard,
        reach: 24,
        verb: 'Take the relay',
        kind: 'pickup',
        cargoAdd: 'relay',
        caption: 'A heavy relay in a canvas bag. The yard cabinet is through the shutter, or round by the ring road.',
        journal: ['maintenance_route'],
      },
      {
        id: 'cabinet',
        objective: 'Fit the relay in the cabinet in the builders’ yard',
        at: PLACES.cabinet,
        reach: 26,
        verb: 'Open the cabinet',
        kind: 'puzzle',
        requiresCargo: 'relay',
        cargoRemove: 'relay',
        caption: 'The dead line rings. Somewhere by the river, a warning lamp comes on.',
        journal: ['line_restored'],
        flag: 'warning_lamp_lit',
      },
    ],
    done: { title: 'Crossed lines', text: 'The dead line rings. A warning lamp by the river is lit.', next: 'SHIFT_01_CLOSE' },
  },
  SHIFT_01_CLOSE: {
    id: 'SHIFT_01_CLOSE',
    name: 'Three rings',
    minutes: 3,
    caller: recipientLine('That lamp by the river hasn’t lit in thirty years. Go and see what it’s showing you.'),
    steps: [
      {
        id: 'watch',
        objective: 'Follow the warning lamp to the river',
        at: PLACES.viewpoint,
        reach: 30,
        verb: 'Watch the mud',
        kind: 'watch',
        journal: ['reedling_sighted'],
      },
    ],
    done: { title: 'Shift one complete', text: 'You logged the sighting. Shift two arrives in a later build.', next: 'SHIFT_02' },
  },
};

/** The symbol each branch's rubbing carries; the cabinet wants it plus Q03's three rings. */
export const BRANCH_SYMBOL: Record<'Q02F' | 'Q02M', SymbolId> = { Q02F: 'waves', Q02M: 'bell' };

export const CLOSE_REPLY: Record<PersonId, Line> = {
  mo_vale: { speaker: 'Mo Vale', role: 'Ferry Crew, on the radio', text: 'Play it again. … That’s the old test alarm. The river’s learned it.' },
  nell_price: { speaker: 'Nell Price', role: 'Night Market, on the radio', text: 'Little voices, ringing like the market bell. They’re answering something.' },
};

// ----------------------------------------------------------------- quick jobs

export type QuickId = 'last_post' | 'lost_property';

export const LOST_SITES = [
  { id: 'glove', item: 'glove', where: 'on a market bench', at: { x: 868, y: 56 } },
  { id: 'umbrella', item: 'umbrella', where: 'by the ring road', at: { x: 1034, y: 400 } },
  { id: 'scarf', item: 'scarf', where: 'on Back Lane', at: { x: 400, y: 758 } },
] as const;
export type LostSiteId = (typeof LOST_SITES)[number]['id'];

export const QUICK_JOBS: Record<QuickId, { name: string; minutes: number; summary: string }> = {
  last_post: { name: 'Last post', minutes: 3, summary: 'Sorted mail from the depot to the quay post box, against your best time.' },
  lost_property: { name: 'Lost property', minutes: 4, summary: 'One marked find, handed in at the depot.' },
};
