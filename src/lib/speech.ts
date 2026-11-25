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
const VOICE = 'funny-games:voice';

/**
 * The English voices this computer has, the best first: the natural (neural) voices of Edge and
 * Windows, a child's (Ana) at the top, then Google's, then the rest. Clara found the old robotic
 * one (Zira) bad: the computer's plain voices come last.
 */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  if (!voicesCache.length) voicesCache = speechSynthesis.getVoices();
  const rank = (v: SpeechSynthesisVoice) =>
    /Ana.*(Natural|Online)/i.test(v.name)
      ? 0
      : /Natural|Online/i.test(v.name)
        ? 1
        : /Google UK English Female/i.test(v.name)
          ? 2
          : /Google/i.test(v.name)
            ? 3
            : /Samantha|Karen|Moira|Tessa/i.test(v.name)
              ? 4
              : 9;
  return voicesCache.filter((v) => /^en[-_]/i.test(v.lang)).sort((a, b) => rank(a) - rank(b));
}

/** The voice chosen on this computer (its name), or none for the best one. */
export function chosenVoice() {
  try {
    return localStorage.getItem(VOICE) ?? '';
  } catch {
    return '';
  }
}

export function chooseVoice(name: string) {
  try {
    if (name) localStorage.setItem(VOICE, name);
    else localStorage.removeItem(VOICE);
  } catch {
    /* ignore */
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  const name = chosenVoice();
  return voices.find((v) => v.name === name) ?? voices[0] ?? null;
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
    u.rate = opts.rate ?? 0.9;
    const v = pickVoice();
    // (a voice speaks in its own accent, and at its own pitch: raised, the natural ones sounded odd)
    u.lang = v?.lang ?? 'en-US';
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
