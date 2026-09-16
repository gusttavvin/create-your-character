/** Tiny synthesized UI sounds (no audio files needed). */
import { isSoundOn } from './speech';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!isSoundOn()) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

/** Short "pop" when a part is picked. */
export function playPop() {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(420, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.08);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.14);
}

/** Happy arpeggio when a character is saved. */
export function playTada() {
  tone(523.25, 0, 0.18, 'triangle');
  tone(659.25, 0.12, 0.18, 'triangle');
  tone(783.99, 0.24, 0.18, 'triangle');
  tone(1046.5, 0.36, 0.4, 'triangle', 0.2);
}

/** Soft click for buttons/toggles. */
export function playClick() {
  tone(660, 0, 0.06, 'square', 0.05);
}

/** Playful "whoosh" for the random button. */
export function playShuffle() {
  const c = getCtx();
  if (!c) return;
  for (let i = 0; i < 4; i++) tone(300 + i * 120, i * 0.05, 0.08, 'triangle', 0.1);
}
