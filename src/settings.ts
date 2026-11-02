import type { AlertSound } from './alert';

export type SourceId = 'spotify' | 'youtube' | 'local' | 'none';

export type ModeId = 'power-hour' | 'centurion' | 'custom';

export interface GameMode {
  name: string;
  rounds: number;
  intervalSec: number;
}

export const PRESETS: Record<Exclude<ModeId, 'custom'>, GameMode> = {
  'power-hour': { name: 'Power Hour', rounds: 60, intervalSec: 60 },
  centurion: { name: 'Centurion', rounds: 100, intervalSec: 60 },
};

/** The game that will actually be played: a preset, or the custom numbers. */
export function resolveMode(s: Pick<Settings, 'mode' | 'rounds' | 'intervalSec'>): GameMode {
  if (s.mode === 'custom') return { name: 'Custom game', rounds: s.rounds, intervalSec: s.intervalSec };
  return PRESETS[s.mode] ?? PRESETS['power-hour'];
}

export interface Settings {
  source: SourceId;
  mode: ModeId;
  spotifyLink: string;
  youtubeLink: string;
  /** rounds and intervalSec are only used when mode is 'custom'. */
  rounds: number;
  intervalSec: number;
  alertSound: AlertSound;
  startOffsetSec: number;
  changeSongEachDrink: boolean;
  voice: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  source: 'youtube',
  mode: 'power-hour',
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
