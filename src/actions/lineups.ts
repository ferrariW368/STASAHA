'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { getFormation, totalSlots, type Position } from '@/lib/formation';
import { revalidatePath } from 'next/cache';

export async function createLineup(
  squadName: string,
  format: number,
  slots: { playerId: string; position: Position; slotOrder: number }[]
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };

  const trimmedName = squadName.trim();
  if (trimmedName.length < 2) return { error: 'Takım adı en az 2 karakter olmalı.' };

  const formation = getFormation(format);
  if (!formation) return { error: 'Geçersiz format.' };

  const expected = totalSlots(formation);
  if (slots.length !== expected) return { error: `Kadro tam değil, ${expected} oyuncu seçmelisin.` };

  const playerIds = slots.map((s) => s.playerId);
  if (new Set(playerIds).size !== playerIds.length) {
    return { error: 'Aynı oyuncuyu iki kez seçemezsin.' };
  }

  for (const row of formation.rows) {
    const countInRow = slots.filter((s) => s.position === row.position).length;
    if (countInRow !== row.count) {
      return { error: `${row.position} için ${row.count} oyuncu seçmelisin.` };
    }
  }

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };

  const lineup = await prisma.lineup.create({
    data: {
      squadName: trimmedName,
      format,
      submittedById: user.id,
      status: 'pending',
      slots: { create: slots },
    },
  });

  revalidatePath('/admin/lineups');
  return { lineupId: lineup.id };
}

export async function approveLineup(lineupId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId }, include: { slots: true } });
  if (!lineup) return { error: 'Kadro bulunamadı.' };
  if (lineup.status !== 'pending') return { error: 'Bu kadro zaten değerlendirilmiş.' };

  const team = await prisma.team.create({ data: { name: lineup.squadName } });

  await prisma.$transaction([
    ...lineup.slots.map((s) =>
      prisma.player.update({ where: { id: s.playerId }, data: { teamId: team.id } })
    ),
    prisma.lineup.update({ where: { id: lineupId }, data: { status: 'approved' } }),
  ]);

  revalidatePath('/admin/lineups');
  revalidatePath('/admin/teams');
  revalidatePath('/admin/matches/new');
  return { teamId: team.id };
}

export async function rejectLineup(lineupId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId } });
  if (!lineup) return { error: 'Kadro bulunamadı.' };
  if (lineup.status !== 'pending') return { error: 'Bu kadro zaten değerlendirilmiş.' };

  await prisma.lineup.update({ where: { id: lineupId }, data: { status: 'rejected' } });
  revalidatePath('/admin/lineups');
  return {};
}
