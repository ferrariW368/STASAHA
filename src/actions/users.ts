'use server';

import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAdminAction } from '@/lib/auditLog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function currentAdminId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return null;
  const admin = await prisma.user.findUnique({ where: { username: session.user.name } });
  return admin?.id ?? null;
}

export async function adjustBalance(userId: string, delta: number) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!Number.isInteger(delta) || delta === 0) return { error: 'Geçerli bir miktar gir.' };
  await prisma.user.update({ where: { id: userId }, data: { staBalance: { increment: delta } } });
  const adminId = await currentAdminId();
  if (adminId) await logAdminAction(adminId, userId, 'ADJUST_BALANCE', `miktar: ${delta > 0 ? '+' : ''}${delta}`);
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
  const adminId = await currentAdminId();
  if (adminId) await logAdminAction(adminId, userId, 'RESET_PASSWORD');
  revalidatePath('/admin/users');
  return {};
}

export async function updateUserProfile(
  userId: string,
  updates: { username?: string; status?: 'active' | 'banned' }
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (updates.username !== undefined && updates.username.trim().length < 3) {
    return { error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) return { error: 'Kullanıcı bulunamadı.' };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.username !== undefined ? { username: updates.username.trim() } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'Bu kullanıcı adı zaten kullanılıyor.' };
    }
    throw err;
  }

  const adminId = await currentAdminId();
  if (adminId) {
    const parts: string[] = [];
    if (updates.username !== undefined && updates.username !== before.username) {
      parts.push(`kullanıcı adı: ${before.username} -> ${updates.username}`);
    }
    if (updates.status !== undefined && updates.status !== before.status) {
      parts.push(`durum: ${before.status} -> ${updates.status}`);
    }
    if (parts.length > 0) await logAdminAction(adminId, userId, 'EDIT_USER', parts.join(', '));
  }
  revalidatePath('/admin/users');
  return {};
}

export async function deleteUser(userId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: 'Kullanıcı bulunamadı.' };
  if (target.role === 'admin') return { error: 'Admin hesabı silinemez.' };

  const lineupIds = (
    await prisma.lineup.findMany({ where: { submittedById: userId }, select: { id: true } })
  ).map((l) => l.id);
  const betIds = (await prisma.bet.findMany({ where: { userId }, select: { id: true } })).map((b) => b.id);

  await prisma.$transaction([
    prisma.lineupSlot.deleteMany({ where: { lineupId: { in: lineupIds } } }),
    prisma.lineup.deleteMany({ where: { submittedById: userId } }),
    prisma.betSelection.deleteMany({ where: { betId: { in: betIds } } }),
    prisma.bet.deleteMany({ where: { userId } }),
    prisma.horseBet.deleteMany({ where: { userId } }),
    prisma.horseOwnership.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  const adminId = await currentAdminId();
  if (adminId) await logAdminAction(adminId, null, 'DELETE_USER', `silinen kullanıcı: ${target.username}`);

  revalidatePath('/admin/users');
  revalidatePath('/leaderboard');
  return {};
}
