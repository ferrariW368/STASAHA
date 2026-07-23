export type MatchResult = {
  homeScore: number;
  awayScore: number;
  playerGoals: Record<string, number>; // playerId -> goal count
  redCard?: boolean;
  pitchInvasion?: boolean;
  fights?: Record<string, boolean>; // playerId -> did they fight
  lateArrivals?: Record<string, boolean>; // playerId -> did they arrive late
};

export type Selection = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS' | 'BTS' | 'NOVELTY' | 'FIGHT' | 'LATE';
  selectionKey: string;
};

export function isSelectionCorrect(selection: Selection, result: MatchResult): boolean {
  const { market, selectionKey } = selection;
  const { homeScore, awayScore, playerGoals, redCard, pitchInvasion, fights, lateArrivals } = result;

  if (market === '1X2') {
    const outcome = homeScore > awayScore ? '1' : homeScore === awayScore ? 'X' : '2';
    return selectionKey === outcome;
  }

  if (market === 'SCORE') {
    return selectionKey === `${homeScore}-${awayScore}`;
  }

  if (market === 'OU_GOALS') {
    const [side, lineStr] = selectionKey.split('_');
    const line = parseFloat(lineStr);
    const total = homeScore + awayScore;
    return side === 'OVER' ? total > line : total < line;
  }

  if (market === 'PLAYER_GOALS') {
    const [playerId, band] = selectionKey.split(':');
    const goals = playerGoals[playerId] ?? 0;
    if (band === '1+') return goals >= 1;
    if (band === '2+') return goals >= 2;
    return false;
  }

  if (market === 'BTS') {
    const bothScored = homeScore > 0 && awayScore > 0;
    return selectionKey === (bothScored ? 'YES' : 'NO');
  }

  if (market === 'NOVELTY') {
    if (selectionKey.startsWith('RED_CARD')) {
      return selectionKey === (redCard ? 'RED_CARD_YES' : 'RED_CARD_NO');
    }
    if (selectionKey.startsWith('PITCH_INVASION')) {
      return selectionKey === (pitchInvasion ? 'PITCH_INVASION_YES' : 'PITCH_INVASION_NO');
    }
    return false;
  }

  if (market === 'FIGHT') {
    const [playerId, expected] = selectionKey.split(':');
    const happened = fights?.[playerId] ?? false;
    return expected === (happened ? 'YES' : 'NO');
  }

  if (market === 'LATE') {
    const [playerId, expected] = selectionKey.split(':');
    const happened = lateArrivals?.[playerId] ?? false;
    return expected === (happened ? 'YES' : 'NO');
  }

  return false;
}

export function evaluateBet(selections: Selection[], result: MatchResult): 'won' | 'lost' {
  return selections.every((s) => isSelectionCorrect(s, result)) ? 'won' : 'lost';
}
