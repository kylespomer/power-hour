import { describe, expect, it } from 'vitest';
import { resolveMode } from './settings';

describe('resolveMode', () => {
  it('uses fixed numbers for presets, ignoring custom fields', () => {
    expect(resolveMode({ mode: 'centurion', rounds: 5, intervalSec: 10 })).toEqual({
      name: 'Centurion',
      rounds: 100,
      intervalSec: 60,
    });
    expect(resolveMode({ mode: 'power-hour', rounds: 5, intervalSec: 10 }).rounds).toBe(60);
  });

  it('uses the custom numbers in custom mode', () => {
    expect(resolveMode({ mode: 'custom', rounds: 5, intervalSec: 10 })).toMatchObject({ rounds: 5, intervalSec: 10 });
  });

  it('falls back to Power Hour for unknown saved modes', () => {
    expect(resolveMode({ mode: 'bogus' as never, rounds: 5, intervalSec: 10 }).name).toBe('Power Hour');
  });
});
