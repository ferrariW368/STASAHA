import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'desc' },
  });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Maçlar</h2>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-pitch-night-raised p-4 text-sm">
            <Link href={`/admin/matches/${m.id}`} className="font-semibold text-gold">
              {m.homeTeam.name} vs {m.awayTeam.name}
            </Link>
            <div className="mt-1 text-text-muted">
              {m.kickoffTime.toLocaleString('tr-TR')} — durum: {m.status}
              {m.status === 'finished' ? ` (${m.finalHomeScore}-${m.finalAwayScore})` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
