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
