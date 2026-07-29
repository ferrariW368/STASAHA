'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function buyHorseShare(horseId: string, amount: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };

  const horse = await prisma.horse.findUnique({ where: { id: horseId }, include: { ownerships: true } });
  if (!horse) return { error: 'At bulunamadı.' };

  const totalInvested = horse.ownerships.reduce((s, o) => s + o.staInvested, 0);
  const remaining = horse.price - totalInvested;
  if (remaining <= 0) return { error: 'Bu at tamamen sahiplenildi.' };

  const actualAmount = Math.min(amount, remaining);
  if (actualAmount > user.staBalance) return { error: 'Yetersiz bakiye.' };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: actualAmount } } }),
    prisma.horseOwnership.upsert({
      where: { horseId_userId: { horseId, userId: user.id } },
      create: { horseId, userId: user.id, staInvested: actualAmount },
      update: { staInvested: { increment: actualAmount } },
    }),
  ]);

  revalidatePath('/at-yarisi/magaza');
  return {};
}
