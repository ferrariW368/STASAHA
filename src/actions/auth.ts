'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function registerUser(username: string, password: string): Promise<{ error?: string }> {
  if (!username || username.trim().length < 3) {
    return { error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  if (!password || password.length < 4) {
    return { error: 'Şifre en az 4 karakter olmalı.' };
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { error: 'Bu kullanıcı adı zaten alınmış.' };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, passwordHash, staBalance: 1000, role: 'user' } });
  return {};
}
