let ctx: AudioContext | null = null;
let interval: number | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Browsers require a user gesture before audio can play; call this on first interaction. */
export function unlockAudio(): void {
  ensureCtx();
}

function beep(): void {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  const t = c.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
  gain.gain.setValueAtTime(0.3, t + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.5);
}

export function startAlarmSound(): void {
  stopAlarmSound();
  unlockAudio();
  beep();
  interval = window.setInterval(beep, 900);
}

export function stopAlarmSound(): void {
  if (interval !== null) {
    window.clearInterval(interval);
    interval = null;
  }
}
