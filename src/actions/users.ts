'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function adjustBalance(userId: string, delta: number) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!Number.isInteger(delta) || delta === 0) return { error: 'Geçerli bir miktar gir.' };
  await prisma.user.update({ where: { id: userId }, data: { staBalance: { increment: delta } } });
  revalidatePath('/admin/users');
  revalidatePath('/leaderboard');
  return {};
}
