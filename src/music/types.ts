export interface TrackInfo {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

/**
 * Common interface over every music source. Each source is responsible for
 * its own auth / loading; the game only ever calls these methods.
 */
export interface MusicSource {
  readonly id: string;
  readonly label: string;
  /** Prepare the source (load SDKs, auth, queue). Called from a user gesture. */
  prepare(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Advance to the next song (called once per drink). */
  next(): Promise<void>;
  /** 0..1 */
  setVolume(volume: number): Promise<void>;
  onTrackChange?: (track: TrackInfo | null) => void;
  dispose(): void;
}

export class SilentSource implements MusicSource {
  readonly id = 'none';
  readonly label = 'No music';
  async prepare() {}
  async play() {}
  async pause() {}
  async next() {}
  async setVolume() {}
  dispose() {}
}

export function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
