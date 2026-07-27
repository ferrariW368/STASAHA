import { prisma } from '@/lib/prisma';
import { computeUserScore } from '@/lib/score';
import LeaderboardList from './LeaderboardList';

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    include: { bets: true },
  });

  const ranked = users
    .map((u) => {
      const total = u.bets.length;
      const won = u.bets.filter((b) => b.status === 'won').length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { username: u.username, staBalance: u.staBalance, total, winRate, score: computeUserScore(u.bets) };
    })
    .sort((a, b) => b.score.net - a.score.net);

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 font-display text-2xl tracking-wide text-text-primary">Liderlik Tablosu</h1>
      <LeaderboardList initial={ranked} />

      <div className="rounded-xl border border-line bg-pitch-night-raised p-4 text-xs text-text-muted shadow-sm">
        <p className="mb-1 font-semibold text-text-primary">Puan nasıl hesaplanır?</p>
        <p>
          Puan, bakiyenden değil kazanç/kayıp farkından hesaplanır: kazandığın kuponlardan elde ettiğin net kâr
          (ödeme − yatırdığın STA), kaybettiğin kuponlarda yatırdığın STA&apos;dan düşülür. Örnek: toplamda 150 STA
          kazanmış ama 200 STA kaybetmişsen puanın −50 olur. Bekleyen veya iptal edilen kuponlar puana dahil
          edilmez.
        </p>
      </div>
    </main>
  );
}
