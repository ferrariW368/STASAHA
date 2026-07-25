import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';
import F1Car from '@/components/F1Car';
import { isMatchLocked } from '@/lib/matchLock';
import { computeUserScore } from '@/lib/score';

const transferStageLabel: Record<string, { text: string; className: string }> = {
  RUMOR: { text: 'Söylenti', className: 'bg-neutral-800 text-neutral-400' },
  ADVANCED: { text: 'Büyük Oranda Bitti', className: 'bg-amber-400/10 text-amber-400' },
  FAILED: { text: 'Gerçekleşmedi', className: 'bg-red-500/10 text-red-400' },
  SIGNED: { text: 'İmza Atıldı', className: 'bg-green-500/10 text-green-400' },
  CANCELLED: { text: 'İptal Edildi', className: 'bg-red-500/10 text-red-400' },
};

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

  const transferNews = await prisma.transferNews.findMany({
    include: { player: true, fromTeam: true, toTeam: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-red-900/60 bg-gradient-to-br from-red-950 via-neutral-900 to-neutral-950 px-4 py-6 shadow-lg">
        <F1Car className="absolute -right-6 -top-2 h-20 w-auto text-red-600/25 sm:h-28" />
        <h1 className="relative text-3xl font-black tracking-tight">
          🎰 FERRARI<span className="text-red-500">BET</span>
        </h1>
        <p className="relative mt-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          Şansını dene, tam gaz kazan
        </p>
        <F1Car className="relative mt-4 h-6 w-auto text-red-600" />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Yaklaşan Maçlar</h2>
        <ul className="flex flex-col gap-2">
          {matches.map((m) => {
            const locked = isMatchLocked(m.kickoffTime);
            return (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="pop-interactive flex items-center justify-between rounded-xl bg-neutral-900 p-3 shadow-sm"
                >
                  <div>
                    <div className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</div>
                    <div className="text-sm text-neutral-500">
                      {m.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  {locked ? (
                    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-500">
                      Kilitli
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                      Kupon Yap
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="rounded-xl bg-neutral-900 p-4 text-center text-sm text-neutral-600 shadow-sm">
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
                  className="pop-interactive block rounded-xl bg-neutral-900 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</span>
                    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs font-semibold text-neutral-300">
                      {m.finalHomeScore} - {m.finalAwayScore}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-500">
                    {m.kickoffTime.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transferNews.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">📰 Transfer Haberleri</h2>
          <ul className="flex flex-col gap-2">
            {transferNews.map((n) => {
              const stage = transferStageLabel[n.stage] ?? transferStageLabel.RUMOR;
              return (
                <li key={n.id} className="rounded-xl bg-neutral-900 p-3 shadow-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <Link href={`/players/${n.playerId}`} className="font-medium text-neutral-100">
                      {n.player.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stage.className}`}>
                      {stage.text}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {n.fromTeam?.name ?? 'Serbest'} → {n.toTeam?.name ?? 'Serbest'}
                  </p>
                  {n.note && <p className="mt-1 text-xs text-neutral-500">{n.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liderlik Tablosu</h2>
          <Link href="/leaderboard" className="text-sm font-medium text-green-400">Tümünü gör</Link>
        </div>
        <ol className="flex flex-col gap-1 rounded-xl bg-neutral-900 p-2 shadow-sm">
          {topUsers.map((u, i) => (
            <li key={u.username} className="flex justify-between rounded-lg px-3 py-2 text-sm">
              <span>
                <span className="mr-1 text-neutral-600">{i + 1}.</span>
                {u.username}
              </span>
              <span className={`font-semibold ${u.score.net > 0 ? 'text-green-400' : u.score.net < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                {u.score.net > 0 ? '+' : ''}{u.score.net} puan
              </span>
            </li>
          ))}
          {topUsers.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-600">Henüz kullanıcı yok.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
