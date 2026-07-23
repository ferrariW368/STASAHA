'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createTeam(name: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!name || name.trim().length < 2) return { error: 'Takım adı en az 2 karakter olmalı.' };
  await prisma.team.create({ data: { name: name.trim() } });
  revalidatePath('/admin/teams');
  return {};
}

export async function updateTeamName(teamId: string, name: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!name || name.trim().length < 2) return { error: 'Takım adı en az 2 karakter olmalı.' };
  await prisma.team.update({ where: { id: teamId }, data: { name: name.trim() } });
  revalidatePath('/admin/teams');
  revalidatePath('/');
  return {};
}

export async function deleteTeam(teamId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const matchCount = await prisma.match.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  if (matchCount > 0) {
    return { error: 'Bu takımın maçları var, önce o maçları silmeden takım silinemez.' };
  }

  await prisma.$transaction([
    prisma.player.deleteMany({ where: { teamId } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);
  revalidatePath('/admin/teams');
  revalidatePath('/admin/matches/new');
  revalidatePath('/');
  return {};
}

export async function addPlayer(teamId: string, name: string, number?: number) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!name || name.trim().length < 2) return { error: 'Oyuncu adı en az 2 karakter olmalı.' };
  await prisma.player.create({ data: { teamId, name: name.trim(), number: number ?? null } });
  revalidatePath('/admin/teams');
  return {};
}

export async function removePlayer(playerId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath('/admin/teams');
  return {};
}
