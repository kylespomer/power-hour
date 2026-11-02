import { describe, expect, it } from 'vitest';
import { PowerHourGame, formatClock } from './game';

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('PowerHourGame', () => {
  it('reports a drink at every interval boundary', () => {
    const clock = fakeClock();
    const game = new PowerHourGame({ rounds: 3, intervalMs: 60_000 }, clock.now);
    game.start();

    clock.advance(59_999);
    expect(game.update().newDrinks).toEqual([]);

    clock.advance(1);
    expect(game.update().newDrinks).toEqual([1]);
    expect(game.update().newDrinks).toEqual([]); // not repeated

    clock.advance(60_000);
    const r = game.update();
    expect(r.newDrinks).toEqual([2]);
    expect(r.snapshot.drinksTaken).toBe(2);
  });

  it('finishes after the last drink and stops counting', () => {
    const clock = fakeClock();
    const game = new PowerHourGame({ rounds: 2, intervalMs: 1_000 }, clock.now);
    game.start();
    clock.advance(5_000);
    const r = game.update();
    expect(r.newDrinks).toEqual([1, 2]);
    expect(r.justFinished).toBe(true);
    expect(r.snapshot.status).toBe('finished');
    expect(r.snapshot.elapsedMs).toBe(2_000);

    const again = game.update();
    expect(again.justFinished).toBe(false);
    expect(again.newDrinks).toEqual([]);
  });

  it('does not advance while paused', () => {
    const clock = fakeClock();
    const game = new PowerHourGame({ rounds: 60, intervalMs: 60_000 }, clock.now);
    game.start();
    clock.advance(30_000);
    game.pause();
    clock.advance(10 * 60_000);
    expect(game.update().snapshot.elapsedMs).toBe(30_000);

    game.start();
    clock.advance(30_000);
    const r = game.update();
    expect(r.newDrinks).toEqual([1]);
    expect(r.snapshot.msUntilNextDrink).toBe(60_000);
  });

  it('catches up on missed drinks after the tab was throttled', () => {
    const clock = fakeClock();
    const game = new PowerHourGame({ rounds: 60, intervalMs: 60_000 }, clock.now);
    game.start();
    clock.advance(3 * 60_000 + 500);
    expect(game.update().newDrinks).toEqual([1, 2, 3]);
  });

  it('restarts from zero when started after finishing', () => {
    const clock = fakeClock();
    const game = new PowerHourGame({ rounds: 1, intervalMs: 1_000 }, clock.now);
    game.start();
    clock.advance(1_000);
    game.update();
    game.start();
    const r = game.update();
    expect(r.snapshot.status).toBe('running');
    expect(r.snapshot.drinksTaken).toBe(0);
  });

  it('rejects invalid config', () => {
    expect(() => new PowerHourGame({ rounds: 0, intervalMs: 1 })).toThrow();
    expect(() => new PowerHourGame({ rounds: 1, intervalMs: 0 })).toThrow();
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds, rounding up', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(59_000)).toBe('0:59');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(3_600_000)).toBe('60:00');
  });
});
