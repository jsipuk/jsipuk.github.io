// Durable progress and its pure transitions. Nothing here renders or saves;
// each transition returns the next Progress (or a refusal) so the caller can
// commit it in one storage transaction before any effect plays.

import type { BeatId, CreatureId, Line, LostSiteId, NextJobId, PersonId, QuickId, SymbolId } from './content.ts';
import {
  BEATS,
  BRANCH_SYMBOL,
  CREWS,
  LINES,
  LOST_SITES,
  NEXT_JOBS,
  PEOPLE,
  Q01,
  QUICK_JOBS,
  TICKET_CRAB,
  TRUST_MAX,
  TRUST_MIN,
} from './content.ts';

export type Stage = 'offered' | 'carrying' | 'delivered';
export type Pose = 'raised_claws' | 'claws_lowered';
export type Flag =
  | 'counteroffer_heard'
  | 'machine_noticed'
  | 'yard_shutter_open'
  | 'ferry_running'
  | 'market_lit'
  | 'footprints_seen'
  | 'maintenance_route'
  | 'warning_lamp_lit'
  | 'shift_1_complete';

export interface ShiftState {
  /** The next story call, waiting until the courier takes it. */
  lead: BeatId | null;
  active: { beat: BeatId; step: number } | null;
  done: BeatId[];
  /** The symbol stamped on this save's half of the warning label. */
  branchSymbol: SymbolId | null;
  closeChoice: PersonId | null;
  complete: boolean;
}

export interface QuickState {
  active: { job: QuickId; step: number; site: LostSiteId | null; instance: string } | null;
  /** Best Last post times in simulation seconds; quiet and pursuit runs never compete. */
  bests: { quiet: number | null; pursuit: number | null };
  lostFound: LostSiteId[];
  runs: number;
}

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
  shift: ShiftState;
  quick: QuickState;
  /** Journal entry keys, in the order they were written. */
  journal: string[];
  sightings: string[];
}

