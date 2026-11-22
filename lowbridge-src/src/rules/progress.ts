// Durable progress and its pure transitions. Nothing here renders or saves;
// each transition returns the next Progress (or a refusal) so the caller can
// commit it in one storage transaction before any effect plays.

import type { CreatureId, Line, NextJobId, PersonId } from './content.ts';
import { CREWS, LINES, PEOPLE, Q01, TICKET_CRAB, TRUST_MAX, TRUST_MIN } from './content.ts';

export type Stage = 'offered' | 'carrying' | 'delivered';
export type Pose = 'raised_claws' | 'claws_lowered';
export type Flag =
  | 'counteroffer_heard'
  | 'machine_noticed'
  | 'yard_shutter_open'
  | 'ferry_running'
  | 'market_lit';

export interface Receipt {
  group: string;
  outcome: PersonId;
  instance: string;
}

export interface Progress {
  story: { job: 'Q01'; stage: Stage; instance: string; nextJob: NextJobId | null };
  cargo: string[];
  items: string[];
  crews: { ferry: number; market: number };
  flags: Flag[];
  recipient: PersonId | null;
  roster: CreatureId[];
  team: CreatureId[];
  guide: Partial<Record<CreatureId, string[]>>;
  encounter: { id: 'ticket_crab'; turn: number; pose: Pose } | null;
  completed: Receipt[];
}

export type GameEvent =
  | { type: 'accepted' }
  | { type: 'counteroffer'; line: Line }
  | { type: 'noticed' }
  | { type: 'encounter_turn'; pose: Pose; text: string; turn: number }
  | { type: 'recruited'; creature: CreatureId }
  | { type: 'shutter_opened' }
  | { type: 'delivered'; recipient: PersonId };

export type Result = { ok: true; progress: Progress; events: GameEvent[] } | { ok: false; reason: string };

const clone = (p: Progress): Progress => structuredClone(p);
const refuse = (reason: string): Result => ({ ok: false, reason });
const has = (p: Progress, f: Flag) => p.flags.includes(f);
const clampTrust = (v: number) => Math.max(TRUST_MIN, Math.min(TRUST_MAX, v));

/** A fresh save: Q01 offered, Wickwing in the team, trust at zero (fixture "initial"). */
export function initialProgress(instance = 'q01-1'): Progress {
  return {
    story: { job: 'Q01', stage: 'offered', instance, nextJob: null },
    cargo: [],
    items: ['washer'],
    crews: { ferry: 0, market: 0 },
    flags: [],
    recipient: null,
    roster: ['wickwing'],
    team: ['wickwing'],
    guide: { wickwing: ['recruited'] },
    encounter: null,
    completed: [],
  };
}

export const hasFlag = has;
export const carryingBattery = (p: Progress) => p.story.stage === 'carrying' && p.cargo.includes(Q01.item);

/** Answer the depot payphone: the battery enters custody and the quay is marked. */
export function acceptQ01(p: Progress): Result {
  if (p.story.stage !== 'offered') return refuse('Already on this job.');
  const next = clone(p);
  next.story.stage = 'carrying';
  if (!next.cargo.includes(Q01.item)) next.cargo.push(Q01.item);
  return { ok: true, progress: next, events: [{ type: 'accepted' }] };
}

/** Nell's radio call the first time the courier leaves the depot with the battery. */
export function hearCounteroffer(p: Progress): Result {
  if (!carryingBattery(p) || has(p, 'counteroffer_heard')) return refuse('Nothing to hear.');
  const next = clone(p);
  next.flags.push('counteroffer_heard');
  return { ok: true, progress: next, events: [{ type: 'counteroffer', line: LINES.nellCounter }] };
}

export function noticeMachine(p: Progress): Result {
  if (has(p, 'machine_noticed') || p.roster.includes('clatterjack')) return refuse('Already noticed.');
  const next = clone(p);
  next.flags.push('machine_noticed');
  return { ok: true, progress: next, events: [{ type: 'noticed' }] };
}

/** Start or resume the ticket-machine encounter at its last settled turn. */
export function startEncounter(p: Progress): Result {
  if (p.roster.includes('clatterjack')) return refuse('The coin slot is quiet now.');
  const next = clone(p);
  next.encounter ??= { id: 'ticket_crab', turn: 0, pose: 'raised_claws' };
  if (!next.flags.includes('machine_noticed')) next.flags.push('machine_noticed');
  const e = next.encounter;
  return {
    ok: true,
    progress: next,
    events: [{ type: 'encounter_turn', pose: e.pose, text: TICKET_CRAB.cues[e.pose], turn: e.turn }],
  };
}

export type EncounterAction = 'dim' | 'offer_washer';

