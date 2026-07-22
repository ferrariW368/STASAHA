import { prisma } from '@/lib/prisma';

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    orderBy: { staBalance: 'desc' },
    include: { bets: true },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Liderlik Tablosu</h1>
      <ol className="flex flex-col gap-2">
        {users.map((u, i) => {
          const total = u.bets.length;
          const won = u.bets.filter((b) => b.status === 'won').length;
          const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
          return (
            <li key={u.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{i + 1}. {u.username}</div>
                <div className="text-xs text-gray-500">{total} kupon, %{winRate} kazanma</div>
              </div>
              <div className="font-bold">{u.staBalance} STA</div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
