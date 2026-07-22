'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMatchLocked } from '@/lib/matchLock';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

type SelectionInput = { market: string; selectionKey: string };

export async function placeBet(matchId: string, selections: SelectionInput[], stake: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!selections.length) return { error: 'En az bir seçim yapmalısın.' };
  if (!Number.isInteger(stake) || stake <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };
  if (stake > user.staBalance) return { error: 'Yetersiz bakiye.' };

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (isMatchLocked(match.kickoffTime)) return { error: 'Bu maç için kupon süresi doldu.' };

  const existing = await prisma.bet.findUnique({ where: { userId_matchId: { userId: user.id, matchId } } });
  if (existing) return { error: 'Bu maça zaten kupon yaptın.' };

  const oddsRows = await prisma.odds.findMany({ where: { matchId } });
  const selectedOdds: typeof oddsRows = [];
  for (const s of selections) {
    const row = oddsRows.find((o) => o.market === s.market && o.selectionKey === s.selectionKey);
    if (!row) return { error: 'Geçersiz seçim, lütfen sayfayı yenileyip tekrar dene.' };
    selectedOdds.push(row);
  }

  const totalOdds = selectedOdds.reduce((acc, o) => acc * o.oddsValue, 1);
  const potentialWin = Math.round(stake * totalOdds);

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: stake } } }),
      prisma.bet.create({
        data: {
          userId: user.id,
          matchId,
          stake,
          totalOdds,
          potentialWin,
          status: 'pending',
          selections: {
            create: selectedOdds.map((o) => ({ market: o.market, selectionKey: o.selectionKey, oddsValueAtBet: o.oddsValue })),
          },
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost the race against a concurrent request for the same (userId, matchId);
      // the DB's @@unique constraint correctly rejected this insert.
      return { error: 'Bu maça zaten kupon yaptın.' };
    }
    throw err;
  }

  revalidatePath(`/matches/${matchId}`);
  return {};
}
