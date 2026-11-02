export type GameStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface GameConfig {
  /** Number of drinks in a game (60 for a classic power hour). */
  rounds: number;
  /** Time between drinks in milliseconds (60 000 for a classic power hour). */
  intervalMs: number;
}

export interface GameSnapshot {
  status: GameStatus;
  elapsedMs: number;
  /** Drinks that have happened so far (0..rounds). */
  drinksTaken: number;
  /** Milliseconds until the next drink (0 when finished). */
  msUntilNextDrink: number;
  /** Fraction 0..1 of the current minute that has passed. */
  roundProgress: number;
  /** Fraction 0..1 of the whole game that has passed. */
  totalProgress: number;
}

export interface UpdateResult {
  snapshot: GameSnapshot;
  /** Drink numbers (1-based) that became due since the previous update. */
  newDrinks: number[];
  /** True on the update where the game transitions to finished. */
  justFinished: boolean;
}

export const CLASSIC_CONFIG: GameConfig = { rounds: 60, intervalMs: 60_000 };

/**
 * Wall-clock based power hour timer.
 *
 * Elapsed time is computed from timestamps rather than by counting ticks, so
 * browser timer throttling (background tabs, locked phones) can delay an alert
 * but never makes the game drift.
 */
export class PowerHourGame {
  private status: GameStatus = 'idle';
  private accumulatedMs = 0;
  private runningSince = 0;
  private drinksReported = 0;

  constructor(
    readonly config: GameConfig = CLASSIC_CONFIG,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!(config.rounds >= 1) || !(config.intervalMs > 0)) {
      throw new Error('rounds must be >= 1 and intervalMs must be > 0');
    }
  }

  get totalMs(): number {
    return this.config.rounds * this.config.intervalMs;
  }

  start(): void {
    if (this.status === 'running') return;
    if (this.status === 'finished') this.reset();
    this.status = 'running';
    this.runningSince = this.now();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.accumulatedMs += this.now() - this.runningSince;
    this.status = 'paused';
  }

  reset(): void {
    this.status = 'idle';
    this.accumulatedMs = 0;
    this.runningSince = 0;
    this.drinksReported = 0;
  }

  /** Call frequently (e.g. every animation frame / 250ms). */
  update(): UpdateResult {
    const elapsedMs = Math.min(this.elapsed(), this.totalMs);
    const due = Math.min(
      Math.floor(elapsedMs / this.config.intervalMs),
      this.config.rounds,
    );

    const newDrinks: number[] = [];
    for (let n = this.drinksReported + 1; n <= due; n++) newDrinks.push(n);
    this.drinksReported = Math.max(this.drinksReported, due);

    let justFinished = false;
    if (this.status === 'running' && elapsedMs >= this.totalMs) {
      this.accumulatedMs = this.totalMs;
      this.status = 'finished';
      justFinished = true;
    }

    return { snapshot: this.snapshot(elapsedMs), newDrinks, justFinished };
  }

  private elapsed(): number {
    return this.status === 'running'
      ? this.accumulatedMs + (this.now() - this.runningSince)
      : this.accumulatedMs;
  }

  private snapshot(elapsedMs: number): GameSnapshot {
    const { intervalMs } = this.config;
    const finished = elapsedMs >= this.totalMs;
    const intoRound = elapsedMs % intervalMs;
    return {
      status: this.status,
      elapsedMs,
      drinksTaken: this.drinksReported,
      msUntilNextDrink: finished ? 0 : intervalMs - intoRound,
      roundProgress: finished ? 1 : intoRound / intervalMs,
      totalProgress: elapsedMs / this.totalMs,
    };
  }
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
