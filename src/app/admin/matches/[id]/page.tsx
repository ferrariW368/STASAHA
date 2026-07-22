import { prisma } from '@/lib/prisma';
import { settleMatch } from '@/actions/settlement';
import { redirect } from 'next/navigation';

export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
  if (!match) return <p>Maç bulunamadı.</p>;

  const allPlayers = [...match.homeTeam.players, ...match.awayTeam.players];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{match.homeTeam.name} vs {match.awayTeam.name}</h1>
      <p className="mb-4 text-sm text-gray-500">Durum: {match.status}</p>

      {match.status === 'finished' ? (
        <p>Sonuç: {match.finalHomeScore} - {match.finalAwayScore} (sonuçlandırıldı)</p>
      ) : (
        <form
          action={async (formData) => {
            'use server';
            const homeScore = parseInt(formData.get('homeScore') as string, 10);
            const awayScore = parseInt(formData.get('awayScore') as string, 10);
            const playerGoals = allPlayers.map((p) => ({
              playerId: p.id,
              goalCount: parseInt((formData.get(`goals_${p.id}`) as string) || '0', 10),
            }));
            const result = await settleMatch(match.id, homeScore, awayScore, playerGoals);
            if (!result.error) redirect('/admin');
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-2">
            <input name="homeScore" type="number" min={0} placeholder="Ev sahibi skor" className="w-1/2 rounded border px-3 py-2" required />
            <input name="awayScore" type="number" min={0} placeholder="Deplasman skor" className="w-1/2 rounded border px-3 py-2" required />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Oyuncu Golleri</h2>
            {allPlayers.map((p) => (
              <div key={p.id} className="mb-1 flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <input name={`goals_${p.id}`} type="number" min={0} defaultValue={0} className="w-16 rounded border px-2 py-1" />
              </div>
            ))}
          </div>
          <button className="rounded bg-red-600 px-4 py-2 font-semibold text-white">
            Sonuçlandır (geri alınamaz)
          </button>
        </form>
      )}
    </div>
  );
}