/** One turn of the encounter. A wrong offer costs the turn but never the washer. */
export function encounterAct(p: Progress, action: EncounterAction): Result {
  if (!p.encounter) return refuse('No encounter.');
  const next = clone(p);
  const e = next.encounter!;
  if (action === 'dim') {
    if (!next.team.includes('wickwing')) return refuse('Wickwing is not with you.');
    const text = e.pose === 'raised_claws' ? TICKET_CRAB.reactions.dim : TICKET_CRAB.reactions.dimAgain;
    e.pose = 'claws_lowered';
    e.turn += 1;
    return { ok: true, progress: next, events: [{ type: 'encounter_turn', pose: e.pose, text, turn: e.turn }] };
  }
  if (!next.items.includes('washer')) return refuse('No washer to offer.');
  if (e.pose === 'raised_claws') {
    e.turn += 1;
    return {
      ok: true,
      progress: next,
      events: [{ type: 'encounter_turn', pose: e.pose, text: TICKET_CRAB.reactions.offerEarly, turn: e.turn }],
    };
  }
  // Recruit exactly once. A full team sends the newcomer to the depot roster.
  next.encounter = null;
  if (!next.roster.includes('clatterjack')) next.roster.push('clatterjack');
  if (!next.team.includes('clatterjack') && next.team.length < 2) next.team.push('clatterjack');
  next.guide.clatterjack = Array.from(new Set([...(next.guide.clatterjack ?? []), 'recruited']));
  return { ok: true, progress: next, events: [{ type: 'recruited', creature: 'clatterjack' }] };
}

/** Clatterjack lifts the yard shutter. It stays open in every later session. */
export function liftShutter(p: Progress): Result {
  if (has(p, 'yard_shutter_open')) return refuse('Already open.');
  if (!p.team.includes('clatterjack')) return refuse('Something with strong claws could lift it.');
  const next = clone(p);
  next.flags.push('yard_shutter_open');
  next.guide.clatterjack = Array.from(new Set([...(next.guide.clatterjack ?? []), 'field_use']));
  return { ok: true, progress: next, events: [{ type: 'shutter_opened' }] };
}

/**
 * The handover. One battery, one outcome: requires Q01 carrying the battery and
 * no receipt for its exclusive group. Cargo, recipient, both trust changes, the
 * street flag, the next job and the receipt change together.
 */
export function deliverBattery(p: Progress, recipient: PersonId): Result {
  if (p.completed.some((r) => r.group === Q01.exclusiveOutcomeGroup)) return refuse('The battery has already gone.');
  if (!carryingBattery(p)) return refuse('You are not carrying the battery.');
  const branch = Q01.branches[recipient];
  const next = clone(p);
  next.cargo = next.cargo.filter((c) => c !== Q01.item);
  next.recipient = recipient;
  next.crews.ferry = clampTrust(next.crews.ferry + branch.trustDelta.ferry);
  next.crews.market = clampTrust(next.crews.market + branch.trustDelta.market);
  next.flags.push(branch.addsFlag);
  next.story.stage = 'delivered';
  next.story.nextJob = branch.nextJob;
  next.completed.push({ group: Q01.exclusiveOutcomeGroup, outcome: recipient, instance: p.story.instance });
  return { ok: true, progress: next, events: [{ type: 'delivered', recipient }] };
}

/** The confirmation names the other crew's consequence. */
export function handoverConsequence(recipient: PersonId): string {
  const me = PEOPLE[recipient];
  const other = recipient === 'mo_vale' ? PEOPLE.nell_price : PEOPLE.mo_vale;
  const otherCrew = CREWS[other.crew].name;
  const what = recipient === 'mo_vale' ? 'The ferry runs tonight.' : 'The market lights up tonight.';
  return `${what} ${CREWS[me.crew].name} +1. ${otherCrew} −1: ${other.short} goes without.`;
}

/** One line recalling the last decision, from saved flags, for the return screen. */
export function returnSummary(p: Progress): { recall: string; next: string } {
  if (p.story.stage === 'delivered' && p.recipient === 'mo_vale') {
    return {
      recall: 'You gave Mo the battery. The ferry’s running. He heard a disconnected phone ring on the slipway.',
      next: 'Next: Inspect the slipway · about 5 min (arrives in the next build)',
    };
  }
  if (p.story.stage === 'delivered' && p.recipient === 'nell_price') {
    return {
      recall: 'You gave Nell the battery. The market’s lit. She heard a bell under the floor where no phone should be.',
      next: 'Next: Trace the bell under Nell’s stall · about 5 min (arrives in the next build)',
    };
  }
  if (p.story.stage === 'carrying') {
    const both = has(p, 'counteroffer_heard');
    return {
      recall: both
        ? 'You’re carrying the depot’s spare battery. Mo wants it for the ferry; Nell wants it for the market.'
        : 'You’re carrying the depot’s spare battery for Mo at the ferry quay.',
      next: both ? 'Deliver the battery · about 3 min' : 'Take the battery to Mo · about 3 min',
    };
  }
  return { recall: 'The depot payphone is ringing.', next: 'Answer it · about 4 min to a delivery' };
}
