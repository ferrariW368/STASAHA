'use server';

import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function registerUser(username: string, password: string): Promise<{ error?: string }> {
  const trimmedUsername = username?.trim() ?? '';
  if (trimmedUsername.length < 3) {
    return { error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  if (!password || password.length < 4) {
    return { error: 'Şifre en az 4 karakter olmalı.' };
  }
  const existing = await prisma.user.findUnique({ where: { username: trimmedUsername } });
  if (existing) {
    return { error: 'Bu kullanıcı adı zaten alınmış.' };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username: trimmedUsername, passwordHash, staBalance: 1000, role: 'user' } });
  return {};
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!newPassword || newPassword.length < 4) return { error: 'Yeni şifre en az 4 karakter olmalı.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: 'Mevcut şifre yanlış.' };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return {};
}
