/**
 * Text-to-speech helper (Web Speech API). Reads English words and sentences aloud
 * so the children can hear the correct pronunciation.
 */

const KEY = 'cyc.sound';

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();

const listeners = new Set<(on: boolean) => void>();

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (!on) stopSpeaking();
  listeners.forEach((l) => l(on));
}

export function onSoundChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let voicesCache: SpeechSynthesisVoice[] = [];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  if (!voicesCache.length) voicesCache = speechSynthesis.getVoices();
  const english = voicesCache.filter((v) => /^en[-_]/i.test(v.lang));
  const preferred =
    english.find((v) => /Google US English|Samantha|Zira|Aria|Jenny|Natural/i.test(v.name)) ??
    english.find((v) => v.lang.toLowerCase() === 'en-us') ??
    english[0];
  return preferred ?? null;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    voicesCache = speechSynthesis.getVoices();
  });
}

export function speak(text: string, opts: { rate?: number; force?: boolean } = {}) {
  if (!opts.force && !enabled) return;
  if (typeof speechSynthesis === 'undefined' || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = opts.rate ?? 0.9;
    u.pitch = 1.05;
    const v = pickVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    /* speech not available */
  }
}

export function stopSpeaking() {
  try {
    speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function canSpeak() {
  return typeof speechSynthesis !== 'undefined';
}
