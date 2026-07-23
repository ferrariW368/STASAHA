'use server';

import { prisma } from '@/lib/prisma';
import { evaluateBet } from '@/lib/betting';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function settleMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
  playerGoals: { playerId: string; goalCount: number }[],
  redCard: boolean,
  pitchInvasion: boolean,
  fightPlayerIds: string[],
  latePlayerIds: string[]
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Bu maç zaten sonuçlandırıldı.' };

  const playerGoalMap: Record<string, number> = {};
  for (const pg of playerGoals) playerGoalMap[pg.playerId] = pg.goalCount;

  const allPlayerIds = playerGoals.map((pg) => pg.playerId);
  const fightSet = new Set(fightPlayerIds);
  const lateSet = new Set(latePlayerIds);
  const fights: Record<string, boolean> = {};
  const lateArrivals: Record<string, boolean> = {};
  for (const playerId of allPlayerIds) {
    fights[playerId] = fightSet.has(playerId);
    lateArrivals[playerId] = lateSet.has(playerId);
  }

  const bets = await prisma.bet.findMany({ where: { matchId }, include: { selections: true } });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { status: 'finished', finalHomeScore: homeScore, finalAwayScore: awayScore, redCard, pitchInvasion },
    }),
    ...playerGoals.map((pg) =>
      prisma.playerGoal.upsert({
        where: { matchId_playerId: { matchId, playerId: pg.playerId } },
        update: { goalCount: pg.goalCount },
        create: { matchId, playerId: pg.playerId, goalCount: pg.goalCount },
      })
    ),
    ...allPlayerIds.flatMap((playerId) => [
      prisma.playerEvent.upsert({
        where: { matchId_playerId_eventType: { matchId, playerId, eventType: 'FIGHT' } },
        update: { happened: fights[playerId] },
        create: { matchId, playerId, eventType: 'FIGHT', happened: fights[playerId] },
      }),
      prisma.playerEvent.upsert({
        where: { matchId_playerId_eventType: { matchId, playerId, eventType: 'LATE' } },
        update: { happened: lateArrivals[playerId] },
        create: { matchId, playerId, eventType: 'LATE', happened: lateArrivals[playerId] },
      }),
    ]),
    ...bets.flatMap((bet) => {
      const outcome = evaluateBet(
        bet.selections.map((s) => ({ market: s.market as never, selectionKey: s.selectionKey })),
        { homeScore, awayScore, playerGoals: playerGoalMap, redCard, pitchInvasion, fights, lateArrivals }
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
