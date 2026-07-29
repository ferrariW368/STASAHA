'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function placeHorseBet(raceId: string, horseId: string, stake: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!Number.isInteger(stake) || stake <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };
  if (stake > user.staBalance) return { error: 'Yetersiz bakiye.' };

  const race = await prisma.horseRace.findUnique({ where: { id: raceId } });
  if (!race) return { error: 'Yarış bulunamadı.' };
  if (race.phase !== 'BETTING' || new Date() > race.bettingEndsAt) {
    return { error: 'Bu tur için bahis süresi doldu.' };
  }

  const entry = await prisma.horseRaceEntry.findUnique({ where: { raceId_horseId: { raceId, horseId } } });
  if (!entry) return { error: 'Geçersiz at seçimi, lütfen sayfayı yenile.' };

  const potentialWin = Math.round(stake * entry.oddsValue);

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: stake } } }),
      prisma.horseBet.create({
        data: {
          userId: user.id,
          raceId,
          horseId,
          stake,
          oddsValueAtBet: entry.oddsValue,
          potentialWin,
          status: 'pending',
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'Bu yarışa zaten bahis yaptın.' };
    }
    throw err;
  }

  revalidatePath('/at-yarisi');
  return {};
}
