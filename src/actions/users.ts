'use server';

import bcrypt from 'bcryptjs';
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

// Passwords are stored as one-way bcrypt hashes, so even an admin can't
// look up someone's original password - this lets the admin set a new one
// for a user who forgot theirs, which is the practical alternative.
export async function adminResetPassword(userId: string, newPassword: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!newPassword || newPassword.length < 4) return { error: 'Yeni şifre en az 4 karakter olmalı.' };
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath('/admin/users');
  return {};
}