export type GameEvent =
  | { type: 'accepted' }
  | { type: 'counteroffer'; line: Line }
  | { type: 'noticed' }
  | { type: 'encounter_turn'; pose: Pose; text: string; turn: number }
  | { type: 'recruited'; creature: CreatureId }
  | { type: 'shutter_opened' }
  | { type: 'delivered'; recipient: PersonId }
  | { type: 'call_taken'; beat: BeatId }
  | { type: 'step_done'; beat: BeatId; step: string; caption?: string; line?: Line }
  | { type: 'beat_done'; beat: BeatId }
  | { type: 'sighting'; creature: string }
  | { type: 'shift_complete'; first: PersonId }
  | { type: 'quick_started'; job: QuickId }
  | { type: 'quick_step'; job: QuickId; caption: string }
  | {
      type: 'quick_done';
      job: QuickId;
      time: number | null;
      category: 'quiet' | 'pursuit' | null;
      best: number | null;
      improved: boolean;
      site: LostSiteId | null;
      newSite: boolean;
    }
  | { type: 'quick_dropped'; job: QuickId };

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
    shift: { lead: null, active: null, done: [], branchSymbol: null, closeChoice: null, complete: false },
    quick: { active: null, bests: { quiet: null, pursuit: null }, lostFound: [], runs: 0 },
    journal: [],
    sightings: [],
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
  next.shift.lead = branch.nextJob;
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
  const sh = p.shift;
  const who = p.recipient ? PEOPLE[p.recipient].short : '';
  if (sh.complete) {
    const first = sh.closeChoice ? PEOPLE[sh.closeChoice].short : '';
    return {
      recall: `Shift one is done. The Reedlings ring the old alarm along the mud, and ${first} heard your recording first.`,
      next: 'Next: Shift two arrives in a later build · quick jobs are on the dispatch board',
    };
  }
  if (p.quick.active) {
    const q = QUICK_JOBS[p.quick.active.job];
    return { recall: `You’re on a quick job: ${q.name}.`, next: `${quickObjective(p) ?? q.summary} · the story call waits` };
  }
  if (sh.active) {
    const beat = BEATS[sh.active.beat];
    const step = beat.steps[Math.min(sh.active.step, beat.steps.length - 1)];
    return { recall: `You’re on ${beat.name}.`, next: `${step.objective} · about ${beat.minutes} min` };
  }
  if (sh.lead) {
    const beat = BEATS[sh.lead];
    const recall =
      p.recipient === 'mo_vale' && sh.done.length === 0
        ? 'You gave Mo the battery. The ferry’s running. He heard a disconnected phone ring on the slipway.'
        : p.recipient === 'nell_price' && sh.done.length === 0
          ? 'You gave Nell the battery. The market’s lit. She heard a bell under the floor where no phone should be.'
          : `You finished ${BEATS[sh.done[sh.done.length - 1]].name}. ${who ? `${who} is waiting on the radio.` : ''}`.trim();
    return { recall, next: `Next call: ${beat.name} · about ${beat.minutes} min` };
  }
  if (p.story.stage === 'delivered') {
    const n = NEXT_JOBS[p.story.nextJob!];
    return { recall: `You gave ${who} the battery.`, next: `Next: ${n.lead} · about ${n.minutes} min` };
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

// ------------------------------------------------------------- shift beats

const addUnique = <T>(list: T[], items: readonly T[] | undefined) => {
  for (const i of items ?? []) if (!list.includes(i)) list.push(i);
};

/** Take the waiting story call. Only one job runs at a time. */
export function takeCall(p: Progress): Result {
  if (!p.shift.lead) return refuse('No call waiting.');
  if (p.shift.active) return refuse('Already on a call.');
  if (p.quick.active) return refuse('Finish or drop your quick job first.');
  const next = clone(p);
  const beat = next.shift.lead!;
  next.shift.active = { beat, step: 0 };
  next.shift.lead = null;
  return { ok: true, progress: next, events: [{ type: 'call_taken', beat }] };
}

/** The two symbols the yard cabinet wants: this save's branch symbol and Q03's three rings. */
export function cabinetAnswer(p: Progress): SymbolId[] {
  return [p.shift.branchSymbol ?? 'waves', 'three_rings'];
}

/** Finish the active beat's current step. The cabinet needs the right two symbols. */
export function completeStep(p: Progress, answer: SymbolId[] = []): Result {
  const a = p.shift.active;
  if (!a) return refuse('No story job active.');
  const beat = BEATS[a.beat];
  const step = beat.steps[a.step];
  if (!step) return refuse('Waiting for your choice.');
  if (step.requiresCargo && !p.cargo.includes(step.requiresCargo)) return refuse(`You need the ${step.requiresCargo}.`);
  if (step.kind === 'puzzle') {
    const want = cabinetAnswer(p);
    const ok = answer.length === 2 && want.every((w) => answer.includes(w));
    if (!ok) return refuse('The relay buzzes. Not those two.');
  }
  if (step.kind === 'reveal' && !p.team.includes('wickwing')) return refuse('Wickwing is not with you.');
  const next = clone(p);
  if (step.cargoAdd && !next.cargo.includes(step.cargoAdd)) next.cargo.push(step.cargoAdd);
  if (step.cargoRemove) next.cargo = next.cargo.filter((c) => c !== step.cargoRemove);
  addUnique(next.journal, step.journal);
  if (step.flag) addUnique(next.flags, [step.flag as Flag]);
  const events: GameEvent[] = [{ type: 'step_done', beat: a.beat, step: step.id, caption: step.caption, line: step.line }];
  if (step.kind === 'watch') addUnique(next.sightings, ['reedling']);
  if (step.kind === 'watch') events.push({ type: 'sighting', creature: 'reedling' });
  next.shift.active!.step += 1;
  if (next.shift.active!.step >= beat.steps.length && a.beat !== 'SHIFT_01_CLOSE') {
    next.shift.active = null;
    next.shift.done.push(a.beat);
    addUnique(next.flags, beat.done.flags as Flag[] | undefined);
    if (a.beat === 'Q02F' || a.beat === 'Q02M') next.shift.branchSymbol = BRANCH_SYMBOL[a.beat];
    next.shift.lead = beat.done.next === 'SHIFT_02' ? null : beat.done.next;
    events.push({ type: 'beat_done', beat: a.beat });
  }
  return { ok: true, progress: next, events };
}

/** Shift close: choose which crew hears the recording first. */
export function chooseCloseCrew(p: Progress, first: PersonId): Result {
  const a = p.shift.active;
  if (!a || a.beat !== 'SHIFT_01_CLOSE' || a.step < BEATS.SHIFT_01_CLOSE.steps.length) return refuse('Nothing recorded yet.');
  const next = clone(p);
  next.shift.closeChoice = first;
  next.shift.active = null;
  next.shift.done.push('SHIFT_01_CLOSE');
  next.shift.complete = true;
  addUnique(next.journal, [first === 'mo_vale' ? 'close_mo' : 'close_nell']);
  addUnique(next.flags, ['shift_1_complete']);
  return {
    ok: true,
    progress: next,
    events: [
      { type: 'beat_done', beat: 'SHIFT_01_CLOSE' },
      { type: 'shift_complete', first },
    ],
  };
}

// --------------------------------------------------------------- quick jobs

/** Which lost-property site a new run marks: the first not yet found, then round again. */
export function nextLostSite(p: Progress): LostSiteId {
  const unfound = LOST_SITES.find((s) => !p.quick.lostFound.includes(s.id));
  return unfound ? unfound.id : LOST_SITES[p.quick.runs % LOST_SITES.length].id;
}

export function startQuick(p: Progress, job: QuickId, instance: string): Result {
  if (p.story.stage !== 'delivered') return refuse('Quick jobs open after the battery run.');
  if (p.quick.active) return refuse('Already on a quick job.');
  if (p.shift.active) return refuse('Finish the story call first.');
  const next = clone(p);
  next.quick.active = { job, step: 0, site: job === 'lost_property' ? nextLostSite(p) : null, instance };
  return { ok: true, progress: next, events: [{ type: 'quick_started', job }] };
}

const QUICK_CARGO: Record<QuickId, string> = { last_post: 'mail', lost_property: 'lost_item' };

/** Where the current quick-job step happens and what the button says. */
export function quickStep(p: Progress): { at: { x: number; y: number }; verb: string; objective: string } | null {
  const q = p.quick.active;
  if (!q) return null;
  if (q.job === 'last_post') {
    return q.step === 0
      ? { at: { x: 100, y: 592 }, verb: 'Collect the mail', objective: 'Last post: collect the sorted mail at the depot' }
      : { at: { x: 258, y: 40 }, verb: 'Post the mail', objective: 'Last post: the quay post box · the clock’s running' };
  }
  const site = LOST_SITES.find((s) => s.id === q.site)!;
  return q.step === 0
    ? { at: site.at, verb: `Pick up the ${site.item}`, objective: `Lost property: a ${site.item} ${site.where}` }
    : { at: { x: 100, y: 592 }, verb: 'Hand it in', objective: `Lost property: hand the ${site.item} in at the depot` };
}

export const quickObjective = (p: Progress): string | null => quickStep(p)?.objective ?? null;

/** Advance a quick job. `time` is simulation seconds since the mail was collected. */
export function advanceQuick(p: Progress, time = 0, pursuit = false): Result {
  const q = p.quick.active;
  if (!q) return refuse('No quick job.');
  const next = clone(p);
  const cargo = QUICK_CARGO[q.job];
  if (q.step === 0) {
    next.cargo.push(cargo);
    next.quick.active!.step = 1;
    const caption = q.job === 'last_post' ? 'Mail sack in the van. The clock’s running: quay post box.' : 'Got it. Hand it in at the depot.';
    return { ok: true, progress: next, events: [{ type: 'quick_step', job: q.job, caption }] };
  }
  next.cargo = next.cargo.filter((c) => c !== cargo);
  next.quick.active = null;
  next.quick.runs += 1;
  if (q.job === 'last_post') {
    const category = pursuit ? 'pursuit' : 'quiet';
    const old = next.quick.bests[category];
    const improved = old === null || time < old;
    if (improved) next.quick.bests[category] = Number(time.toFixed(2));
    return {
      ok: true,
      progress: next,
      events: [{ type: 'quick_done', job: q.job, time, category, best: next.quick.bests[category], improved, site: null, newSite: false }],
    };
  }
  const newSite = !next.quick.lostFound.includes(q.site!);
  if (newSite) next.quick.lostFound.push(q.site!);
  return {
    ok: true,
    progress: next,
    events: [{ type: 'quick_done', job: q.job, time: null, category: null, best: null, improved: false, site: q.site, newSite }],
  };
}

export function dropQuick(p: Progress): Result {
  const q = p.quick.active;
  if (!q) return refuse('No quick job.');
  const next = clone(p);
  next.cargo = next.cargo.filter((c) => c !== QUICK_CARGO[q.job]);
  next.quick.active = null;
  return { ok: true, progress: next, events: [{ type: 'quick_dropped', job: q.job }] };
}

// ---------------------------------------------------------------- migration

/** Bring a schema 1 (M1) progress up to schema 2. Earned state is kept as it was. */
export function migrateProgressV1(old: Progress): Progress {
  const p = structuredClone(old) as Progress;
  const lead = old.story?.stage === 'delivered' ? (old.story.nextJob as BeatId | null) : null;
  p.shift ??= { lead, active: null, done: [], branchSymbol: null, closeChoice: null, complete: false };
  p.quick ??= { active: null, bests: { quiet: null, pursuit: null }, lostFound: [], runs: 0 };
  p.journal ??= [];
  p.sightings ??= [];
  return p;
}
