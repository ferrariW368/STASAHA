import { describe, it, expect } from 'vitest';
import { getFormation, totalSlots, VALID_FORMATS } from '../src/lib/formation';

describe('getFormation', () => {
  it('supports formats 5 through 11', () => {
    expect(VALID_FORMATS.sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it('returns null for an unsupported format', () => {
    expect(getFormation(4)).toBeNull();
    expect(getFormation(12)).toBeNull();
  });

  it('every formation has exactly one GK and totals match the format', () => {
    for (const format of VALID_FORMATS) {
      const formation = getFormation(format)!;
      const gkRows = formation.rows.filter((r) => r.position === 'GK');
      expect(gkRows).toHaveLength(1);
      expect(gkRows[0].count).toBe(1);
      expect(totalSlots(formation)).toBe(format);
    }
  });

  it('rows are ordered GK, DEF, then MID (if any), then FWD', () => {
    const formation = getFormation(7)!;
    expect(formation.rows.map((r) => r.position)).toEqual(['GK', 'DEF', 'MID', 'FWD']);
  });
});
