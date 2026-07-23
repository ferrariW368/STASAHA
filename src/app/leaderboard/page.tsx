import { prisma } from '@/lib/prisma';
import { computeUserScore } from '@/lib/score';

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
      <h1 className="mb-4 text-2xl font-bold">Liderlik Tablosu</h1>
      <ol className="mb-4 flex flex-col gap-2">
        {ranked.map((u, i) => (
          <li key={u.username} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
            <div>
              <div className="font-medium">
                <span className="mr-1 text-gray-400">{i + 1}.</span>
                {u.username}
              </div>
              <div className="text-xs text-gray-500">
                {u.total} kupon, %{u.winRate} kazanma · bakiye {u.staBalance} STA
              </div>
            </div>
            <div className={`font-bold ${u.score.net > 0 ? 'text-green-600' : u.score.net < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {u.score.net > 0 ? '+' : ''}{u.score.net} puan
            </div>
          </li>
        ))}
        {ranked.length === 0 && (
          <li className="rounded-xl bg-white p-4 text-center text-sm text-gray-400 shadow-sm">Henüz kullanıcı yok.</li>
        )}
      </ol>

      <div className="rounded-xl bg-white p-4 text-xs text-gray-500 shadow-sm">
        <p className="mb-1 font-semibold text-gray-700">Puan nasıl hesaplanır?</p>
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
