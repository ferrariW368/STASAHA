import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import BuyShareForm from './BuyShareForm';

export default async function HorseShopPage() {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { id: true } })
    : null;
  const horses = await prisma.horse.findMany({
    where: { active: true },
    include: {
      ownerships: {
        include: { user: { select: { username: true } } },
        orderBy: { staInvested: 'desc' },
      },
      // Last 5 finished races this horse ran in, newest first — just enough
      // to show a "form" strip without pulling the whole race history.
      raceEntries: {
        where: { finishPosition: { not: null } },
        orderBy: { race: { createdAt: 'desc' } },
        take: 5,
        select: { finishPosition: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 font-display text-2xl tracking-wide text-text-primary">🐎 At Ortaklığı Mağazası</h1>

      {/* 3-step explainer: what buying a share actually means, before any horse cards */}
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl border border-line bg-pitch-night-raised p-3 text-center">
        <div>
          <p className="text-lg">1️⃣</p>
          <p className="mt-1 text-xs text-text-muted">Bir ata pay al</p>
        </div>
        <div>
          <p className="text-lg">🏁</p>
          <p className="mt-1 text-xs text-text-muted">At yarışı kazanır</p>
        </div>
        <div>
          <p className="text-lg">💰</p>
          <p className="mt-1 text-xs text-text-muted">Payın oranında STA kazanırsın</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-text-muted">
        Ödül, kazanan atın ortaklarına yatırım oranına göre paylaştırılır ve otomatik bakiyene eklenir. Bu gelir
        liderlik tablosundaki puanına dahil değildir, sadece STA bakiyeni artırır.
      </p>

      <div className="flex flex-col gap-3">
        {horses.map((horse) => {
          const totalInvested = horse.ownerships.reduce((s, o) => s + o.staInvested, 0);
          const remaining = horse.price - totalInvested;
          const myShare = currentUser
            ? horse.ownerships.find((o) => o.userId === currentUser.id)?.staInvested ?? 0
            : 0;
          const soldOut = remaining <= 0;
          const coOwnerCount = horse.ownerships.length;
          // What % of the payout pool a share actually earns — based on
          // current owners' investment, not the horse's full price, since
          // settlement splits the bonus only among existing owners.
          const myPayoutShare = totalInvested > 0 ? (myShare / totalInvested) * 100 : 0;

          const races = horse.raceEntries.length;
          const wins = horse.raceEntries.filter((e) => e.finishPosition === 1).length;

          return (
            <div key={horse.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-text-primary">
                  #{horse.number ?? '?'} {horse.name}
                </span>
                <span className="text-sm text-gold">{horse.price} STA</span>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                <span>
                  {coOwnerCount > 0
                    ? `👥 ${horse.ownerships
                        .slice(0, 3)
                        .map((o) => o.user.username)
                        .join(', ')}${coOwnerCount > 3 ? ` +${coOwnerCount - 3}` : ''} ortak`
                    : '👥 henüz ortak yok'}
                </span>
                {races > 0 && (
                  <span>
                    🏆 son {races} yarışta {wins} birincilik
                  </span>
                )}
                {myShare > 0 && <span className="font-semibold text-gold">senin payın: %{myPayoutShare.toFixed(0)}</span>}
              </div>

              <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-gold"
                  style={{ width: `${Math.min(100, (totalInvested / horse.price) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted">
                {totalInvested} / {horse.price} STA yatırıldı{myShare > 0 ? ` · yatırdığın: ${myShare} STA` : ''}
              </p>
              {soldOut ? (
                <p className="mt-2 rounded-full bg-line px-3 py-1 text-center text-xs font-semibold text-text-muted">
                  Tamamen Sahiplenildi
                </p>
              ) : (
                <BuyShareForm horseId={horse.id} remaining={remaining} totalInvested={totalInvested} myShare={myShare} />
              )}
            </div>
          );
        })}
        {horses.length === 0 && <p className="text-sm text-text-muted">Henüz at yok.</p>}
      </div>
    </main>
  );
}
