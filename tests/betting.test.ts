import { describe, it, expect } from 'vitest';
import { isSelectionCorrect, evaluateBet } from '../src/lib/betting';

const result = { homeScore: 2, awayScore: 1, playerGoals: { p1: 1, p2: 1, p3: 1, p4: 0 } };

describe('isSelectionCorrect', () => {
  it('evaluates 1X2 home win correctly', () => {
    expect(isSelectionCorrect({ market: '1X2', selectionKey: '1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: '1X2', selectionKey: 'X' }, result)).toBe(false);
    expect(isSelectionCorrect({ market: '1X2', selectionKey: '2' }, result)).toBe(false);
  });

  it('evaluates exact score correctly', () => {
    expect(isSelectionCorrect({ market: 'SCORE', selectionKey: '2-1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'SCORE', selectionKey: '1-1' }, result)).toBe(false);
  });

  it('evaluates over/under goals correctly', () => {
    expect(isSelectionCorrect({ market: 'OU_GOALS', selectionKey: 'UNDER_4.5' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'OU_GOALS', selectionKey: 'OVER_4.5' }, result)).toBe(false);
  });

  it('evaluates player goal bands correctly', () => {
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p4:0' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:2+' }, result)).toBe(false);
  });
});

describe('evaluateBet', () => {
  it('wins only when every selection in the combined slip is correct', () => {
    const allCorrect = [
      { market: '1X2' as const, selectionKey: '1' },
      { market: 'SCORE' as const, selectionKey: '2-1' },
    ];
    expect(evaluateBet(allCorrect, result)).toBe('won');
  });

  it('loses when any single selection is wrong', () => {
    const oneWrong = [
      { market: '1X2' as const, selectionKey: '1' },
      { market: 'SCORE' as const, selectionKey: '3-0' },
    ];
    expect(evaluateBet(oneWrong, result)).toBe('lost');
  });
});
