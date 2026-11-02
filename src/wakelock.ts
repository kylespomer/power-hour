/** Keeps the screen on during a game so the phone doesn't lock and throttle timers. */
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  if (!('wakeLock' in navigator) || sentinel) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => (sentinel = null));
  } catch {
    // Denied (e.g. low battery mode) — the game still works, the screen may just sleep.
  }
}

export function releaseWakeLock(): void {
  wanted = false;
  void sentinel?.release();
  sentinel = null;
}

// The lock is dropped automatically when the page is hidden; re-take it on return.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') void acquireWakeLock();
});
