'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const VALID_STAGES = ['RUMOR', 'ADVANCED', 'FAILED', 'SIGNED'];

export async function createTransferNews(
  playerId: string,
  toTeamId: string | null,
  stage: string,
  note: string
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!VALID_STAGES.includes(stage)) return { error: 'Geçersiz aşama.' };

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { error: 'Oyuncu bulunamadı.' };

  await prisma.transferNews.create({
    data: {
      playerId,
      fromTeamId: player.teamId,
      toTeamId,
      stage,
      note: note.trim() || null,
    },
  });

  revalidatePath('/');
  revalidatePath('/admin/transfers');
  return {};
}

export async function updateTransferStage(newsId: string, stage: string, note: string) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!VALID_STAGES.includes(stage)) return { error: 'Geçersiz aşama.' };

  await prisma.transferNews.update({
    where: { id: newsId },
    data: { stage, note: note.trim() || null },
  });

  // A signed transfer actually moves the player to their new team.
  if (stage === 'SIGNED') {
    const news = await prisma.transferNews.findUnique({ where: { id: newsId } });
    if (news) {
      await prisma.player.update({ where: { id: news.playerId }, data: { teamId: news.toTeamId } });
    }
  }

  revalidatePath('/');
  revalidatePath('/admin/transfers');
  revalidatePath('/admin/players');
  revalidatePath('/players');
  return {};
}
