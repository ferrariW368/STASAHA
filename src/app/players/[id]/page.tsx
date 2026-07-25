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
  RUMOR: { text: 'Söylenti', className: 'bg-neutral-800 text-neutral-400' },
  ADVANCED: { text: 'Büyük Oranda Bitti', className: 'bg-amber-400/10 text-amber-400' },
  FAILED: { text: 'Gerçekleşmedi', className: 'bg-red-500/10 text-red-400' },
  SIGNED: { text: 'İmza Atıldı', className: 'bg-green-500/10 text-green-400' },
  CANCELLED: { text: 'İptal Edildi', className: 'bg-red-500/10 text-red-400' },
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
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-neutral-500">
        Oyuncu bulunamadı.
      </main>
    );
  }

  const totalGoals = player.playerGoals.reduce((sum, g) => sum + g.goalCount, 0);
  const playedAppearances = player.appearances.filter((a) => a.match.status === 'finished');
  const teamsPlayedFor = [...new Set(player.appearances.map((a) => a.team.name))];
  const gkStarts = playedAppearances.filter((a) => a.position === 'GK').length;
  const values = [player.pace, player.shooting, player.passing, player.dribbling, player.defending, player.physical].filter(
    (v): v is number => v !== null
  );
  const overall = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link href="/players" className="mb-4 inline-block text-sm text-neutral-500">‹ Oyuncular</Link>

      <div className="mb-4 rounded-xl bg-neutral-900 p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {player.name} {player.number ? <span className="text-neutral-600">#{player.number}</span> : null}
            </h1>
            <p className="text-sm text-neutral-500">{player.team ? player.team.name : 'Serbest Oyuncu'}</p>
            {player.styleInspiration && (
              <p className="mt-1 text-xs italic text-neutral-600">Oyun stili esini: {player.styleInspiration}</p>
            )}
          </div>
          {overall !== null && (
            <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-center">
              <div className="text-2xl font-black text-amber-400">{overall}</div>
              <div className="text-[10px] font-semibold text-amber-400">GÜÇ</div>
            </div>
          )}
        </div>
        {player.marketValue !== null && (
          <div className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-center text-sm font-bold text-green-400">
            Piyasa Değeri: {player.marketValue} STA
          </div>
        )}
      </div>

      {values.length > 0 && (
        <div className="mb-4 rounded-xl bg-neutral-900 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-400">Özellikler</h2>
          <div className="flex flex-col gap-2">
            {attributeLabels.map(({ key, label }) => {
              const value = player[key];
              if (value === null) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-neutral-400">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-950">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-neutral-300">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl bg-neutral-900 p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-neutral-400">Hali Saha Karnesi</h2>
        <p className="text-sm">Maç sayısı: <span className="font-semibold">{playedAppearances.length}</span></p>
        <p className="text-sm">Toplam gol: <span className="font-semibold">{totalGoals}</span></p>
        {gkStarts > 0 && player.position !== 'GK' && (
          <p className="text-sm">🧤 Kaleci olarak başladığı maç: <span className="font-semibold">{gkStarts}</span></p>
        )}
        {teamsPlayedFor.length > 0 && (
          <p className="mt-1 text-sm">
            Oynadığı takımlar: <span className="font-semibold">{teamsPlayedFor.join(', ')}</span>
          </p>
        )}
      </div>

      {player.transferNews.length > 0 && (
        <div className="rounded-xl bg-neutral-900 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-400">Transfer Geçmişi</h2>
          <ul className="flex flex-col gap-2">
            {player.transferNews.map((n) => {
              const stage = stageLabel[n.stage] ?? stageLabel.RUMOR;
              return (
                <li key={n.id} className="rounded-lg bg-neutral-800 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span>
                      {n.fromTeam?.name ?? 'Serbest'} → {n.toTeam?.name ?? 'Serbest'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${stage.className}`}>{stage.text}</span>
                  </div>
                  {n.note && <p className="text-neutral-500">{n.note}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
