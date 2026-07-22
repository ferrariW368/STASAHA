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
              <Link href={`/matches/${m.id}`} className="block rounded border p-3">
                <div className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</div>
                <div className="text-sm text-gray-500">{m.kickoffTime.toLocaleString('tr-TR')}</div>
              </Link>
            </li>
          ))}
          {matches.length === 0 && <li className="text-sm text-gray-500">Şu an yaklaşan maç yok.</li>}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liderlik Tablosu</h2>
          <Link href="/leaderboard" className="text-sm text-green-700">Tümünü gör</Link>
        </div>
        <ol className="flex flex-col gap-1">
          {topUsers.map((u, i) => (
            <li key={u.username} className="flex justify-between rounded bg-gray-50 px-3 py-2 text-sm">
              <span>{i + 1}. {u.username}</span>
              <span className="font-semibold">{u.staBalance} STA</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
