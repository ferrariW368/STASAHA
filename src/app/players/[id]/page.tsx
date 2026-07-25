import { prisma } from '@/lib/prisma';
import Link from 'next/link';

const attributeLabels: { key: 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical'; label: string }[] = [
  { key: 'pace', label: 'Hız' },
  { key: 'shooting', label: 'Şut' },
  { key: 'passing', label: 'Pas' },
  { key: 'dribbling', label: 'Dripling' },
  { key: 'defending', label: 'Defans' },
  { key: 'physical', label: 'Fizik' },
];

const stageLabel: Record<string, { text: string; className: string }> = {
  RUMOR: { text: 'Söylenti', className: 'bg-gray-100 text-gray-600' },
  ADVANCED: { text: 'Büyük Oranda Bitti', className: 'bg-amber-50 text-amber-700' },
  FAILED: { text: 'Gerçekleşmedi', className: 'bg-red-50 text-red-600' },
  SIGNED: { text: 'İmza Atıldı', className: 'bg-green-50 text-green-700' },
  CANCELLED: { text: 'İptal Edildi', className: 'bg-red-50 text-red-600' },
};

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      team: true,
      playerGoals: true,
      transferNews: { include: { fromTeam: true, toTeam: true }, orderBy: { createdAt: 'desc' } },
      appearances: {
        include: { team: true, match: true },
        orderBy: { match: { kickoffTime: 'asc' } },
      },
    },
  });

  if (!player) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-500">
        Oyuncu bulunamadı.
      </main>
    );
  }

  const totalGoals = player.playerGoals.reduce((sum, g) => sum + g.goalCount, 0);
  const playedAppearances = player.appearances.filter((a) => a.match.status === 'finished');
  const teamsPlayedFor = [...new Set(player.appearances.map((a) => a.team.name))];
  const values = [player.pace, player.shooting, player.passing, player.dribbling, player.defending, player.physical].filter(
    (v): v is number => v !== null
  );
  const overall = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link href="/players" className="mb-4 inline-block text-sm text-gray-500">‹ Oyuncular</Link>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {player.name} {player.number ? <span className="text-gray-400">#{player.number}</span> : null}
            </h1>
            <p className="text-sm text-gray-500">{player.team ? player.team.name : 'Serbest Oyuncu'}</p>
            {player.styleInspiration && (
              <p className="mt-1 text-xs italic text-gray-400">Oyun stili esini: {player.styleInspiration}</p>
            )}
          </div>
          {overall !== null && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-center">
              <div className="text-2xl font-black text-amber-700">{overall}</div>
              <div className="text-[10px] font-semibold text-amber-600">GÜÇ</div>
            </div>
          )}
        </div>
        {player.marketValue !== null && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center text-sm font-bold text-green-700">
            Piyasa Değeri: {player.marketValue} STA
          </div>
        )}
      </div>

      {values.length > 0 && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-600">Özellikler</h2>
          <div className="flex flex-col gap-2">
            {attributeLabels.map(({ key, label }) => {
              const value = player[key];
              if (value === null) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-gray-600">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-gray-700">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Hali Saha Karnesi</h2>
        <p className="text-sm">Maç sayısı: <span className="font-semibold">{playedAppearances.length}</span></p>
        <p className="text-sm">Toplam gol: <span className="font-semibold">{totalGoals}</span></p>
        {teamsPlayedFor.length > 0 && (
          <p className="mt-1 text-sm">
            Oynadığı takımlar: <span className="font-semibold">{teamsPlayedFor.join(', ')}</span>
          </p>
        )}
      </div>

      {player.transferNews.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-600">Transfer Geçmişi</h2>
          <ul className="flex flex-col gap-2">
            {player.transferNews.map((n) => {
              const stage = stageLabel[n.stage] ?? stageLabel.RUMOR;
              return (
                <li key={n.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span>
                      {n.fromTeam?.name ?? 'Serbest'} → {n.toTeam?.name ?? 'Serbest'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${stage.className}`}>{stage.text}</span>
                  </div>
                  {n.note && <p className="text-gray-500">{n.note}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
