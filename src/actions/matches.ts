'use server';

import { prisma } from '@/lib/prisma';
import { computeMatchOdds } from '@/lib/odds';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createMatch(
  homeTeamId: string,
  awayTeamId: string,
  kickoffTime: Date,
  ouLine: number
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (homeTeamId === awayTeamId) {
    return { error: 'Ev sahibi ve deplasman takımı aynı olamaz.' };
  }
  if (!Number.isFinite(ouLine) || ouLine <= 0) {
    return { error: 'Geçerli bir toplam gol çizgisi gir (örn. 9.5).' };
  }

  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({ where: { teamId: homeTeamId } }),
    prisma.player.findMany({ where: { teamId: awayTeamId } }),
  ]);

  const match = await prisma.match.create({
    data: { homeTeamId, awayTeamId, kickoffTime, status: 'upcoming' },
  });

  const oddsRows = computeMatchOdds(
    homePlayers.map((p) => p.id),
    awayPlayers.map((p) => p.id),
    ouLine
  );

  await prisma.odds.createMany({
    data: oddsRows.map((o) => ({ matchId: match.id, market: o.market, selectionKey: o.selectionKey, oddsValue: o.oddsValue })),
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { matchId: match.id };
}

export async function cancelMatch(matchId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Sonuçlandırılmış bir maç iptal edilemez.' };
  if (match.status === 'cancelled') return { error: 'Bu maç zaten iptal edilmiş.' };

  const bets = await prisma.bet.findMany({ where: { matchId, status: 'pending' } });

  await prisma.$transaction([
    prisma.match.update({ where: { id: matchId }, data: { status: 'cancelled' } }),
    ...bets.flatMap((bet) => [
      prisma.bet.update({ where: { id: bet.id }, data: { status: 'refunded' } }),
      prisma.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.stake } } }),
    ]),
  ]);

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/bets');
  return {};
}
