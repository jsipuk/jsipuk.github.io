// Rest timer.
//
// The timer is a timestamp, not a countdown: `session.rest.endsAt` is stored
// with the session, so locking the phone, switching apps or reloading the page
// all give the correct remaining time when you come back. The interval below
// only exists to repaint the display.
import { state, persistSession } from "./state.js";

const listeners = new Set();
let intervalId = null;
let audioContext = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(event) {
  for (const fn of listeners) fn(event);
}

export function isResting() {
  return Boolean(state.session && state.session.rest && remaining() > 0);
}

/** Seconds left, floored at 0. Returns 0 when no timer is running. */
export function remaining() {
  const rest = state.session && state.session.rest;
  if (!rest) return 0;
  return Math.max(0, (new Date(rest.endsAt).getTime() - Date.now()) / 1000);
}

export function restInfo() {
  const rest = state.session && state.session.rest;
  if (!rest) return null;
  return { ...rest, remaining: remaining() };
}

export function start(seconds, itemId) {
  if (!state.session || !seconds) return;
  state.session.rest = {
    itemId,
    durationSeconds: seconds,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + seconds * 1000).toISOString(),
  };
  persistSession();
  primeAudio();
  ensureTicking();
  notify({ type: "start" });
}

export function addTime(seconds) {
  const rest = state.session && state.session.rest;
  if (!rest) return;
  // Extend from whatever is left, so +30s always means thirty more seconds.
  const base = Math.max(Date.now(), new Date(rest.endsAt).getTime());
  rest.endsAt = new Date(base + seconds * 1000).toISOString();
  rest.durationSeconds += seconds;
  persistSession();
  ensureTicking();
  notify({ type: "extend" });
}

export function skip() {
  if (!state.session || !state.session.rest) return;
  state.session.rest = null;
  persistSession();
  stopTicking();
  notify({ type: "skip" });
}

/** Called on load and when returning to the app, to re-attach to a live timer. */
export function resume() {
  if (!state.session || !state.session.rest) return;
  if (remaining() <= 0) {
    // It finished while we were away. Clear it quietly — a late buzz in the
    // middle of the next set would be worse than no buzz at all.
    state.session.rest = null;
    persistSession();
    notify({ type: "expired-quietly" });
    return;
  }
  ensureTicking();
}

function ensureTicking() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    if (!state.session || !state.session.rest) {
      stopTicking();
      return;
    }
    if (remaining() <= 0) {
      finish();
      return;
    }
    notify({ type: "tick", remaining: remaining() });
  }, 500);
}

function stopTicking() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function finish() {
  stopTicking();
  if (!state.session) return;
  state.session.rest = null;
  persistSession();
  const visible = document.visibilityState === "visible";
  if (visible) {
    if (state.settings.restSound) playChime();
    if (state.settings.vibration) {
      try {
        navigator.vibrate?.([120, 90, 120]);
      } catch {
        /* Not supported on iOS Safari. */
      }
    }
  }
  notify({ type: "expired" });
}

/* ---------------------------------------------------------------------------
 * Audio. iOS only allows an AudioContext that was created or resumed inside a
 * user gesture, so we prime it when the user taps Complete Set.
 * ------------------------------------------------------------------------- */
function primeAudio() {
  if (!state.settings.restSound) return;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.warn("Audio unavailable", error);
  }
}

function playChime() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  for (const [index, frequency] of [880, 1320].entries()) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const at = now + index * 0.18;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.18);
  }
}

/** Lets Settings play the same sound when the user turns it on. */
export function previewSound() {
  primeAudio();
  playChime();
}
