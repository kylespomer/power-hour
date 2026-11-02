export type AlertSound = 'horn' | 'bell' | 'whistle';

let ctx: AudioContext | null = null;

/** Must be called from a user gesture (e.g. the Start button) on iOS/Safari. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(
  ac: AudioContext,
  type: OscillatorType,
  freq: number,
  start: number,
  duration: number,
  gain: number,
): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.setValueAtTime(gain, start + duration - 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Plays the alert and resolves (approximately) when it has finished. */
export function playAlertSound(sound: AlertSound): Promise<void> {
  unlockAudio();
  const ac = ctx!;
  const t = ac.currentTime + 0.02;
  let length = 0;

  switch (sound) {
    case 'horn':
      // Three-blast air horn built from detuned sawtooth chords.
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.32;
        const d = i === 2 ? 0.7 : 0.24;
        for (const f of [233, 236, 349, 466]) tone(ac, 'sawtooth', f, s, d, 0.09);
      }
      length = 1.4;
      break;
    case 'bell':
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.35;
        tone(ac, 'sine', 1318, s, 0.6, 0.35);
        tone(ac, 'sine', 2637, s, 0.3, 0.1);
      }
      length = 1.4;
      break;
    case 'whistle':
      tone(ac, 'square', 2200, t, 0.18, 0.08);
      tone(ac, 'square', 2200, t + 0.25, 0.6, 0.08);
      length = 0.9;
      break;
  }
  return new Promise((resolve) => setTimeout(resolve, length * 1000));
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1.1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function vibrate(): void {
  navigator.vibrate?.([300, 120, 300, 120, 600]);
}

export async function requestNotificationPermission(): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/** Only shown when the page is hidden; when visible the full-screen flash is enough. */
export function notify(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, tag: 'power-hour', icon: '/icon.svg' });
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
