'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createTeam(name: string) {
  if (!name || name.trim().length < 2) return { error: 'Takım adı en az 2 karakter olmalı.' };
  await prisma.team.create({ data: { name: name.trim() } });
  revalidatePath('/admin/teams');
  return {};
}

export async function addPlayer(teamId: string, name: string, number?: number) {
  if (!name || name.trim().length < 2) return { error: 'Oyuncu adı en az 2 karakter olmalı.' };
  await prisma.player.create({ data: { teamId, name: name.trim(), number: number ?? null } });
  revalidatePath('/admin/teams');
  return {};
}

export async function removePlayer(playerId: string) {
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath('/admin/teams');
  return {};
}
