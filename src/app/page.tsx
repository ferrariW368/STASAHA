import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function HomePage() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['upcoming', 'locked'] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'asc' },
  });

  const topUsers = await prisma.user.findMany({
    orderBy: { staBalance: 'desc' },
    take: 3,
    select: { username: true, staBalance: true },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Hali Saha İddaa</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Yaklaşan Maçlar</h2>
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
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
                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                  Kupon Yap
                </span>
              </Link>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="rounded-xl bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
              Şu an yaklaşan maç yok.
            </li>
          )}
        </ul>
      </section>

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
              <span className="font-semibold text-green-700">{u.staBalance} STA</span>
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
