import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'desc' },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Maçlar</h1>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="rounded border p-3 text-sm">
            <Link href={`/admin/matches/${m.id}`} className="font-medium text-green-700">
              {m.homeTeam.name} vs {m.awayTeam.name}
            </Link>
            <div className="text-gray-500">
              {m.kickoffTime.toLocaleString('tr-TR')} — durum: {m.status}
              {m.status === 'finished' ? ` (${m.finalHomeScore}-${m.finalAwayScore})` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
