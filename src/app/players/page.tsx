import { prisma } from '@/lib/prisma';
import Link from 'next/link';

function overallRating(p: { pace: number | null; shooting: number | null; passing: number | null; dribbling: number | null; defending: number | null; physical: number | null }) {
  const values = [p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physical].filter(
    (v): v is number => v !== null
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    include: { team: true },
    orderBy: { name: 'asc' },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Oyuncular</h1>
      <p className="mb-4 text-xs text-neutral-500">Kadro, güç değerleri ve piyasa değerleri</p>
      <div className="flex flex-col gap-2">
        {players.map((p) => {
          const rating = overallRating(p);
          return (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="flex items-center justify-between rounded-xl bg-neutral-900 p-3 shadow-sm transition-shadow active:shadow-none"
            >
              <div>
                <div className="font-medium">
                  {p.name}
                  {p.number ? <span className="ml-1 text-xs text-neutral-600">#{p.number}</span> : null}
                </div>
                <div className="text-xs text-neutral-500">{p.team ? p.team.name : 'Serbest Oyuncu'}</div>
              </div>
              <div className="flex items-center gap-3">
                {rating !== null && (
                  <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-400">
                    {rating} GÜÇ
                  </span>
                )}
                {p.marketValue !== null && (
                  <span className="text-xs font-semibold text-green-400">{p.marketValue} STA</span>
                )}
              </div>
            </Link>
          );
        })}
        {players.length === 0 && (
          <p className="rounded-xl bg-neutral-900 p-4 text-center text-sm text-neutral-600 shadow-sm">
            Henüz oyuncu yok.
          </p>
        )}
      </div>
    </main>
  );
}
