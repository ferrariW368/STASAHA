import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'Bekliyor', className: 'bg-yellow-50 text-yellow-700' },
  won: { text: 'Kazandı', className: 'bg-green-50 text-green-700' },
  lost: { text: 'Kaybetti', className: 'bg-red-50 text-red-700' },
};

const marketLabel: Record<string, string> = {
  '1X2': 'Maç Sonucu',
  SCORE: 'Skor',
  OU_GOALS: 'Toplam Gol',
  BTS: 'KG Var/Yok',
  NOVELTY: 'Eğlenceli Bahis',
  PLAYER_GOALS: 'Oyuncu Golü',
  FIGHT: 'Kavga',
  LATE: 'Geç Kalma',
};

export default async function MyBetsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-500">
        Kuponlarını görmek için giriş yapmalısın.
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return null;

  const bets = await prisma.bet.findMany({
    where: { userId: user.id },
    include: {
      match: { include: { homeTeam: true, awayTeam: true } },
      selections: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const playerIds = bets
    .flatMap((b) => b.selections)
    .filter((s) => ['PLAYER_GOALS', 'FIGHT', 'LATE'].includes(s.market))
    .map((s) => s.selectionKey.split(':')[0]);
  const players = playerIds.length
    ? await prisma.player.findMany({ where: { id: { in: playerIds } } })
    : [];
  const playerNameById = new Map(players.map((p) => [p.id, p.name]));

  function describeSelection(market: string, selectionKey: string) {
    if (market === 'PLAYER_GOALS') {
      const [playerId, band] = selectionKey.split(':');
      const name = playerNameById.get(playerId) ?? 'Oyuncu';
      const bandLabel = band === '1+' ? 'Gol Atar' : '2+ Gol';
      return `${name} · ${bandLabel}`;
    }
    if (market === 'FIGHT') {
      const [playerId] = selectionKey.split(':');
      return `${playerNameById.get(playerId) ?? 'Oyuncu'} kavga eder`;
    }
    if (market === 'LATE') {
      const [playerId] = selectionKey.split(':');
      return `${playerNameById.get(playerId) ?? 'Oyuncu'} geç kalır`;
    }
    if (market === 'BTS') {
      return selectionKey === 'YES' ? 'Karşılıklı gol var' : 'Karşılıklı gol yok';
    }
    if (market === 'NOVELTY') {
      const labels: Record<string, string> = {
        RED_CARD_YES: 'Kırmızı kart çıkar',
        RED_CARD_NO: 'Kırmızı kart çıkmaz',
        PITCH_INVASION_YES: 'Sahaya biri dalar',
        PITCH_INVASION_NO: 'Sahaya kimse dalmaz',
      };
      return labels[selectionKey] ?? selectionKey;
    }
    return selectionKey;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Kuponlarım</h1>
      <div className="flex flex-col gap-3">
        {bets.map((bet) => {
          const status = statusLabel[bet.status] ?? statusLabel.pending;
          return (
            <Link
              key={bet.id}
              href={`/matches/${bet.matchId}`}
              className="block rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">
                  {bet.match.homeTeam.name} vs {bet.match.awayTeam.name}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                  {status.text}
                </span>
              </div>
              <p className="mb-2 text-xs text-gray-500">
                {bet.match.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <ul className="mb-2 flex flex-col gap-0.5 text-xs text-gray-600">
                {bet.selections.map((s) => (
                  <li key={s.id}>
                    {marketLabel[s.market] ?? s.market}: {describeSelection(s.market, s.selectionKey)}{' '}
                    <span className="text-gray-400">({s.oddsValueAtBet.toFixed(2)})</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-sm">
                <span>{bet.stake} STA · Oran {bet.totalOdds.toFixed(2)}</span>
                <span className="font-semibold">Olası Kazanç: {bet.potentialWin} STA</span>
              </div>
            </Link>
          );
        })}
        {bets.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
            Henüz kupon yapmadın.
          </p>
        )}
      </div>
    </main>
  );
}
