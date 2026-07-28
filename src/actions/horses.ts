'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createHorse(data: {
  name: string;
  number: number | null;
  color: string;
  speedRating: number;
  formRating: number;
  luckRating: number;
  price: number;
}) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!data.name || data.name.trim().length < 2) return { error: 'At adı en az 2 karakter olmalı.' };
  if (!Number.isInteger(data.price) || data.price <= 0) return { error: 'Fiyat pozitif bir tam sayı olmalı.' };

  await prisma.horse.create({ data: { ...data, name: data.name.trim() } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}

export async function updateHorse(
  id: string,
  data: {
    name: string;
    number: number | null;
    color: string;
    speedRating: number;
    formRating: number;
    luckRating: number;
    price: number;
  }
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!data.name || data.name.trim().length < 2) return { error: 'At adı en az 2 karakter olmalı.' };
  if (!Number.isInteger(data.price) || data.price <= 0) return { error: 'Fiyat pozitif bir tam sayı olmalı.' };

  await prisma.horse.update({ where: { id }, data: { ...data, name: data.name.trim() } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}

export async function setHorseActive(id: string, active: boolean) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.horse.update({ where: { id }, data: { active } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}
