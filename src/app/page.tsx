import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';
import { isMatchLocked } from '@/lib/matchLock';
import { computeUserScore } from '@/lib/score';

export default async function HomePage() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['upcoming', 'locked'] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'asc' },
  });

  const finishedMatches = await prisma.match.findMany({
    where: { status: 'finished' },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'desc' },
    take: 5,
  });

  const usersForScore = await prisma.user.findMany({
    where: { role: 'user' },
    select: { username: true, bets: { select: { status: true, stake: true, potentialWin: true } } },
  });
  const topUsers = usersForScore
    .map((u) => ({ username: u.username, score: computeUserScore(u.bets) }))
    .sort((a, b) => b.score.net - a.score.net)
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">STASAHA</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Yaklaşan Maçlar</h2>
        <ul className="flex flex-col gap-2">
          {matches.map((m) => {
            const locked = isMatchLocked(m.kickoffTime);
            return (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm transition-shadow active:shadow-none"
                >
                  <div>
                    <div className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</div>
                    <div className="text-sm text-gray-500">
                      {m.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  {locked ? (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                      Kilitli
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      Kupon Yap
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="rounded-xl bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
              Şu an yaklaşan maç yok.
            </li>
          )}
        </ul>
      </section>

      <AdBanner />

      {finishedMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Geçmiş Maçlar</h2>
          <ul className="flex flex-col gap-2">
            {finishedMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="block rounded-xl bg-white p-3 shadow-sm transition-shadow active:shadow-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {m.finalHomeScore} - {m.finalAwayScore}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {m.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liderlik Tablosu</h2>
          <Link href="/leaderboard" className="text-sm font-medium text-green-700">Tümünü gör</Link>
        </div>
        <ol className="flex flex-col gap-1 rounded-xl bg-white p-2 shadow-sm">
          {topUsers.map((u, i) => (
            <li key={u.username} className="flex justify-between rounded-lg px-3 py-2 text-sm">
              <span>
                <span className="mr-1 text-gray-400">{i + 1}.</span>
                {u.username}
              </span>
              <span className={`font-semibold ${u.score.net > 0 ? 'text-green-700' : u.score.net < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {u.score.net > 0 ? '+' : ''}{u.score.net} puan
              </span>
            </li>
          ))}
          {topUsers.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">Henüz kullanıcı yok.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
