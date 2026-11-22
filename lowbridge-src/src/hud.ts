// HTML overlay: the one-line job with its arrow, the labelled action button,
// captions, prompts with choices, the encounter, the patrol chip, the save
// warning and the pause/return sheet with the journal.

import { drawCourier, drawCrabPortrait, drawVan } from './art.ts';
import { BEATS, CREATURES, CREWS, JOURNAL, LOST_SITES, PEOPLE, SHOPS, UNLOCKS } from './rules/content.ts';
import type { Vec } from './rules/math.ts';
import type { Progress, StylePart } from './rules/progress.ts';
import { STYLE_CATALOGUE, isUnlocked } from './rules/progress.ts';
import { CAUGHT_SECONDS, ESCAPE_SECONDS } from './rules/pursuit.ts';
import type { Session } from './rules/session.ts';
import { availableAction, formatTime, objective } from './rules/session.ts';
import type { Settings } from './settings.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface HudHandlers {
  onChoose(choiceId: string): void;
  onEncounter(action: 'dim' | 'offer_washer' | 'leave' | 'continue'): void;
  onRetrySave(): void;
  onShop(part: StylePart, id: string): void;
  onShopClose(): void;
}

const SHOP_PARTS: Record<'tailor' | 'paint', { part: StylePart; label: string }[]> = {
  tailor: [
    { part: 'jacket', label: 'Jackets' },
    { part: 'hat', label: 'Hats' },
  ],
  paint: [
    { part: 'vanBody', label: 'Body paint' },
    { part: 'vanStripe', label: 'Roof stripe' },
  ],
};

const SHOP_TEXT = {
  tailor: {
    eyebrow: 'Station Road',
    title: SHOPS.tailor.name,
    lede: 'Mrs Adeyemi’s secondhand rail. Try anything on; the depot pays. Locked pieces say how to earn them.',
  },
  paint: {
    eyebrow: 'Station Road forecourt',
    title: SHOPS.paint.name,
    lede: 'Gaz sprays the van while you wait. Free for depot vans, he says, “as long as it’s not beige again.”',
  },
};

/** How many style pieces are unlocked, for the journal. */
export function unlockCount(p: Progress): { have: number; all: number } {
  const items = Object.values(STYLE_CATALOGUE).flat();
  return { have: items.filter((i) => isUnlocked(p, i)).length, all: items.length };
}

export interface SheetInfo {
  eyebrow: string;
  title: string;
  lede: string;
  next: string;
  button: string;
}

