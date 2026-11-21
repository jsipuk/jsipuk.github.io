// HTML overlay: one-line job with an arrow, the labelled action button,
// captions, the phone dialogue and the pause/start sheet.

import type { Vec } from './rules/math.ts';
import { PRESETS } from './rules/controls.ts';
import type { Session } from './rules/session.ts';
import { availableAction, objective } from './rules/session.ts';
import type { Settings, StoredLap } from './settings.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface Hud {
  /** Called every frame; only touches the DOM when something changed. */
  render(s: Session, focus: Vec, touch: boolean): void;
  toast(text: string, seconds?: number): void;
  showSheet(kind: 'start' | 'pause'): void;
  hideSheet(): void;
  sheetOpen(): boolean;
  syncSettings(settings: Settings): void;
  renderLaps(laps: StoredLap[]): void;
}

export const formatSeconds = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const presetLabel = (p: string): string =>
  p === 'pad' || p === 'wheel' ? `${PRESETS[p].letter} · ${PRESETS[p].name}` : 'Mixed steering';

export function createHud(): Hud {
  const root = $('hud');
  const jobText = $('job-text');
  const jobArrow = $('job-arrow');
  const act = $('act-btn');
  const actVerb = $('act-verb');
  const actReason = $('act-reason');
  const caption = $('caption');
  const padLabel = $('pad-label');
  const dialogue = $('dialogue');
  const dlgSpeaker = $('dlg-speaker');
  const dlgRole = $('dlg-role');
  const dlgText = $('dlg-text');
  const toastEl = $('toast');
  const sheet = $('sheet');
  const sheetTitle = $('sheet-title');
  const resumeBtn = $('resume-btn');
  const lede = $('sheet-lede');
  const lapLog = $('lap-log');
  const lapsEmpty = $('laps-empty');

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
      set('loco', s.locomotion, (v) => (root.dataset.loco = v));
      set('preset', s.preset, (v) => (root.dataset.preset = v));
      set('touch', touch ? '1' : '0', (v) => (root.dataset.touch = v));
      set('padLabel', s.locomotion === 'van' ? 'Drive' : 'Walk', (v) => (padLabel.textContent = v));

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
      const showAct = s.mode === 'world' && a.kind !== null;
      set('actShown', String(showAct), (v) => (act.hidden = v !== 'true'));
      set('actVerb', a.verb, (v) => (actVerb.textContent = v));
      set('actReason', a.enabled ? '' : (a.reason ?? ''), (v) => (actReason.textContent = v));
      set('actEnabled', String(a.enabled), (v) => {
        act.classList.toggle('disabled', v !== 'true');
        act.setAttribute('aria-disabled', v === 'true' ? 'false' : 'true');
      });
      const label = a.enabled ? a.verb : `${a.verb}: ${a.reason ?? 'not available'}`;
      set('actLabel', label, (v) => act.setAttribute('aria-label', v));

      const ringing = s.phoneRinging && s.mode === 'world';
      set('caption', ringing ? 'The payphone outside the depot is ringing.' : '', (v) => {
        caption.hidden = v === '';
        caption.textContent = v ? `☎ ${v}` : '';
      });

      const line = s.mode === 'dialogue' ? s.dialogue : null;
      set('dialogue', line ? line.text : '', () => {
        dialogue.hidden = !line;
        if (line) {
          dlgSpeaker.textContent = line.speaker;
          dlgRole.textContent = line.role;
          dlgText.textContent = `“${line.text}”`;
        }
      });
    },

    toast(text, seconds = 4) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), seconds * 1000);
    },

    showSheet(kind) {
      sheetTitle.textContent = kind === 'start' ? 'Lowbridge After Dark' : 'Paused';
      resumeBtn.textContent = kind === 'start' ? 'Start' : 'Resume';
      lede.hidden = kind !== 'start';
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

    renderLaps(laps) {
      lapsEmpty.hidden = laps.length > 0;
      lapLog.replaceChildren(
        ...laps
          .slice()
          .reverse()
          .map((lap) => {
            const li = document.createElement('li');
            const bumps = lap.bumps === 0 ? 'no bumps' : lap.bumps === 1 ? '1 bump' : `${lap.bumps} bumps`;
            const when = new Date(lap.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            li.textContent = `${presetLabel(lap.preset)} · ${formatSeconds(lap.lapSeconds)} · ${bumps} · ${when}`;
            return li;
          }),
      );
    },
  };
}
