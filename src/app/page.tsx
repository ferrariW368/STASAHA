import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';
import Reveal from '@/components/Reveal';
import SectionLabel from '@/components/SectionLabel';
import Marquee from '@/components/Marquee';
import MatchGallery from './MatchGallery';
import { computeUserScore } from '@/lib/score';

const MARKET_TAGS = [
  'MAÇ SONUCU', 'SKOR TAHMİNİ', 'TOPLAM GOL ALT/ÜST', 'İLK YARI ALT/ÜST',
  'OYUNCU GOLÜ', 'KG VAR/YOK', 'KIRMIZI KART', 'SAHAYA DALAN OLUR MU',
  'KAVGA ÇIKAR MI', 'HAKEM TARTIŞMASI',
];

const transferStageLabel: Record<string, { text: string; className: string }> = {
  RUMOR: { text: 'Söylenti', className: 'bg-pitch-night-raised text-text-muted' },
  ADVANCED: { text: 'Büyük Oranda Bitti', className: 'bg-gold/10 text-gold' },
  FAILED: { text: 'Gerçekleşmedi', className: 'bg-red-500/10 text-red-400' },
  SIGNED: { text: 'İmza Atıldı', className: 'bg-grass/10 text-grass' },
  CANCELLED: { text: 'İptal Edildi', className: 'bg-red-500/10 text-red-400' },
};

export default async function HomePage() {
  const allMatches = await prisma.match.findMany({
    where: { status: { not: 'cancelled' } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'desc' },
  });
  const galleryMatches = allMatches.map((m) => ({
    id: m.id,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    kickoffTime: m.kickoffTime.toISOString(),
    status: m.status,
    finalHomeScore: m.finalHomeScore,
    finalAwayScore: m.finalAwayScore,
  }));

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

  const teams = await prisma.team.findMany({ select: { name: true } });
  const topScorerGoal = await prisma.playerGoal.groupBy({
    by: ['playerId'],
    _sum: { goalCount: true },
    orderBy: { _sum: { goalCount: 'desc' } },
    take: 1,
  });
  const topScorer = topScorerGoal.length > 0
    ? await prisma.player.findUnique({ where: { id: topScorerGoal[0].playerId }, select: { name: true } })
    : null;
  const tickerItems: string[] = [
    ...teams.map((t) => `⚽ ${t.name}`),
    ...(topScorer && topScorerGoal[0]._sum.goalCount
      ? [`🏆 GOL KRALI: ${topScorer.name} (${topScorerGoal[0]._sum.goalCount})`]
      : []),
  ];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-pitch-night-raised to-pitch-night px-4 py-8 shadow-lg">
        <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-ferrari-red/20 blur-3xl" />

        <span className="relative inline-block rounded-full border border-gold/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
          🎰 STA · Hali Saha Tahmin Ligi
        </span>

        <h1 className="relative mt-4 font-display text-4xl leading-[1.05] tracking-wide text-text-primary sm:text-5xl">
          SAHAYA ÇIK.<br />
          KUPONU YAP.<br />
          <span className="text-ferrari-red">ZİRVEYE</span> <span className="text-gold">TIRMAN.</span>
        </h1>

        <p className="relative mt-4 max-w-sm text-sm text-text-muted">
          Arkadaş grubunun kendi hali saha maçları üzerine, gerçek para içermeyen
          STA para birimiyle kupon yap, oyuncu kadroları kur, liderlik tablosunda
          zirveye oyna.
        </p>

        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link href="#maclar" className="pop-interactive rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-pitch-night">
            Keşfet →
          </Link>
          <Link href="/kadro-plani" className="pop-interactive rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-text-primary">
            Kadro Kur
          </Link>
          <Link href="#nasil-oynanir" className="pop-interactive rounded-full px-5 py-2.5 text-sm font-semibold text-ferrari-red">
            ▸ Nasıl Oynanır
          </Link>
        </div>
      </div>

      <Marquee
        className="mb-10 border-y border-line py-3"
        items={MARKET_TAGS.map((tag) => (
          <span key={tag} className="font-display text-lg tracking-wide text-text-muted">
            {tag} <span className="text-ferrari-red">·</span>
          </span>
        ))}
      />

      <Reveal>
        <section id="nasil-oynanir" className="mb-10">
          <SectionLabel number="01" label="NASIL ÇALIŞIR" />
          <h2 className="mb-4 font-display text-2xl tracking-wide text-text-primary">Nasıl Oynanır</h2>
          <div className="flex flex-col gap-3">
            {[
              { n: '01', title: 'Kayıt Ol', text: '1000 STA ile hesabını aç, hiçbir gerçek para gerekmez.' },
              { n: '02', title: 'Kupon Yap', text: 'Maç sonucu, skor, gol atacak oyuncu gibi pazarlardan seç.' },
              { n: '03', title: 'Zirveye Tırman', text: 'Kuponun tutarsa STA kazan, liderlik tablosunda yüksel.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-4 rounded-xl border border-line bg-pitch-night-raised p-4">
                <span className="font-display text-3xl text-ferrari-red">{step.n}</span>
                <div>
                  <h3 className="font-display text-lg tracking-wide text-text-primary">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-text-muted">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {tickerItems.length > 0 && (
        <Marquee
          durationSec={18}
          className="mb-10 border-y border-line bg-pitch-night-raised py-3"
          items={tickerItems.map((item, i) => (
            <span key={i} className="font-display text-lg tracking-wide text-gold">
              {item}
            </span>
          ))}
        />
      )}

      <section id="maclar" className="mb-10">
        <SectionLabel number="02" label="MAÇLAR" />
        <h2 className="mb-4 font-display text-2xl tracking-wide text-text-primary">Maçlar</h2>
        <MatchGallery matches={galleryMatches} />
      </section>

      <AdBanner />

      {transferNews.length > 0 && (
        <Reveal delayMs={80}>
          <section className="mb-10">
            <SectionLabel number="03" label="TRANSFERLER" />
            <h2 className="mb-2 font-display text-2xl tracking-wide text-text-primary">📰 Transfer Haberleri</h2>
            <ul className="flex flex-col gap-2">
              {transferNews.map((n) => {
                const stage = transferStageLabel[n.stage] ?? transferStageLabel.RUMOR;
                return (
                  <li key={n.id} className="rounded-xl border border-line bg-pitch-night-raised p-3 shadow-sm">
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
        </Reveal>
      )}

      <Reveal delayMs={80}>
        <section>
          <SectionLabel number="04" label="LİDERLİK" />
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-wide text-text-primary">Liderlik Tablosu</h2>
            <Link href="/leaderboard" className="text-sm font-medium text-gold">Tümünü gör</Link>
          </div>
          <ol className="flex flex-col gap-1 rounded-xl border border-line bg-pitch-night-raised p-2 shadow-sm">
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
      </Reveal>
    </main>
  );
}
