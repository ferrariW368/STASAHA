import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { statusLabel } from '@/lib/betDisplay';
import Link from 'next/link';

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

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Kuponlarım</h1>
      <div className="flex flex-col gap-3">
        {bets.map((bet) => {
          const status = statusLabel[bet.status] ?? statusLabel.pending;
          return (
            <Link
              key={bet.id}
              href={`/bets/${bet.id}`}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-shadow active:shadow-none"
            >
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">
                    {bet.match.homeTeam.name} vs {bet.match.awayTeam.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.text}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {bet.selections.length} seçim · {bet.stake} STA · Oran {bet.totalOdds.toFixed(2)}
                </p>
              </div>
              <span className="shrink-0 text-gray-300">›</span>
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