export interface Hud {
  render(s: Session, focus: Vec, touch: boolean): void;
  toast(text: string, seconds?: number): void;
  showSheet(info: SheetInfo, progress: Progress): void;
  hideSheet(): void;
  sheetOpen(): boolean;
  syncSettings(settings: Settings): void;
  setSaveState(text: string, failed: boolean): void;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function journal(p: Progress): [string, string][] {
  const rows: [string, string][] = [];
  const stage = p.story.stage;
  rows.push([
    'Job',
    stage === 'offered'
      ? 'Q01 One good battery · the depot payphone is ringing'
      : stage === 'carrying'
        ? 'Q01 One good battery · carrying the spare battery'
        : `Q01 done · battery to ${PEOPLE[p.recipient!].name}`,
  ]);
  const sh = p.shift;
  if (sh.active) rows.push(['Story', `${BEATS[sh.active.beat].name} in progress`]);
  else if (sh.lead) rows.push(['Next call', `${BEATS[sh.lead].name} · about ${BEATS[sh.lead].minutes} min · on the dispatch board`]);
  else if (sh.complete) rows.push(['Shift one', 'Complete. Shift two arrives in a later build.']);
  if (sh.done.length) rows.push(['Done', sh.done.map((b) => BEATS[b].name).join(' · ')]);
  for (const crew of ['ferry', 'market'] as const) {
    rows.push([CREWS[crew].name, `${PEOPLE[CREWS[crew].person].name} · trust ${signed(p.crews[crew])}`]);
  }
  rows.push(['Team', p.team.map((c) => `${CREATURES[c].name} (${CREATURES[c].kind})`).join(' · ')]);
  for (const c of p.roster) {
    const info = CREATURES[c];
    const marks = p.guide[c] ?? [];
    rows.push([`Guide: ${info.name}`, `${info.guide} ${info.field}. Habitat: ${info.habitat}. Noted: ${marks.join(', ') || 'seen'}.`]);
  }
  if (p.sightings.includes('reedling')) rows.push(['Sighted', 'Reedling, reed-bed mimic. Seen ringing along the mud; not yet befriended.']);
  if (p.flags.includes('yard_shutter_open')) rows.push(['Route', 'The builders’ yard shutter is open for good.']);
  for (const key of p.journal) if (JOURNAL[key]) rows.push(['Notebook', JOURNAL[key]]);
  const st = p.stats;
  const town: string[] = [];
  if (st.pigeons) town.push(`${st.pigeons} pigeons scattered`);
  if (p.chatted.length) town.push(`${p.chatted.length} people met`);
  if (st.chips) town.push(`${st.chips} chips`);
  if (st.honks) town.push(`${st.honks} honks`);
  if (st.calls) town.push(`${st.calls} wrong numbers`);
  if (st.pedBumps) town.push(`${st.pedBumps} near misses`);
  const u = unlockCount(p);
  rows.push(['Around town', `${town.length ? `${town.join(' · ')}. ` : 'Chat to people, find the shops, mind the pigeons. '}Looks unlocked: ${u.have} of ${u.all}.`]);
  if (p.story.stage === 'delivered') {
    rows.push(['Last post', `Best quiet run ${formatTime(p.quick.bests.quiet)} · with a chase ${formatTime(p.quick.bests.pursuit)}`]);
    rows.push(['Lost property', `${p.quick.lostFound.length} of ${LOST_SITES.length} found`]);
  }
  return rows;
}

export function createHud(h: HudHandlers): Hud {
  const root = $('hud');
  const jobText = $('job-text');
  const jobArrow = $('job-arrow');
  const act = $('act-btn');
  const actVerb = $('act-verb');
  const actReason = $('act-reason');
  const caption = $('caption');
  const heat = $('heat');
  const savebar = $('savebar');
  const padLabel = $('pad-label');
  const promptEl = $('prompt');
  const promptTitle = $('prompt-title');
  const promptSpeakerRow = $('prompt-speaker-row');
  const promptSpeaker = $('prompt-speaker');
  const promptRole = $('prompt-role');
  const promptLine = $('prompt-line');
  const promptText = $('prompt-text');
  const promptChoices = $('prompt-choices');
  const enc = $('encounter');
  const encPortrait = $('enc-portrait');
  const encTurn = $('enc-turn');
  const encTitle = $('enc-title');
  const encCue = $('enc-cue');
  const encButtons = Array.from(enc.querySelectorAll<HTMLButtonElement>('button[data-act]'));
  const toastEl = $('toast');
  const sheet = $('sheet');
  const resumeBtn = $('resume-btn');
  const shopEl = $('shop');
  const shopParts = $('shop-parts');
  const shopPreview = $('shop-preview');
  const shopStatus = $('shop-status');
  $('shop-done').addEventListener('click', () => h.onShopClose());

  for (const b of encButtons) b.addEventListener('click', () => h.onEncounter(b.dataset.act as never));
  $('save-retry').addEventListener('click', () => h.onRetrySave());

  const last: Record<string, string> = {};
  const set = (key: string, value: string, apply: (v: string) => void) => {
    if (last[key] === value) return;
    last[key] = value;
    apply(value);
  };
  let toastTimer = 0;

  return {
    render(s, focus, touch) {
      set('mode', s.mode, (v) => (root.dataset.mode = v));
      set('loco', s.locomotion === 'foot' ? 'foot' : 'van', (v) => (root.dataset.loco = v));
      set('preset', s.preset, (v) => (root.dataset.preset = v));
      set('touch', touch ? '1' : '0', (v) => (root.dataset.touch = v));
      const padText = s.locomotion === 'foot' ? 'Walk' : s.preset === 'hybrid' ? 'Steer' : 'Drive';
      set('padLabel', padText, (v) => (padLabel.textContent = v));

      const job = objective(s);
      set('job', job.text, (v) => (jobText.textContent = v));
      if (job.target && Math.hypot(job.target.x - focus.x, job.target.y - focus.y) > 40) {
        const angle = Math.atan2(job.target.y - focus.y, job.target.x - focus.x);
        set('arrow', angle.toFixed(2), (v) => {
          jobArrow.classList.remove('off');
          jobArrow.style.transform = `rotate(${v}rad)`;
        });
      } else {
        set('arrow', 'off', () => jobArrow.classList.add('off'));
      }

      const a = availableAction(s);
      set('actShown', String(s.mode === 'world' && a.kind !== null), (v) => (act.hidden = v !== 'true'));
      set('actVerb', a.verb, (v) => (actVerb.textContent = v));
      set('actReason', a.enabled ? '' : (a.reason ?? ''), (v) => (actReason.textContent = v));
      set('actEnabled', String(a.enabled), (v) => {
        act.classList.toggle('disabled', v !== 'true');
        act.setAttribute('aria-disabled', v === 'true' ? 'false' : 'true');
      });
      set('actLabel', a.enabled ? a.verb : `${a.verb}: ${a.reason ?? 'not available'}`, (v) => act.setAttribute('aria-label', v));

      const cap = s.mode === 'world' && s.caption ? `${s.caption.speaker ? `${s.caption.speaker}: ` : ''}${s.caption.text}` : '';
      set('caption', cap, (v) => {
        caption.hidden = v === '';
        caption.textContent = v;
        caption.classList.toggle('radio', !!s.caption?.speaker);
      });

      const p = s.pursuit;
      const heatText = !p
        ? ''
        : p.delay > 0
          ? 'Patrol on its way'
          : p.boxed > 0.2
            ? `Boxed in · ${p.boxed.toFixed(1)} / ${CAUGHT_SECONDS} s · move!`
            : p.inSight
              ? 'Patrol · in sight'
              : p.searching
                ? `Patrol · out of sight ${p.outOfSight.toFixed(1)} / ${ESCAPE_SECONDS} s`
                : 'Patrol · heading to where you took the car';
      set('heat', heatText, (v) => {
        heat.hidden = v === '';
        heat.textContent = v;
        heat.classList.toggle('danger', !!p && (p.inSight || p.boxed > 0.2));
      });
      set('savebar', String(!!s.saveFailed), (v) => (savebar.hidden = v !== 'true'));

      // Prompts: one at a time, with their choices as buttons.
      const pr = s.mode === 'prompt' ? s.prompts[0] : null;
      const key = pr ? `${pr.kind}|${pr.title ?? ''}|${pr.text ?? ''}|${pr.line?.text ?? ''}|${pr.choices.map((c) => c.id).join()}` : '';
      set('prompt', key, () => {
        promptEl.hidden = !pr;
        if (!pr) return;
        promptEl.dataset.kind = pr.kind;
        promptTitle.textContent = pr.title ?? '';
        promptTitle.hidden = !pr.title;
        promptSpeakerRow.hidden = !pr.line;
        promptLine.hidden = !pr.line;
        if (pr.line) {
          promptSpeaker.textContent = pr.line.speaker;
          promptRole.textContent = pr.line.role;
          promptLine.textContent = `“${pr.line.text}”`;
        }
        promptText.textContent = pr.text ?? '';
        promptText.hidden = !pr.text;
        promptChoices.replaceChildren(
          ...pr.choices.map((c, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = c.label;
            b.dataset.choice = c.id;
            // The handover and dispatch choices carry equal weight; elsewhere the first is primary.
            if (pr.kind === 'result' || pr.kind === 'confirm' || i === 0) b.className = 'primary';
            b.addEventListener('click', () => h.onChoose(c.id));
            return b;
          }),
        );
        // Safe default focus: "Not yet" on a handover, the first choice otherwise.
        const focusIndex = pr.kind === 'confirm' ? pr.choices.length - 1 : 0;
        (promptChoices.children[focusIndex] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
      });

      // Encounter.
      const e = s.mode === 'encounter' ? s.encounter : null;
      const pose = s.progress.encounter?.pose ?? 'claws_lowered';
      const encKey = e ? `${pose}|${e.text}|${e.done}|${s.progress.encounter?.turn ?? 0}` : '';
      set('enc', encKey, () => {
        enc.hidden = !e;
        if (!e) return;
        encPortrait.replaceChildren(drawCrabPortrait(pose));
        encPortrait.dataset.pose = pose;
        encTurn.textContent = e.done ? 'Recruited' : `Turn ${(s.progress.encounter?.turn ?? 0) + 1}`;
        encTitle.textContent = e.done ? 'Clatterjack, bottle-cap crab' : 'A crab in the coin return';
        encCue.textContent = e.text;
        for (const b of encButtons) b.hidden = e.done ? b.dataset.act !== 'continue' : b.dataset.act === 'continue';
        encButtons.find((b) => !b.hidden)?.focus({ preventScroll: true });
      });

      // Shops: the tailor and Body & Paint.
      const shop = s.mode === 'shop' ? s.shop : null;
      const style = s.progress.style;
      const shopKey = shop
        ? `${shop}|${JSON.stringify(style)}|${SHOP_PARTS[shop].map(({ part }) => STYLE_CATALOGUE[part].map((i) => +isUnlocked(s.progress, i)).join('')).join()}`
        : '';
      set('shop', shopKey, () => {
        const wasOpen = !shopEl.hidden;
        shopEl.hidden = !shop;
        if (!shop) return;
        const text = SHOP_TEXT[shop];
        $('shop-eyebrow').textContent = text.eyebrow;
        $('shop-title').textContent = text.title;
        $('shop-lede').textContent = text.lede;
        const preview = shop === 'tailor' ? drawCourier(style.jacket, 1, style.hat) : drawVan(style.vanBody, style.vanStripe);
        preview.setAttribute('aria-hidden', 'true');
        shopPreview.replaceChildren(preview);
        const focusId = (document.activeElement as HTMLElement | null)?.dataset?.item;
        shopParts.replaceChildren(
          ...SHOP_PARTS[shop].map(({ part, label }) => {
            const fs = document.createElement('fieldset');
            fs.className = 'shop-part';
            const lg = document.createElement('legend');
            lg.textContent = label;
            const row = document.createElement('div');
            row.className = 'shop-items';
            for (const item of STYLE_CATALOGUE[part]) {
              const open = isUnlocked(s.progress, item);
              const b = document.createElement('button');
              b.type = 'button';
              b.className = open ? 'shop-item' : 'shop-item locked';
              b.dataset.item = `${part}:${item.id}`;
              b.setAttribute('aria-pressed', String(style[part] === item.id));
              const chip = document.createElement('span');
              chip.className = 'chip';
              chip.setAttribute('aria-hidden', 'true');
              chip.style.background = item.id === 'none' ? 'transparent' : item.fill;
              chip.style.borderColor = item.id === 'none' ? 'var(--line)' : item.trim;
              const words = document.createElement('span');
              words.textContent = item.name;
              if (!open && item.unlock) {
                const why = document.createElement('small');
                why.textContent = `Locked · ${UNLOCKS[item.unlock]}`;
                words.append(why);
                b.setAttribute('aria-disabled', 'true');
              }
              b.append(chip, words);
              b.addEventListener('click', () => {
                if (!open) {
                  shopStatus.textContent = item.unlock ? `${item.name}: ${UNLOCKS[item.unlock]}.` : '';
                  return;
                }
                h.onShop(part, item.id);
              });
              row.append(b);
            }
            fs.append(lg, row);
            return fs;
          }),
        );
        const u = unlockCount(s.progress);
        if (!wasOpen) shopStatus.textContent = `${u.have} of ${u.all} looks unlocked across both shops.`;
        const again = focusId ? shopParts.querySelector<HTMLButtonElement>(`[data-item="${focusId}"]`) : null;
        (again ?? (wasOpen ? null : $('shop-done')))?.focus({ preventScroll: true });
      });
    },

    toast(text, seconds = 4) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), seconds * 1000);
    },

    showSheet(info, progress) {
      $('sheet-eyebrow').textContent = info.eyebrow;
      $('sheet-title').textContent = info.title;
      $('sheet-lede').textContent = info.lede;
      $('sheet-lede').hidden = !info.lede;
      $('sheet-next').textContent = info.next;
      $('sheet-next').hidden = !info.next;
      resumeBtn.textContent = info.button;
      $('journal').replaceChildren(
        ...journal(progress).flatMap(([k, v]) => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          return [dt, dd];
        }),
      );
      $('new-game-confirm').hidden = true;
      $('new-game-btn').hidden = false;
      sheet.hidden = false;
      resumeBtn.focus({ preventScroll: true });
    },

    hideSheet() {
      sheet.hidden = true;
      (document.activeElement as HTMLElement | null)?.blur?.();
    },

    sheetOpen: () => !sheet.hidden,

    syncSettings(settings) {
      for (const input of document.querySelectorAll<HTMLInputElement>('input[name="preset"]')) {
        input.checked = input.value === settings.preset;
      }
      $<HTMLInputElement>('mute').checked = settings.muted;
    },

    setSaveState(text, failed) {
      $('save-state').textContent = text;
      $('save-state').classList.toggle('failed', failed);
    },
  };
}
