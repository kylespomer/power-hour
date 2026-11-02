import type { AlertSound } from './alert';

export type SourceId = 'spotify' | 'youtube' | 'local' | 'none';

export interface Settings {
  source: SourceId;
  spotifyLink: string;
  youtubeLink: string;
  rounds: number;
  intervalSec: number;
  alertSound: AlertSound;
  startOffsetSec: number;
  changeSongEachDrink: boolean;
  voice: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  source: 'youtube',
  spotifyLink: '',
  youtubeLink: '',
  rounds: 60,
  intervalSec: 60,
  alertSound: 'horn',
  startOffsetSec: 30,
  changeSongEachDrink: true,
  voice: true,
};

const KEY = 'ph.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}

export function clampInt(value: string | number, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
