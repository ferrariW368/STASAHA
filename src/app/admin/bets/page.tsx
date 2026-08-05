import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { statusLabel, describeSelection, playerIdsFromSelections } from '@/lib/betDisplay';

const horseStatusLabel: Record<'pending' | 'won' | 'lost', string> = {
  pending: 'Beklemede',
  won: 'Kazandı',
  lost: 'Kaybetti',
};

export default async function AdminBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const authError = await requireAdmin();
  if (authError) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-text-muted">{authError.error}</main>;
  }

  const { tab } = await searchParams;
  const activeTab = tab === 'horse' ? 'horse' : 'football';

  const footballBets =
    activeTab === 'football'
      ? await prisma.bet.findMany({
          include: {
            user: { select: { username: true } },
            match: { include: { homeTeam: true, awayTeam: true } },
            selections: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  const allSelections = footballBets.flatMap((bet) => bet.selections);
  const playerIds = playerIdsFromSelections(allSelections);
  const players = playerIds.length
    ? await prisma.player.findMany({ where: { id: { in: playerIds } } })
    : [];
  const playerNameById = new Map(players.map((p) => [p.id, p.name]));

  const horseBets =
    activeTab === 'horse'
      ? await prisma.horseBet.findMany({
          include: {
            user: { select: { username: true } },
            horse: { select: { name: true } },
            race: { select: { id: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 font-display text-2xl tracking-wide text-text-primary">Kuponlar</h1>
      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/bets?tab=football"
          className={`rounded-full px-4 py-1.5 text-sm ${activeTab === 'football' ? 'bg-gold text-pitch-night' : 'border border-line text-text-muted'}`}
        >
          Futbol
        </Link>
        <Link
          href="/admin/bets?tab=horse"
          className={`rounded-full px-4 py-1.5 text-sm ${activeTab === 'horse' ? 'bg-gold text-pitch-night' : 'border border-line text-text-muted'}`}
        >
          At Yarışı
        </Link>
      </div>

      {activeTab === 'football' && (
        <div className="flex flex-col gap-2">
          {footballBets.length === 0 && <p className="text-sm text-text-muted">Henüz kupon yok.</p>}
          {footballBets.map((bet) => {
            const status = statusLabel[bet.status] ?? statusLabel.pending;
            const selectionText = bet.selections
              .map((s) => describeSelection(s.market, s.selectionKey, playerNameById))
              .join(', ');
            return (
              <div key={bet.id} className="rounded-lg border border-line bg-pitch-night-raised px-3 py-2">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm text-text-primary">
                    {bet.user.username} — {bet.match.homeTeam.name} vs {bet.match.awayTeam.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.text}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {bet.stake} STA · {selectionText}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'horse' && (
        <div className="flex flex-col gap-2">
          {horseBets.length === 0 && <p className="text-sm text-text-muted">Henüz kupon yok.</p>}
          {horseBets.map((bet) => (
            <div key={bet.id} className="rounded-lg border border-line bg-pitch-night-raised px-3 py-2">
              <p className="text-sm text-text-primary">
                {bet.user.username} — {bet.horse.name}
              </p>
              <p className="text-xs text-text-muted">
                {horseStatusLabel[bet.status as 'pending' | 'won' | 'lost']} · {bet.stake} STA ·{' '}
                {bet.createdAt.toLocaleString('tr-TR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
