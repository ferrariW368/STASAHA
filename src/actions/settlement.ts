'use server';

import { prisma } from '@/lib/prisma';
import { evaluateBet } from '@/lib/betting';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function settleMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
  playerGoals: { playerId: string; goalCount: number }[]
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Bu maç zaten sonuçlandırıldı.' };

  const playerGoalMap: Record<string, number> = {};
  for (const pg of playerGoals) playerGoalMap[pg.playerId] = pg.goalCount;

  const bets = await prisma.bet.findMany({ where: { matchId }, include: { selections: true } });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { status: 'finished', finalHomeScore: homeScore, finalAwayScore: awayScore },
    }),
    ...playerGoals.map((pg) =>
      prisma.playerGoal.upsert({
        where: { matchId_playerId: { matchId, playerId: pg.playerId } },
        update: { goalCount: pg.goalCount },
        create: { matchId, playerId: pg.playerId, goalCount: pg.goalCount },
      })
    ),
    ...bets.flatMap((bet) => {
      const outcome = evaluateBet(
        bet.selections.map((s) => ({ market: s.market as never, selectionKey: s.selectionKey })),
        { homeScore, awayScore, playerGoals: playerGoalMap }
      );
      const updates: Prisma.PrismaPromise<unknown>[] = [
        prisma.bet.update({ where: { id: bet.id }, data: { status: outcome } }),
      ];
      if (outcome === 'won') {
        updates.push(
          prisma.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.potentialWin } } })
        );
      }
      return updates;
    }),
  ]);

  revalidatePath('/admin');
  revalidatePath('/leaderboard');
  revalidatePath('/');
  return {};
}
