'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function adjustBalance(userId: string, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) return { error: 'Geçerli bir miktar gir.' };
  await prisma.user.update({ where: { id: userId }, data: { staBalance: { increment: delta } } });
  revalidatePath('/admin/users');
  revalidatePath('/leaderboard');
  return {};
}
