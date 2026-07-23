import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { statusLabel, marketLabel, describeSelection, playerIdsFromSelections } from '@/lib/betDisplay';
import { isSelectionCorrect } from '@/lib/betting';
import Link from 'next/link';

export default async function BetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-500">
        Bu kuponu görmek için giriş yapmalısın.
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return null;

  const bet = await prisma.bet.findUnique({
    where: { id },
    include: {
      match: { include: { homeTeam: true, awayTeam: true } },
      selections: true,
    },
  });

  if (!bet || bet.userId !== user.id) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-500">
        Kupon bulunamadı.
      </main>
    );
  }

  const playerIds = playerIdsFromSelections(bet.selections);
  const players = playerIds.length
    ? await prisma.player.findMany({ where: { id: { in: playerIds } } })
    : [];
  const playerNameById = new Map(players.map((p) => [p.id, p.name]));

  let evaluateAgainst: ReturnType<typeof buildMatchResult> | null = null;
  if (bet.match.status === 'finished') {
    const [playerGoals, playerEvents] = await Promise.all([
      prisma.playerGoal.findMany({ where: { matchId: bet.matchId } }),
      prisma.playerEvent.findMany({ where: { matchId: bet.matchId } }),
    ]);
    evaluateAgainst = buildMatchResult(bet.match, playerGoals, playerEvents);
  }

  const status = statusLabel[bet.status] ?? statusLabel.pending;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link href="/bets" className="mb-4 inline-block text-sm text-gray-500">‹ Kuponlarım</Link>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {bet.match.homeTeam.name} vs {bet.match.awayTeam.name}
          </h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.text}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {bet.match.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        {bet.match.status === 'finished' && (
          <p className="mt-1 text-sm font-semibold text-gray-700">
            Final skor: {bet.match.finalHomeScore} - {bet.match.finalAwayScore}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Seçimler</h2>
        <ul className="flex flex-col gap-2">
          {bet.selections.map((s) => {
            const correct = evaluateAgainst
              ? isSelectionCorrect({ market: s.market as never, selectionKey: s.selectionKey }, evaluateAgainst)
              : null;
            return (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-500">{marketLabel[s.market] ?? s.market}</div>
                  <div>{describeSelection(s.market, s.selectionKey, playerNameById)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{s.oddsValueAtBet.toFixed(2)}</span>
                  {correct !== null && (
                    <span className={correct ? 'text-green-600' : 'text-red-600'}>{correct ? '✓' : '✗'}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Özet</h2>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Yatırılan</span>
            <span className="font-semibold">{bet.stake} STA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Toplam Oran</span>
            <span className="font-semibold">{bet.totalOdds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{bet.status === 'won' ? 'Kazanç' : 'Olası Kazanç'}</span>
            <span className="font-semibold">{bet.potentialWin} STA</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function buildMatchResult(
  match: { finalHomeScore: number | null; finalAwayScore: number | null; redCard: boolean | null; pitchInvasion: boolean | null; refereeArgument: boolean | null; matchAbandoned: boolean | null },
  playerGoals: { playerId: string; goalCount: number }[],
  playerEvents: { playerId: string; eventType: string; happened: boolean }[]
) {
  const playerGoalsMap: Record<string, number> = {};
  for (const pg of playerGoals) playerGoalsMap[pg.playerId] = pg.goalCount;

  const fights: Record<string, boolean> = {};
  const lateArrivals: Record<string, boolean> = {};
  for (const pe of playerEvents) {
    if (pe.eventType === 'FIGHT') fights[pe.playerId] = pe.happened;
    if (pe.eventType === 'LATE') lateArrivals[pe.playerId] = pe.happened;
  }

  return {
    homeScore: match.finalHomeScore ?? 0,
    awayScore: match.finalAwayScore ?? 0,
    playerGoals: playerGoalsMap,
    redCard: match.redCard ?? false,
    pitchInvasion: match.pitchInvasion ?? false,
    refereeArgument: match.refereeArgument ?? false,
    matchAbandoned: match.matchAbandoned ?? false,
    fights,
    lateArrivals,
  };
}
