// Deliberately source-agnostic: both football Bet rows and HorseBet rows
// share this exact shape, so callers merge both arrays before calling
// computeUserScore — one net "puan" across both games. Horse ownership
// bonus payouts are NOT bet rows and must never be passed in here.
export type ScoredBet = { status: string; stake: number; potentialWin: number };

export type UserScore = { won: number; lost: number; net: number };

// "Puan" is net STA profit/loss, not raw balance: winning bets contribute
// their net gain (payout minus the stake that funded it), losing bets
// contribute their lost stake, and pending/refunded bets don't count yet.
export function computeUserScore(bets: ScoredBet[]): UserScore {
  let won = 0;
  let lost = 0;
  for (const bet of bets) {
    if (bet.status === 'won') won += bet.potentialWin - bet.stake;
    else if (bet.status === 'lost') lost += bet.stake;
  }
  return { won, lost, net: won - lost };
}
