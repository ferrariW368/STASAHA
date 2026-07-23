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
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:1+' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p4:1+' }, result)).toBe(false);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:2+' }, result)).toBe(false);
  });

  it('evaluates both-teams-to-score correctly', () => {
    expect(isSelectionCorrect({ market: 'BTS', selectionKey: 'YES' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'BTS', selectionKey: 'NO' }, result)).toBe(false);
    const noAwayGoal = { ...result, awayScore: 0 };
    expect(isSelectionCorrect({ market: 'BTS', selectionKey: 'NO' }, noAwayGoal)).toBe(true);
  });

  it('evaluates novelty markets against the admin-reported flags', () => {
    const withEvents = { ...result, redCard: true, pitchInvasion: false };
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'RED_CARD_YES' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'RED_CARD_NO' }, withEvents)).toBe(false);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'PITCH_INVASION_NO' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'PITCH_INVASION_YES' }, withEvents)).toBe(false);
  });

  it('defaults novelty flags to false when not reported', () => {
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'RED_CARD_NO' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'PITCH_INVASION_NO' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'REFEREE_ARGUMENT_NO' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'MATCH_ABANDONED_NO' }, result)).toBe(true);
  });

  it('evaluates the referee-argument and match-abandoned novelty markets', () => {
    const withEvents = { ...result, refereeArgument: true, matchAbandoned: false };
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'REFEREE_ARGUMENT_YES' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'REFEREE_ARGUMENT_NO' }, withEvents)).toBe(false);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'MATCH_ABANDONED_NO' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'NOVELTY', selectionKey: 'MATCH_ABANDONED_YES' }, withEvents)).toBe(false);
  });

  it('evaluates per-player fight and late-arrival markets', () => {
    const withEvents = { ...result, fights: { p1: true }, lateArrivals: { p3: true } };
    expect(isSelectionCorrect({ market: 'FIGHT', selectionKey: 'p1:YES' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'FIGHT', selectionKey: 'p1:NO' }, withEvents)).toBe(false);
    expect(isSelectionCorrect({ market: 'FIGHT', selectionKey: 'p2:NO' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'LATE', selectionKey: 'p3:YES' }, withEvents)).toBe(true);
    expect(isSelectionCorrect({ market: 'LATE', selectionKey: 'p4:NO' }, withEvents)).toBe(true);
  });

  it('defaults fight/late to NO when not reported for a player', () => {
    expect(isSelectionCorrect({ market: 'FIGHT', selectionKey: 'p1:NO' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'LATE', selectionKey: 'p1:NO' }, result)).toBe(true);
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
