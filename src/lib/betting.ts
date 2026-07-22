export type MatchResult = {
  homeScore: number;
  awayScore: number;
  playerGoals: Record<string, number>; // playerId -> goal count
};

export type Selection = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS';
  selectionKey: string;
};

export function isSelectionCorrect(selection: Selection, result: MatchResult): boolean {
  const { market, selectionKey } = selection;
  const { homeScore, awayScore, playerGoals } = result;

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
    if (band === '0') return goals === 0;
    if (band === '1') return goals === 1;
    if (band === '2+') return goals >= 2;
    return false;
  }

  return false;
}

export function evaluateBet(selections: Selection[], result: MatchResult): 'won' | 'lost' {
  return selections.every((s) => isSelectionCorrect(s, result)) ? 'won' : 'lost';
}
