import { describe, it, expect } from 'vitest';
import { isMatchLocked } from '../src/lib/matchLock';

describe('isMatchLocked', () => {
  it('is not locked when kickoff is in the future', () => {
    const now = new Date('2026-07-22T18:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(false);
  });

  it('is locked exactly at kickoff time', () => {
    const now = new Date('2026-07-22T19:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(true);
  });

  it('is locked when kickoff is in the past', () => {
    const now = new Date('2026-07-22T20:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(true);
  });
});
