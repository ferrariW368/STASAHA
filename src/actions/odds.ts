'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { isMatchLocked } from '@/lib/matchLock';
import { revalidatePath } from 'next/cache';

export async function updateOdds(matchId: string, updates: { oddsId: string; oddsValue: number }[]) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Sonuçlandırılmış bir maçın oranları değiştirilemez.' };
  if (match.status === 'cancelled') return { error: 'İptal edilmiş bir maçın oranları değiştirilemez.' };
  if (isMatchLocked(match.kickoffTime)) return { error: 'Maç saati geçti, oranlar kilitlendi.' };

  // Only update odds rows that actually belong to this match — never trust
  // client-submitted ids blindly.
  const validIds = new Set(
    (await prisma.odds.findMany({ where: { matchId }, select: { id: true } })).map((o) => o.id)
  );
  const safeUpdates = updates.filter((u) => validIds.has(u.oddsId) && u.oddsValue > 1.0);
  if (safeUpdates.length === 0) return { error: 'Geçerli bir oran girilmedi (oranlar 1.0\'dan büyük olmalı).' };

  await prisma.$transaction(
    safeUpdates.map((u) => prisma.odds.update({ where: { id: u.oddsId }, data: { oddsValue: u.oddsValue } }))
  );

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  return {};
}
